import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseSalesActivity, SALES_OUTCOMES } from "../lib/sales-activity";
import { isFinalLeadStatus } from "../lib/leads";

const valid = {
  requestId: "10000000-0000-4000-8000-000000000001", outcome: "no_answer", summary: "",
  nextStep: "keep", nextActionType: null, nextActionDate: null,
};
test("all six explicit outcomes accept an optional short summary", () => {
  for (const outcome of SALES_OUTCOMES) {
    assert.ok(parseSalesActivity({ ...valid, outcome: outcome.value }));
    assert.equal(parseSalesActivity({ ...valid, summary: "  סיכום  " })?.summary, "סיכום");
  }
});
test("no answer is not a completed call; WhatsApp requires actual sending", () => {
  assert.equal(SALES_OUTCOMES[0].activityType, "contact_attempt");
  assert.equal(SALES_OUTCOMES[2].activityType, "message_sent");
  assert.equal(SALES_OUTCOMES[1].direction, null);
  assert.equal(SALES_OUTCOMES[4].direction, null);
});
test("scheduled follow-up keeps exact offset/time, none cannot carry stale dates", () => {
  const date = "2030-01-02T12:30:00+02:00";
  assert.equal(parseSalesActivity({ ...valid, nextStep: "schedule", nextActionType: "call", nextActionDate: date })?.nextActionDate, date);
  assert.ok(parseSalesActivity({ ...valid, nextStep: "none" }));
  assert.equal(parseSalesActivity({ ...valid, nextStep: "none", nextActionDate: date }), null);
  for (const nextActionDate of ["", "bad", "2030-01-02T12:30", "Infinity", null]) {
    assert.equal(parseSalesActivity({ ...valid, nextStep: "schedule", nextActionType: "call", nextActionDate }), null);
  }
});
test("rejects forged ownership, malformed IDs, oversized summaries, invalid enums", () => {
  for (const input of [null, [], { ...valid, user_id: "other" }, { ...valid, status: "won" },
    { ...valid, requestId: "bad" }, { ...valid, summary: "x".repeat(2001) },
    { ...valid, outcome: "unknown" }, { ...valid, nextStep: "unknown" }, { ...valid, nextStep: ["keep"] },
    { ...valid, nextStep: "schedule", nextActionType: "invalid", nextActionDate: "2030-01-01T00:00:00Z" }]) {
    assert.equal(parseSalesActivity(input), null);
  }
});
test("all terminal aliases remain terminal; new and active remain open", () => {
  for (const status of ["נסגר בהצלחה", "לא רלוונטי", "נסגר", "סגור", "closed", "won", "lost", " WON "]) assert.equal(isFinalLeadStatus(status), true);
  for (const status of ["לידים חדשים", "יצירת קשר", "בתהליך שיחה"]) assert.equal(isFinalLeadStatus(status), false);
});
test("agent contract stays readable and mutation is isolated from old APIs/integrations", () => {
  const sql = readFileSync("supabase/migrations/20260913002144_sales_activity_capture.sql", "utf8");
  assert.match(sql, /security invoker/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /user_id = v_user/);
  assert.match(sql, /Request already used/);
  assert.doesNotMatch(sql, /(?:insert into|update|delete from) public.tasks/i);
  assert.doesNotMatch(sql, /set\s+status\s*=/i);
  const route = readFileSync("app/api/leads/[leadId]/sales-activities/route.ts", "utf8");
  assert.match(route, /auth.getUser/);
  assert.match(route, /requireSubscriptionAccess/);
  assert.doesNotMatch(route, /AdminClient|service_role|queueAndDispatch/);
});
