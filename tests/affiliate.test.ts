import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
import { getActiveReferralClick, isEligibleAffiliatePayment, paymentTime } from "../lib/affiliate";

const clickedAt = new Date("2026-09-01T12:00:00.000Z");
const expiresAt = "2026-10-01T12:00:00.000Z";
const token = "a8e1188c-f236-4f19-a393-a221f7a250aa";

function referralClient() {
  const filters: Array<[string, unknown]> = [];
  let inserts = 0;
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    is: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    gt: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    maybeSingle: async () => ({ data: { expires_at: expiresAt }, error: null }),
    insert: async () => { inserts += 1; return { error: null }; },
  };
  return {
    client: { from: () => query } as unknown as SupabaseClient<Database>,
    filters,
    get inserts() { return inserts; },
  };
}

test("an existing click keeps its original expiry after 14 days", async () => {
  const db = referralClient();
  const click = await getActiveReferralClick(db.client, token, "amitifargan", new Date(clickedAt.getTime() + 14 * 86400000));
  assert.deepEqual(click, { token, expiresAt: new Date(expiresAt) });
  assert.deepEqual(db.filters, [
    ["click_token", token], ["affiliate_code", "amitifargan"], ["user_id", null],
    ["expires_at", "2026-09-15T12:00:00.000Z"],
  ]);
  assert.equal(db.inserts, 0);
});

test("conversion requires positive payment details and matching payer email", () => {
  assert.equal(isEligibleAffiliatePayment("tx-1", 49, "BUYER@example.com", "buyer@example.com"), true);
  assert.equal(isEligibleAffiliatePayment("", 49, "buyer@example.com", "buyer@example.com"), false);
  assert.equal(isEligibleAffiliatePayment("tx-1", null, "buyer@example.com", "buyer@example.com"), false);
  assert.equal(isEligibleAffiliatePayment("tx-1", 0, "buyer@example.com", "buyer@example.com"), false);
  assert.equal(isEligibleAffiliatePayment("tx-1", 49, "other@example.com", "buyer@example.com"), false);
  assert.equal(isEligibleAffiliatePayment("tx-1", 49, "", "buyer@example.com"), false);
});

test("date-only Grow payment time is treated as webhook receipt, not a known payment instant", () => {
  const receivedAt = new Date("2026-09-27T15:00:00.000Z");
  assert.equal(paymentTime("2026-09-27", receivedAt), receivedAt);
  assert.equal(paymentTime("2026-09-27T13:00:00+02:00", receivedAt).toISOString(), "2026-09-27T11:00:00.000Z");
});
