import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const REFERRAL_COOKIE = "goldenflow_crm_referral";
export const ATTRIBUTION_DAYS = 30;
const WINDOW_MS = ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000;

// V1: deliberately allow only registered partners, not arbitrary ref values.
const AFFILIATE_CODES = new Set(["amitifargan"]);

export function isAffiliateTrackingEnabled() {
  return process.env.AFFILIATE_TRACKING_ENABLED === "true";
}

export function isAllowedAffiliate(code: string) {
  return AFFILIATE_CODES.has(code);
}

export async function createReferralClick(client: SupabaseClient<Database>, code: string, now = new Date()) {
  if (!isAllowedAffiliate(code)) return null;

  const token = randomUUID();
  const { error } = await client.from("affiliate_referrals").insert({
    affiliate_code: code,
    click_token: token,
    clicked_at: now.toISOString(),
    expires_at: new Date(now.getTime() + WINDOW_MS).toISOString(),
  });
  if (error) throw error;
  return token;
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

  if (!transactionCode || amount === null || !Number.isFinite(amount) || amount < 0) {
    throw new Error("AFFILIATE_CONVERSION_PAYMENT_DATA_MISSING");
  }

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
