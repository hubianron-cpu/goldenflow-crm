import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getMetaLeadLogId,
  getMetaLeadMaxBodyBytes,
  ingestMetaLead,
  MetaLeadIngestionError,
  validateMetaLeadPayload,
} from "@/lib/integrations/meta-leads";
import { checkRateLimit, getClientIp, getRateLimitResponseHeaders } from "@/lib/security/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const META_INGEST_RATE_LIMIT = {
  limit: 300,
  windowMs: 5 * 60 * 1000,
};

function json(body: Record<string, unknown>, status: number, headers?: HeadersInit) {
  return NextResponse.json(body, { headers, status });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() || "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || "";
}

function safeSecretEquals(incoming: string, expected: string) {
  if (!incoming || !expected) {
    return false;
  }

  const incomingBuffer = Buffer.from(incoming);
  const expectedBuffer = Buffer.from(expected);

  if (incomingBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(incomingBuffer, expectedBuffer);
}

async function parseJsonBody(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";

  if (!contentType.includes("application/json")) {
    return { error: json({ error: "Content-Type must be application/json", ok: false }, 415) };
  }

  const contentLength = Number(request.headers.get("content-length") || 0);

  if (Number.isFinite(contentLength) && contentLength > getMetaLeadMaxBodyBytes()) {
    return { error: json({ error: "Request body is too large", ok: false }, 413) };
  }

  const text = await request.text().catch(() => "");

  if (!text || Buffer.byteLength(text, "utf8") > getMetaLeadMaxBodyBytes()) {
    return { error: json({ error: "Invalid request body", ok: false }, 400) };
  }

  try {
    return { body: JSON.parse(text) as unknown };
  } catch {
    return { error: json({ error: "Invalid JSON body", ok: false }, 400) };
  }
}

export async function POST(request: Request) {
  const expectedSecret = process.env.META_LEAD_INGEST_SECRET?.trim() || "";
  const ownerId = process.env.META_LEAD_OWNER_USER_ID?.trim() || "";

  if (!expectedSecret || !UUID_PATTERN.test(ownerId)) {
    return json({ error: "Integration is not configured", ok: false }, 503);
  }

  const rateLimit = checkRateLimit({
    key: `meta-lead-ingest:${getClientIp(request.headers)}`,
    limit: META_INGEST_RATE_LIMIT.limit,
    windowMs: META_INGEST_RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    return json(
      { error: "Too many requests", ok: false },
      429,
      getRateLimitResponseHeaders(rateLimit.retryAfter),
    );
  }

  if (!safeSecretEquals(getBearerToken(request), expectedSecret)) {
    return json({ error: "Unauthorized", ok: false }, 401);
  }

  const parsedBody = await parseJsonBody(request);

  if ("error" in parsedBody) {
    return parsedBody.error;
  }

  const validation = validateMetaLeadPayload(parsedBody.body);

  if (!validation.ok) {
    return json({ error: "Invalid payload", issues: validation.issues, ok: false }, 400);
  }

  let admin;

  try {
    admin = getSupabaseAdminClient();
  } catch {
    admin = null;
  }

  if (!admin) {
    return json({ error: "Integration is not configured", ok: false }, 503);
  }

  const { data: owner, error: ownerError } = await admin.auth.admin.getUserById(ownerId);

  if (ownerError || !owner.user) {
    console.error("META_LEAD_OWNER_LOOKUP_FAILED", {
      code: ownerError?.status ?? null,
    });
    return json({ error: "Integration is not configured", ok: false }, 503);
  }

  const eventId = getMetaLeadLogId(validation.data.externalLeadId);

  try {
    const result = await ingestMetaLead(admin, ownerId, validation.data);

    if (result.taskResult === "failed") {
      console.error("META_LEAD_TASK_FAILED", {
        code: result.taskErrorCode ?? "TASK_ERROR",
        eventId,
      });
    }

    console.info("META_LEAD_INGESTED", {
      eventId,
      result: result.result,
      taskResult: result.taskResult,
    });

    return json(
      {
        leadId: result.leadId,
        ok: true,
        result: result.result,
        ...(result.taskResult === "failed"
          ? {
              taskResult: "failed",
              warning: "Lead saved, but the follow-up task could not be created",
            }
          : {}),
      },
      result.result === "created" ? 201 : 200,
    );
  } catch (error) {
    const safeError =
      error instanceof MetaLeadIngestionError
        ? { code: error.errorCode, stage: error.stage }
        : { code: "INTERNAL_ERROR", stage: "unknown" };

    console.error("META_LEAD_INGEST_FAILED", {
      eventId,
      ...safeError,
    });

    return json({ error: "Unable to process lead", ok: false }, 500);
  }
}
