import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { growAuditPayload } from "@/lib/grow/audit";
import { classifyGrowPaymentStatus } from "@/lib/grow/payment-status";
import { isAffiliateTrackingEnabled, paymentTime } from "@/lib/affiliate";

export const runtime = "nodejs";

type AdminClient = SupabaseClient<Database>;
type WebhookPayload = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

function getGrowWebhookKey() {
  return process.env.GROW_WEBHOOK_KEY?.trim() || "";
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

function getGrowWebhookAuthSource(request: Request, payload: WebhookPayload, expectedWebhookKey: string) {
  const url = new URL(request.url);
  const candidates = [
    { source: "body.webhookKey", value: getField(payload, ["webhookKey"]) },
    { source: "body.webhook_key", value: getField(payload, ["webhook_key"]) },
    { source: "query.key", value: cleanText(url.searchParams.get("key")) },
    { source: "query.webhookKey", value: cleanText(url.searchParams.get("webhookKey")) },
    { source: "header.x-webhook-key", value: cleanText(request.headers.get("x-webhook-key")) },
  ];

  for (const candidate of candidates) {
    if (candidate.value) {
      console.info("GROW_WEBHOOK_AUTH_SOURCE_DETECTED", { source: candidate.source });
    }

    if (safeSecretEquals(candidate.value, expectedWebhookKey)) {
      return { isValid: true, source: candidate.source };
    }
  }

  return { isValid: false, source: null };
}

function getWebhookAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    return {
      client: null,
      error: "Supabase URL is not configured",
      status: 500,
    };
  }

  if (!serviceRoleKey) {
    return {
      client: null,
      error: "Supabase service role is not configured",
      status: 500,
    };
  }

  return {
    client: createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
    error: null,
    status: 200,
  };
}

function cleanText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  return "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePaymentSum(value: string) {
  if (!value) {
    return null;
  }

  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function parseJsonLike(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const text = value.trim();

  if (!text || (!text.startsWith("{") && !text.startsWith("["))) {
    return value;
  }

  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function findNestedValue(source: unknown, keys: string[]): unknown {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  const record = source as Record<string, unknown>;

  for (const key of keys) {
    if (record[key] !== undefined) {
      return record[key];
    }
  }

  for (const value of Object.values(record)) {
    const parsed = parseJsonLike(value);
    const nested = findNestedValue(parsed, keys);

    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}

function getField(payload: WebhookPayload, keys: string[]) {
  return cleanText(findNestedValue(payload, keys));
}

async function parseWebhookPayload(request: Request): Promise<WebhookPayload | null> {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    return body && typeof body === "object" && !Array.isArray(body) ? (body as WebhookPayload) : null;
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);

    if (!formData) {
      return null;
    }

    const payload: WebhookPayload = {};
    formData.forEach((value, key) => {
      payload[key] = typeof value === "string" ? parseJsonLike(value) : value.name;
    });
    return payload;
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text().catch(() => "");
    const params = new URLSearchParams(text);
    const payload: WebhookPayload = {};
    params.forEach((value, key) => {
      payload[key] = parseJsonLike(value);
    });
    return payload;
  }

  const text = await request.text().catch(() => "");

  if (!text) {
    return null;
  }

  try {
    const body = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? (body as WebhookPayload) : null;
  } catch {
    const params = new URLSearchParams(text);
    const payload: WebhookPayload = {};
    params.forEach((value, key) => {
      payload[key] = parseJsonLike(value);
    });
    return Object.keys(payload).length ? payload : null;
  }
}

function getInternalUserIdCandidates(payload: WebhookPayload) {
  const directCandidates = [
    getField(payload, ["user_id", "userId", "account_id", "accountId", "subscription_user_id", "subscriptionUserId"]),
    getField(payload, ["cField1"]),
    getField(payload, ["cField2"]),
  ];

  const dynamicFields = parseJsonLike(payload.dynamicFields);
  const purchaseCustomField = parseJsonLike(payload.purchaseCustomField);

  const nestedCandidates = [
    getField({ dynamicFields }, ["user_id", "userId", "account_id", "accountId", "subscription_user_id", "subscriptionUserId"]),
    getField({ purchaseCustomField }, ["user_id", "userId", "account_id", "accountId", "subscription_user_id", "subscriptionUserId"]),
  ];

  return [...directCandidates, ...nestedCandidates].filter((value) => UUID_PATTERN.test(value));
}

function getWebhookDetails(payload: WebhookPayload) {
  const transactionCode = getField(payload, ["transactionCode", "transactionId"]);
  const directDebitId = getField(payload, ["directDebitId", "regular_payment_id"]);
  const payerEmail = normalizeEmail(getField(payload, ["payerEmail", "email", "customerEmail", "payer_email", "clientEmail"]));
  const paymentDate = getField(payload, ["paymentDate"]);
  const paymentSum = normalizePaymentSum(getField(payload, ["paymentSum", "sum"]));
  const status = getField(payload, ["status"]);
  const statusCode = getField(payload, ["statusCode"]);
  const errorMessage = getField(payload, ["error_message"]);
  const paymentStatus = classifyGrowPaymentStatus(payload, status, statusCode, errorMessage);

  return {
    directDebitId,
    errorMessage,
    ...paymentStatus,
    payerEmail,
    paymentDate,
    paymentSum,
    status,
    statusCode,
    transactionCode,
  };
}

async function getUserByEmail(serviceSupabase: AdminClient, email: string): Promise<User | null> {
  if (!email) {
    return null;
  }

  console.info("GROW_USER_LOOKUP_BY_AUTH_EMAIL");

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await serviceSupabase.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) {
      console.error("GROW_WEBHOOK_USER_EMAIL_LOOKUP_FAILED", { page });
      throw new Error("GROW_USER_EMAIL_LOOKUP_FAILED");
    }

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);

    if (user) {
      console.info("GROW_USER_FOUND");
      return user;
    }

    if (data.users.length < 1000) {
      return null;
    }
  }

  return null;
}

async function getUserById(serviceSupabase: AdminClient, userId: string): Promise<User | null> {
  if (!UUID_PATTERN.test(userId)) {
    return null;
  }

  const { data, error } = await serviceSupabase.auth.admin.getUserById(userId);

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

async function getUserByDirectDebitId(serviceSupabase: AdminClient, directDebitId: string) {
  if (!directDebitId) {
    return null;
  }

  const { data, error } = await serviceSupabase
    .from("user_subscriptions")
    .select("user_id")
    .eq("grow_direct_debit_id", directDebitId)
    .maybeSingle();

  if (error || !data?.user_id) {
    return null;
  }

  return getUserById(serviceSupabase, data.user_id);
}

async function findMatchingUser(serviceSupabase: AdminClient, payload: WebhookPayload, details: ReturnType<typeof getWebhookDetails>) {
  for (const userId of getInternalUserIdCandidates(payload)) {
    const user = await getUserById(serviceSupabase, userId);

    if (user) {
      return user;
    }
  }

  if (details.isFailedPayment) {
    const userByDirectDebit = await getUserByDirectDebitId(serviceSupabase, details.directDebitId);

    if (userByDirectDebit) {
      return userByDirectDebit;
    }
  }

  return getUserByEmail(serviceSupabase, details.payerEmail);
}


export async function POST(request: Request) {
  console.info("Grow webhook received");
  console.info("GROW_WEBHOOK_RECEIVED");

  const expectedWebhookKey = getGrowWebhookKey();

  if (!expectedWebhookKey) {
    console.error("GROW_WEBHOOK_KEY_MISSING");
    return jsonResponse({ error: "Webhook is not configured" }, 500);
  }

  const payload = await parseWebhookPayload(request);

  if (!payload) {
    return jsonResponse({ error: "Invalid webhook payload" }, 400);
  }

  const webhookAuth = getGrowWebhookAuthSource(request, payload, expectedWebhookKey);

  if (!webhookAuth.isValid) {
    console.info("GROW_WEBHOOK_AUTH_FAILED");
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  console.info("Grow webhook verified");
  console.info("GROW_WEBHOOK_VERIFIED", { source: webhookAuth.source });

  const adminClientResult = getWebhookAdminClient();
  console.info("GROW_SUPABASE_ADMIN_CLIENT_READY", {
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
  });

  if (!adminClientResult.client) {
    console.error("GROW_WEBHOOK_ADMIN_CLIENT_MISSING", { reason: adminClientResult.error });
    return jsonResponse({ error: adminClientResult.error || "Server configuration error" }, adminClientResult.status);
  }

  const serviceSupabase = adminClientResult.client;
  const details = getWebhookDetails(payload);
  const auditPayload = growAuditPayload(details);

  try {
    if (!details.transactionCode) return jsonResponse({ error: "Transaction code is required" }, 400);
    const user = await findMatchingUser(serviceSupabase, payload, details);
    const { data, error } = await serviceSupabase.rpc("process_grow_callback", {
      p_user_id: user?.id || null,
      p_event: {
        transaction_code: details.transactionCode,
        outcome: details.isSuccessfulPayment ? "paid" : details.isFailedPayment ? "failed" : "ignored",
        amount: details.paymentSum,
        direct_debit_id: details.directDebitId,
        paid_at: paymentTime(details.paymentDate, new Date()).toISOString(),
        audit_date: auditPayload.payment_date,
        error_message: details.errorMessage,
        email_matches: Boolean(user?.email && details.payerEmail &&
          normalizeEmail(user.email) === details.payerEmail),
        affiliate_enabled: isAffiliateTrackingEnabled(),
      },
    });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("GROW_ATOMIC_PROCESSING_FAILED");
    }
    const result = data as Record<string, unknown>;
    const { http_status: httpStatus, ...response } = result;
    return jsonResponse(response, typeof httpStatus === "number" ? httpStatus : 200);
  } catch {
    console.error("GROW_WEBHOOK_PROCESSING_FAILED");
    return jsonResponse({ error: "Webhook processing failed" }, 500);
  }
}
