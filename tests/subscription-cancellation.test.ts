import assert from "node:assert/strict";
import { test } from "node:test";
import { getSubscriptionAccess } from "../lib/subscriptions";

const now = new Date("2026-09-23T10:00:00.000Z");
const active = {
  status: "active" as const,
  trial_end_at: null,
  renewal_cancelled_at: null,
  access_until: null,
};

test("an ordinary active subscription retains access", () => {
  assert.equal(getSubscriptionAccess(active, now).hasAccess, true);
});

test("verified cancellation preserves access strictly until the paid-through instant", () => {
  const scheduled = {
    ...active,
    renewal_cancelled_at: "2026-09-22T10:00:00.000Z",
    access_until: "2026-09-30T10:00:00.000Z",
  };
  assert.equal(getSubscriptionAccess(scheduled, now).hasAccess, true);
  assert.equal(getSubscriptionAccess(scheduled, new Date("2026-09-30T09:59:59.999Z")).hasAccess, true);
  assert.equal(getSubscriptionAccess(scheduled, new Date(scheduled.access_until)).hasAccess, false);
  assert.equal(getSubscriptionAccess(scheduled, new Date("2026-10-01T10:00:00.000Z")).isExpired, true);
});

test("a malformed cancellation window fails closed", () => {
  assert.equal(getSubscriptionAccess({ ...active, renewal_cancelled_at: now.toISOString() }, now).hasAccess, false);
});

test("trial and denied statuses keep their existing behavior", () => {
  const trial = { ...active, status: "trial" as const, trial_end_at: "2026-09-24T10:00:00.000Z" };
  assert.equal(getSubscriptionAccess(trial, now).hasAccess, true);
  assert.equal(getSubscriptionAccess(trial, new Date(trial.trial_end_at)).hasAccess, false);
  for (const status of ["cancelled", "payment_failed", "expired", "past_due"] as const) {
    assert.equal(getSubscriptionAccess({ ...active, status }, now).hasAccess, false);
  }
});
