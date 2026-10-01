import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const REFERRAL_COOKIE = "goldenflow_crm_referral";
export const ATTRIBUTION_DAYS = 30;

export class AffiliateRateLimitError extends Error {
  constructor() {
    super("Affiliate click rate limit reached");
    this.name = "AffiliateRateLimitError";
  }
}

// V1: deliberately allow only registered partners, not arbitrary ref values.
const AFFILIATE_CODES = new Set(["amitifargan"]);

export function isAffiliateTrackingEnabled() {
  return process.env.AFFILIATE_TRACKING_ENABLED === "true";
}

export function isAllowedAffiliate(code: string) {
  return AFFILIATE_CODES.has(code);
}

export async function getActiveReferralClick(
  client: SupabaseClient<Database>,
  token: string | undefined,
  code: string,
  now = new Date(),
) {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data, error } = await client.from("affiliate_referrals")
    .select("expires_at")
    .eq("click_token", token)
    .eq("affiliate_code", code)
    .is("user_id", null)
    .gt("expires_at", now.toISOString())
    .maybeSingle();
  if (error) throw error;
  return data ? { token, expiresAt: new Date(data.expires_at) } : null;
}

export async function createReferralClick(client: SupabaseClient<Database>, code: string) {
  if (!isAllowedAffiliate(code)) return null;

  // The shared database limit cannot be bypassed by switching serverless instances.
  const { data, error } = await client.rpc("create_affiliate_click", { p_code: code });
  if (error) throw error;
  if (data?.status === "rate_limited") throw new AffiliateRateLimitError();
  if (data?.status !== "created" || typeof data.token !== "string"
    || typeof data.expires_at !== "string" || Number.isNaN(Date.parse(data.expires_at))) {
    throw new Error("Invalid affiliate click response");
  }
  return { token: data.token, expiresAt: new Date(data.expires_at) };
}

export async function claimReferral(
  client: SupabaseClient<Database>,
  token: string | undefined,
  userId: string,
  now = new Date(),
) {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return false;

  const { data, error } = await client.from("affiliate_referrals")
    .update({ user_id: userId })
    .eq("click_token", token)
    .is("user_id", null)
    .gt("expires_at", now.toISOString())
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// A provider timestamp is used only when it includes a time and timezone.
// Ambiguous date-only formats use the time the verified webhook arrived.
export function paymentTime(paymentDate: string, receivedAt: Date) {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(paymentDate)) {
    const parsed = new Date(paymentDate);
    if (!Number.isNaN(parsed.getTime()) && parsed <= receivedAt) return parsed;
  }
  return receivedAt;
}

export function isEligibleAffiliatePayment(transactionCode: string, amount: number | null, payerEmail: string, userEmail: string | undefined) {
  return Boolean(transactionCode.trim())
    && amount !== null && Number.isFinite(amount) && amount > 0
    && Boolean(payerEmail) && Boolean(userEmail)
    && payerEmail.trim().toLowerCase() === userEmail?.trim().toLowerCase();
}

export async function recordAffiliateConversion(
  client: SupabaseClient<Database>,
  userId: string,
  transactionCode: string,
  amount: number | null,
  paymentDate: string,
  receivedAt = new Date(),
) {
  const paidAt = paymentTime(paymentDate, receivedAt).toISOString();
  const { data: referral, error: lookupError } = await client.from("affiliate_referrals")
    .select("id")
    .eq("user_id", userId)
    .is("conversion_transaction_code", null)
    .lte("clicked_at", paidAt)
    .gt("expires_at", paidAt)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!referral) return false;

  if (!transactionCode.trim() || amount === null || !Number.isFinite(amount) || amount <= 0) return false;

  const { data, error } = await client.from("affiliate_referrals")
    .update({
      conversion_amount: amount,
      conversion_transaction_code: transactionCode,
      converted_at: paidAt,
    })
    .eq("id", referral.id)
    .is("conversion_transaction_code", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
