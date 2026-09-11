import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  parseSalesIntelligenceDetailRequest,
  SALES_INTELLIGENCE_CACHE_CONTROL,
} from "@/lib/agents/sales-intelligence";
import {
  authenticateSalesIntelligenceRequest,
  loadSalesIntelligenceLeadDetail,
} from "@/lib/agents/sales-intelligence-server";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitResponseHeaders,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function responseHeaders(requestId: string) {
  return {
    "Cache-Control": SALES_INTELLIGENCE_CACHE_CONTROL,
    "X-Request-Id": requestId,
  };
}

function jsonError(error: string, status: number, requestId: string, extraHeaders?: Record<string, string>) {
  return NextResponse.json(
    { error, request_id: requestId },
    { headers: { ...responseHeaders(requestId), ...extraHeaders }, status },
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const startedAt = Date.now();
  const requestId = randomUUID();
  const clientIp = getClientIp(request.headers);
  const preAuthLimit = checkRateLimit({
    key: `sales-intelligence:detail:preauth:${clientIp}`,
    limit: 120,
    windowMs: 60_000,
  });

  if (!preAuthLimit.allowed) {
    return jsonError("Too many requests", 429, requestId, getRateLimitResponseHeaders(preAuthLimit.retryAfter));
  }

  const auth = await authenticateSalesIntelligenceRequest(request);
  if (!auth.ok) {
    return jsonError(auth.error, auth.status, requestId);
  }

  const credentialLimit = checkRateLimit({
    key: `sales-intelligence:detail:${auth.context.credentialId}:${clientIp}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!credentialLimit.allowed) {
    return jsonError("Too many requests", 429, requestId, getRateLimitResponseHeaders(credentialLimit.retryAfter));
  }

  const { leadId } = await params;
  const parsed = parseSalesIntelligenceDetailRequest(leadId, new URL(request.url).searchParams);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400, requestId);
  }

  const result = await loadSalesIntelligenceLeadDetail(
    auth.context.admin,
    auth.context.userId,
    parsed.input.leadId,
    parsed.input.timelineLimit,
  );
  if (!result.ok) {
    return jsonError(result.error, 500, requestId);
  }
  if (!result.data) {
    return jsonError("Lead not found", 404, requestId);
  }

  console.info("SALES_INTELLIGENCE_DETAIL_COMPLETED", {
    credentialId: auth.context.credentialId,
    durationMs: Date.now() - startedAt,
    requestId,
    timelineCount: result.data.timeline.length,
  });

  return NextResponse.json(result.data, {
    headers: responseHeaders(requestId),
    status: 200,
  });
}
