import assert from "node:assert/strict";
import { test } from "node:test";
import { getSubscriptionAccess } from "../lib/subscriptions";
import { canReactivateFromGrowPayment, toJerusalemUtcIso, updatedGrowMandateId } from "../lib/subscription-cancellation";

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

test("a new Grow mandate reactivates a cancelled subscription", () => {
  const cancelledAt = "2026-09-23T10:00:00.000Z";
  assert.equal(canReactivateFromGrowPayment(cancelledAt, "old-mandate", "new-mandate"), true);
  assert.equal(canReactivateFromGrowPayment(cancelledAt, "old-mandate", "old-mandate"), false);
  assert.equal(canReactivateFromGrowPayment(cancelledAt, "old-mandate", ""), false);
  assert.equal(canReactivateFromGrowPayment(cancelledAt, null, "new-mandate"), false);
  assert.equal(canReactivateFromGrowPayment(null, "old-mandate", ""), true);

  const expired = { ...active, renewal_cancelled_at: cancelledAt, access_until: "2026-09-30T10:00:00.000Z" };
  assert.equal(getSubscriptionAccess(expired, new Date("2026-10-01T10:00:00.000Z")).hasAccess, false);
  const reactivated = { ...expired, renewal_cancelled_at: null, access_until: null };
  assert.equal(getSubscriptionAccess(reactivated, new Date("2026-10-01T10:00:00.000Z")).hasAccess, true);
});

test("a success notification without a mandate ID preserves the existing ID", () => {
  assert.equal(updatedGrowMandateId("existing-mandate", ""), "existing-mandate");
  assert.equal(updatedGrowMandateId("existing-mandate", "new-mandate"), "new-mandate");
  assert.equal(updatedGrowMandateId(null, ""), null);
});

test("paid-through time is interpreted in Jerusalem regardless of browser timezone", () => {
  assert.equal(toJerusalemUtcIso("2026-01-15T12:00"), "2026-01-15T10:00:00.000Z");
  assert.equal(toJerusalemUtcIso("2026-07-15T12:00"), "2026-07-15T09:00:00.000Z");
  assert.equal(toJerusalemUtcIso("2026-02-30T12:00"), null);
  assert.equal(toJerusalemUtcIso("2026-03-27T02:30"), null);
  assert.equal(toJerusalemUtcIso("2026-10-25T01:30"), null);
});
