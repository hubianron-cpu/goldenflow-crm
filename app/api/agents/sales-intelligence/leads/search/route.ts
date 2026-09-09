import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  parseSalesIntelligenceSearch,
  SALES_INTELLIGENCE_CACHE_CONTROL,
} from "@/lib/agents/sales-intelligence";
import {
  authenticateSalesIntelligenceRequest,
  searchSalesIntelligenceLeads,
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

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = randomUUID();
  const clientIp = getClientIp(request.headers);
  const preAuthLimit = checkRateLimit({
    key: `sales-intelligence:search:preauth:${clientIp}`,
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
    key: `sales-intelligence:search:${auth.context.credentialId}:${clientIp}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!credentialLimit.allowed) {
    return jsonError("Too many requests", 429, requestId, getRateLimitResponseHeaders(credentialLimit.retryAfter));
  }

  const parsed = parseSalesIntelligenceSearch(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400, requestId);
  }

  const result = await searchSalesIntelligenceLeads(
    auth.context.admin,
    auth.context.userId,
    parsed.input,
  );
  if (!result.ok) {
    return jsonError(result.error, 500, requestId);
  }

  console.info("SALES_INTELLIGENCE_SEARCH_COMPLETED", {
    credentialId: auth.context.credentialId,
    durationMs: Date.now() - startedAt,
    requestId,
    resultCount: result.data.matches.length,
  });

  return NextResponse.json(result.data, {
    headers: responseHeaders(requestId),
    status: 200,
  });
}
