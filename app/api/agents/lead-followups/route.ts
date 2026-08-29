import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  evaluateLeadFollowups,
  getJerusalemDayBounds,
  LEAD_FOLLOWUPS_CACHE_CONTROL,
  parseLeadFollowupRequest,
} from "@/lib/agents/lead-followups";
import {
  authenticateLeadFollowupsRequest,
  loadLeadFollowupSourceData,
} from "@/lib/agents/lead-followups-server";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitResponseHeaders,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_LIMIT = {
  limit: 60,
  windowMs: 60_000,
};

function responseHeaders(requestId: string) {
  return {
    "Cache-Control": LEAD_FOLLOWUPS_CACHE_CONTROL,
    "X-Request-Id": requestId,
  };
}

function jsonError(error: string, status: number, requestId: string, extraHeaders?: Record<string, string>) {
  return NextResponse.json(
    { error, request_id: requestId },
    {
      headers: { ...responseHeaders(requestId), ...extraHeaders },
      status,
    },
  );
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = randomUUID();
  const clientIp = getClientIp(request.headers);
  const rateLimit = checkRateLimit({
    key: `lead-followups:${clientIp}`,
    ...RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return jsonError(
      "Too many requests",
      429,
      requestId,
      getRateLimitResponseHeaders(rateLimit.retryAfter),
    );
  }

  const auth = await authenticateLeadFollowupsRequest(request);
  if (!auth.ok) {
    return jsonError(auth.error, auth.status, requestId);
  }

  const parsedUrl = new URL(request.url);
  const parsedRequest = parseLeadFollowupRequest(parsedUrl.searchParams);
  if (!parsedRequest.ok) {
    return jsonError(parsedRequest.error, 400, requestId);
  }

  const { end, start } = getJerusalemDayBounds(parsedRequest.options.date);
  const sourceData = await loadLeadFollowupSourceData(
    auth.context.admin,
    auth.context.userId,
    start.toISOString(),
    end.toISOString(),
  );

  if (!sourceData.ok) {
    return jsonError(sourceData.error, 500, requestId);
  }

  const result = evaluateLeadFollowups({
    ...parsedRequest.options,
    leads: sourceData.leads,
    tasks: sourceData.tasks,
    tenantUserId: auth.context.userId,
  });

  console.info("LEAD_FOLLOWUPS_REQUEST_COMPLETED", {
    credentialId: auth.context.credentialId,
    durationMs: Date.now() - startedAt,
    requestId,
    resultCount: result.items.length,
    ruleCounts: result.counts,
  });

  return NextResponse.json(result, {
    headers: responseHeaders(requestId),
    status: 200,
  });
}
