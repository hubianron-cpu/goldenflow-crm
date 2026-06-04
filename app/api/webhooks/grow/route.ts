import { NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

export const runtime = "nodejs";

type AdminClient = SupabaseClient<Database>;
type WebhookPayload = Record<string, unknown>;
type EventType = "payment_failed" | "subscription_activated" | "ignored";
type SupabaseErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUCCESS_STATUS_CODES = new Set(["0", "00", "000", "1", "200"]);
const SUCCESS_WORDS = ["success", "approved", "paid", "complete", "completed", "ok", "מאושר", "שולם"];
const FAILURE_WORDS = ["fail", "failed", "failure", "declined", "denied", "error", "cancel", "cancelled", "rejected", "refused", "סורב", "נכשל"];

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

function logSupabaseError(label: string, error: SupabaseErrorLike) {
  console.error(label, {
    code: error.code,
    details: error.details,
    hint: error.hint,
    message: error.message,
  });
}

function logGrowEventError(label: string, error: SupabaseErrorLike, context: Record<string, unknown>) {
  console.error(label, {
    ...context,
    code: error.code,
    details: error.details,
    hint: error.hint,
    message: error.message,
    schema: "public",
  });
}

function getGrowWebhookKey() {
  return process.env.GROW_WEBHOOK_KEY?.trim() || "";
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

function getJsonPayloadForStorage(payload: WebhookPayload): Json {
  return JSON.parse(JSON.stringify(payload)) as Json;
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
  const payerEmail = normalizeEmail(getField(payload, ["payerEmail", "email"]));
  const paymentDate = getField(payload, ["paymentDate"]);
  const paymentSum = normalizePaymentSum(getField(payload, ["paymentSum", "sum"]));
  const status = getField(payload, ["status"]);
  const statusCode = getField(payload, ["statusCode"]);
  const errorMessage = getField(payload, ["error_message"]);
  const combinedStatusText = `${status} ${statusCode} ${errorMessage}`.toLowerCase();
  const hasFailureSignal = Boolean(errorMessage) || FAILURE_WORDS.some((word) => combinedStatusText.includes(word));
  const hasSuccessSignal = SUCCESS_STATUS_CODES.has(statusCode) || SUCCESS_WORDS.some((word) => combinedStatusText.includes(word));
  const looksLikePaidTransaction = Boolean(transactionCode && (paymentSum !== null || directDebitId));

  return {
    directDebitId,
    errorMessage,
    isFailedPayment: hasFailureSignal,
    isSuccessfulPayment: !hasFailureSignal && (hasSuccessSignal || looksLikePaidTransaction),
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

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await serviceSupabase.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) {
      console.error("GROW_WEBHOOK_USER_EMAIL_LOOKUP_FAILED", { message: error.message, page });
      return null;
    }

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);

    if (user) {
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

async function hasProcessedTransaction(serviceSupabase: AdminClient, transactionCode: string) {
  if (!transactionCode) {
    return false;
  }

  console.info("GROW_EVENT_LOOKUP_STARTED", { transactionCode });

  const { data, error } = await serviceSupabase
    .from("grow_webhook_events")
    .select("id")
    .eq("transaction_code", transactionCode)
    .maybeSingle();

  if (error) {
    logGrowEventError("GROW_EVENT_LOOKUP_FAILED", error, {
      table: "grow_webhook_events",
      transactionCode,
    });
    throw new Error("GROW_EVENT_LOOKUP_FAILED");
  }

  if (!data) {
    console.info("GROW_EVENT_LOOKUP_NO_EXISTING_EVENT", { transactionCode });
    return false;
  }

  console.info("GROW_EVENT_DUPLICATE_IGNORED", { transactionCode });
  return true;
}

async function saveWebhookEvent(
  serviceSupabase: AdminClient,
  payload: WebhookPayload,
  eventType: EventType,
  transactionCode: string,
  userId: string | null,
) {
  const { error } = await serviceSupabase.from("grow_webhook_events").insert({
    event_type: eventType,
    payload: getJsonPayloadForStorage(payload),
    processed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    transaction_code: transactionCode || null,
    user_id: userId,
  });

  if (error) {
    if (error.code === "23505") {
      console.info("GROW_EVENT_DUPLICATE_IGNORED", { eventType, transactionCode });
      return;
    }

    logGrowEventError("GROW_EVENT_INSERT_FAILED", error, {
      eventType,
      table: "grow_webhook_events",
      transactionCode,
    });
    throw new Error("GROW_EVENT_INSERT_FAILED");
  }

  console.info("GROW_EVENT_INSERTED", { eventType, transactionCode });
}

async function activateSubscription(
  serviceSupabase: AdminClient,
  userId: string,
  details: ReturnType<typeof getWebhookDetails>,
) {
  const nowIso = new Date().toISOString();
  const { data: existingSubscription, error: existingError } = await serviceSupabase
    .from("user_subscriptions")
    .select("user_id,created_at,trial_start_at,upgraded_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    logSupabaseError("GROW_SUBSCRIPTION_LOOKUP_FAILED", existingError);
    throw new Error("GROW_SUBSCRIPTION_LOOKUP_FAILED");
  }

  const payload = {
    grow_direct_debit_id: details.directDebitId || null,
    grow_last_payment_date: details.paymentDate || nowIso,
    grow_last_payment_sum: details.paymentSum,
    grow_transaction_code: details.transactionCode || null,
    plan_name: "monthly",
    status: "active" as const,
    trial_end_at: null,
    trial_start_at: null,
    updated_at: nowIso,
    upgraded_at: existingSubscription?.upgraded_at || nowIso,
    user_id: userId,
  };

  const result = existingSubscription
    ? await serviceSupabase.from("user_subscriptions").update(payload).eq("user_id", userId)
    : await serviceSupabase.from("user_subscriptions").insert({
        ...payload,
        created_at: nowIso,
      });

  if (result.error) {
    logSupabaseError("GROW_SUBSCRIPTION_UPDATE_FAILED", result.error);
    throw new Error("GROW_SUBSCRIPTION_ACTIVATION_FAILED");
  }
}

async function markPaymentFailed(
  serviceSupabase: AdminClient,
  userId: string,
  details: ReturnType<typeof getWebhookDetails>,
) {
  const nowIso = new Date().toISOString();
  const { error } = await serviceSupabase
    .from("user_subscriptions")
    .update({
      grow_direct_debit_id: details.directDebitId || undefined,
      grow_last_error_message: details.errorMessage || null,
      grow_last_payment_date: details.paymentDate || nowIso,
      grow_last_payment_sum: details.paymentSum,
      grow_transaction_code: details.transactionCode || undefined,
      status: "payment_failed",
      updated_at: nowIso,
    })
    .eq("user_id", userId);

  if (error) {
    logSupabaseError("GROW_PAYMENT_FAILURE_UPDATE_FAILED", error);
    throw new Error("GROW_PAYMENT_FAILURE_UPDATE_FAILED");
  }
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

  const incomingWebhookKey = getField(payload, ["webhookKey", "webhook_key"]);

  if (!incomingWebhookKey || incomingWebhookKey !== expectedWebhookKey) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  console.info("Grow webhook verified");
  console.info("GROW_WEBHOOK_VERIFIED");

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

  try {
    if (details.transactionCode && await hasProcessedTransaction(serviceSupabase, details.transactionCode)) {
      return jsonResponse({ ok: true, duplicate: true });
    }

    console.info("GROW_USER_LOOKUP_STARTED", { payerEmail: details.payerEmail, transactionCode: details.transactionCode });
    const user = await findMatchingUser(serviceSupabase, payload, details);

    if (!user) {
      console.info("GROW_USER_NOT_FOUND", { payerEmail: details.payerEmail, transactionCode: details.transactionCode });
      await saveWebhookEvent(serviceSupabase, payload, "ignored", details.transactionCode, null);
      return jsonResponse({ ok: true, message: "No matching user found" });
    }

    console.info("GROW_USER_FOUND", { transactionCode: details.transactionCode });

    if (details.isFailedPayment) {
      console.info("GROW_PAYMENT_FAILED_EVENT_RECEIVED", { transactionCode: details.transactionCode });
      await markPaymentFailed(serviceSupabase, user.id, details);
      await saveWebhookEvent(serviceSupabase, payload, "payment_failed", details.transactionCode, user.id);
      return jsonResponse({ ok: true, status: "payment_failed" });
    }

    if (!details.isSuccessfulPayment) {
      await saveWebhookEvent(serviceSupabase, payload, "ignored", details.transactionCode, user.id);
      return jsonResponse({ ok: true, ignored: true });
    }

    console.info("GROW_SUBSCRIPTION_UPDATE_STARTED", { transactionCode: details.transactionCode });
    await activateSubscription(serviceSupabase, user.id, details);
    await saveWebhookEvent(serviceSupabase, payload, "subscription_activated", details.transactionCode, user.id);
    console.info("GROW_SUBSCRIPTION_UPDATED", { transactionCode: details.transactionCode });

    return jsonResponse({ ok: true, status: "active" });
  } catch (error) {
    console.error("GROW_WEBHOOK_PROCESSING_FAILED", { reason: error instanceof Error ? error.message : "unknown" });
    return jsonResponse({ error: "Webhook processing failed" }, 500);
  }
}
