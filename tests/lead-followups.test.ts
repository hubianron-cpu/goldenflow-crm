import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateLeadFollowups,
  getJerusalemDateKey,
  getJerusalemDayBounds,
  isTerminalLeadForFollowups,
  LEAD_FOLLOWUPS_CACHE_CONTROL,
  parseLeadFollowupRequest,
  type LeadFollowupLead,
  type LeadFollowupTask,
} from "../lib/agents/lead-followups";
import {
  getCredentialAccess,
  hashLeadFollowupsToken,
  LEAD_FOLLOWUPS_READ_SCOPE,
  parseBearerToken,
  type LeadFollowupsCredentialRecord,
} from "../lib/agents/lead-followups-credential";

const TENANT_A = "00000000-0000-4000-8000-00000000000a";
const TENANT_B = "00000000-0000-4000-8000-00000000000b";
const EFFECTIVE_DATE = "2026-08-29";
const NOW = new Date("2026-08-29T07:00:00.000Z");

function makeLead(overrides: Partial<LeadFollowupLead> = {}): LeadFollowupLead {
  return {
    created_at: "2026-08-28T04:00:00.000Z",
    deal_probability: 25,
    full_name: "QA Lead",
    id: "10000000-0000-4000-8000-000000000001",
    last_contact_date: "2026-08-28T05:00:00.000Z",
    next_action_date: null,
    next_action_type: null,
    priority: "medium",
    status: "יצירת קשר",
    updated_at: "2026-08-28T05:00:00.000Z",
    user_id: TENANT_A,
    value: 5000,
    ...overrides,
  };
}

function makeTask(overrides: Partial<LeadFollowupTask> = {}): LeadFollowupTask {
  return {
    completed_at: null,
    created_at: "2026-08-28T04:00:00.000Z",
    deleted_at: null,
    due_date: "2026-08-29T06:00:00.000Z",
    id: "20000000-0000-4000-8000-000000000001",
    linked_lead_id: "10000000-0000-4000-8000-000000000001",
    status: "פתוחה",
    user_id: TENANT_A,
    ...overrides,
  };
}

function run(
  leads: LeadFollowupLead[],
  tasks: LeadFollowupTask[] = [],
  options: { includeRecovery?: boolean; limit?: number; tenantUserId?: string } = {},
) {
  return evaluateLeadFollowups({
    date: EFFECTIVE_DATE,
    generatedAt: NOW,
    includeRecovery: options.includeRecovery ?? false,
    leads,
    limit: options.limit ?? 20,
    priority: null,
    tasks,
    tenantUserId: options.tenantUserId ?? TENANT_A,
  });
}

function makeCredential(overrides: Partial<LeadFollowupsCredentialRecord> = {}): LeadFollowupsCredentialRecord {
  return {
    expires_at: null,
    id: "30000000-0000-4000-8000-000000000001",
    revoked_at: null,
    scopes: [LEAD_FOLLOWUPS_READ_SCOPE],
    token_hash: "a".repeat(64),
    user_id: TENANT_A,
    ...overrides,
  };
}

test("explicit follow-up today is due P1", () => {
  const result = run([makeLead({ next_action_date: "2026-08-29T06:00:00.000Z", next_action_type: "call" })]);
  assert.equal(result.items[0]?.followup_type, "due");
  assert.equal(result.items[0]?.priority, "P1");
  assert.equal(result.items[0]?.primary_source_rule, "explicit_followup_today");
});

test("overdue task is due P1", () => {
  const result = run([makeLead()], [makeTask({ due_date: "2026-08-27T06:00:00.000Z" })]);
  assert.equal(result.items[0]?.primary_source_rule, "explicit_overdue_followup");
  assert.match(result.items[0]?.reason ?? "", /2026-08-27/);
});

test("future explicit follow-up is not returned early", () => {
  const result = run([makeLead({ next_action_date: "2026-08-30T06:00:00.000Z" })]);
  assert.equal(result.items.length, 0);
});

test("completed follow-up is not returned again", () => {
  const lead = makeLead({
    created_at: "2026-08-29T04:00:00.000Z",
    last_contact_date: null,
    status: "לידים חדשים",
  });
  const task = makeTask({
    completed_at: "2026-08-29T06:30:00.000Z",
    due_date: "2026-08-29T06:00:00.000Z",
    status: "הושלמה",
  });
  assert.equal(run([lead], [task]).items.length, 0);
});

test("new lead over SLA without first contact is suggested", () => {
  const result = run([
    makeLead({
      created_at: "2026-08-29T04:00:00.000Z",
      last_contact_date: null,
      status: "לידים חדשים",
    }),
  ]);
  assert.equal(result.items[0]?.followup_type, "suggested");
  assert.equal(result.items[0]?.primary_source_rule, "new_lead_no_contact");
});

test("new lead inside grace period is not returned", () => {
  const result = run([
    makeLead({
      created_at: "2026-08-29T06:30:00.000Z",
      last_contact_date: null,
      status: "לידים חדשים",
    }),
  ]);
  assert.equal(result.items.length, 0);
});

test("proposal rule fails closed without a reliable proposal timestamp", () => {
  const result = run([makeLead({ status: "הצעה נשלחה" })]);
  assert.equal(result.items.length, 0);
  assert.ok(result.warnings.some((warning) => warning.startsWith("proposal_no_next_step disabled")));
});

test("proposal with a future follow-up is not suggested", () => {
  const result = run([
    makeLead({ next_action_date: "2026-08-31T06:00:00.000Z", status: "הצעה נשלחה" }),
  ]);
  assert.equal(result.items.length, 0);
});

test("completed sales meeting rule remains disabled without a meetings model", () => {
  const result = run([makeLead({ status: "בתהליך שיחה" })]);
  assert.ok(result.warnings.some((warning) => warning.startsWith("sales_meeting_no_next_step disabled")));
  assert.equal(result.items.length, 0);
});

test("high-intent stalled rule remains disabled without a reliable activity timestamp", () => {
  const result = run([makeLead({ status: "הצעה נשלחה" })]);
  assert.ok(result.warnings.some((warning) => warning.startsWith("hot_lead_stalled disabled")));
});

for (const status of ["נסגר בהצלחה", "won", "lost"]) {
  test(`terminal status ${status} is never returned`, () => {
    const result = run([makeLead({ next_action_date: "2026-08-28T06:00:00.000Z", status })]);
    assert.equal(result.items.length, 0);
  });
}

test("disqualified status is never returned", () => {
  assert.equal(isTerminalLeadForFollowups("disqualified"), true);
  assert.equal(run([makeLead({ next_action_date: "2026-08-28T06:00:00.000Z", status: "disqualified" })]).items.length, 0);
});

test("archived and deleted statuses are never returned", () => {
  assert.equal(isTerminalLeadForFollowups("archived"), true);
  assert.equal(isTerminalLeadForFollowups("deleted"), true);
});

test("missing credential is unauthorized", () => {
  assert.deepEqual(getCredentialAccess(null), { code: "invalid", ok: false, status: 401 });
  assert.equal(parseBearerToken(null), null);
});

test("invalid credential format is unauthorized", () => {
  assert.equal(parseBearerToken("Bearer wrong-token"), null);
});

test("credential without scope is forbidden", () => {
  assert.deepEqual(getCredentialAccess(makeCredential({ scopes: [] })), {
    code: "missing_scope",
    ok: false,
    status: 403,
  });
});

test("revoked and expired credentials are unauthorized", () => {
  assert.equal(getCredentialAccess(makeCredential({ revoked_at: NOW.toISOString() }), NOW).ok, false);
  assert.equal(getCredentialAccess(makeCredential({ expires_at: "2026-08-29T06:59:59.000Z" }), NOW).ok, false);
});

test("valid bearer token is parsed and hashed deterministically", () => {
  const token = `gflf_${"a".repeat(64)}`;
  assert.equal(parseBearerToken(`Bearer ${token}`), token);
  assert.equal(hashLeadFollowupsToken(token), hashLeadFollowupsToken(token));
  assert.equal(hashLeadFollowupsToken(token).length, 64);
});

test("Business A evaluation returns only Business A leads", () => {
  const leadA = makeLead({ next_action_date: "2026-08-29T06:00:00.000Z" });
  const leadB = makeLead({
    id: "10000000-0000-4000-8000-000000000002",
    next_action_date: "2026-08-29T06:00:00.000Z",
    user_id: TENANT_B,
  });
  const result = run([leadA, leadB]);
  assert.deepEqual(result.items.map((item) => item.lead_id), [leadA.id]);
});

test("Business B task cannot create a follow-up for Business A", () => {
  const result = run([makeLead()], [makeTask({ user_id: TENANT_B })]);
  assert.equal(result.items.length, 0);
});

test("23:30 UTC follows the next Israel date", () => {
  assert.equal(getJerusalemDateKey(new Date("2026-08-29T20:30:00.000Z")), "2026-08-29");
  assert.equal(getJerusalemDateKey(new Date("2026-08-29T21:30:00.000Z")), "2026-08-30");
});

test("Israel midnight boundary is correct", () => {
  assert.equal(getJerusalemDateKey(new Date("2026-08-29T20:59:59.999Z")), "2026-08-29");
  assert.equal(getJerusalemDateKey(new Date("2026-08-29T21:00:00.000Z")), "2026-08-30");
});

test("DST-sensitive Jerusalem day uses a 23-hour boundary", () => {
  const bounds = getJerusalemDayBounds("2026-03-27");
  assert.equal(bounds.end.getTime() - bounds.start.getTime(), 23 * 60 * 60 * 1000);
});

test("invalid date format returns a 400-compatible parse error", () => {
  const result = parseLeadFollowupRequest(new URLSearchParams("date=29-08-2026"), NOW);
  assert.equal(result.ok, false);
});

test("limit over the hard maximum is rejected", () => {
  const result = parseLeadFollowupRequest(new URLSearchParams("limit=101"), NOW);
  assert.equal(result.ok, false);
});

test("same evaluation called twice does not mutate source data", () => {
  const leads = [makeLead({ next_action_date: "2026-08-29T06:00:00.000Z" })];
  const tasks = [makeTask()];
  const before = JSON.stringify({ leads, tasks });
  const first = run(leads, tasks);
  const second = run(leads, tasks);
  assert.equal(JSON.stringify({ leads, tasks }), before);
  assert.deepEqual(first, second);
});

test("response ordering is deterministic and oldest due comes first", () => {
  const later = makeLead({
    id: "10000000-0000-4000-8000-000000000010",
    next_action_date: "2026-08-29T06:00:00.000Z",
  });
  const earlier = makeLead({
    id: "10000000-0000-4000-8000-000000000011",
    next_action_date: "2026-08-27T06:00:00.000Z",
  });
  const result = run([later, earlier]);
  assert.deepEqual(result.items.map((item) => item.lead_id), [earlier.id, later.id]);
});

test("duplicate task and lead next-action produce one item per lead", () => {
  const result = run(
    [makeLead({ next_action_date: "2026-08-29T06:00:00.000Z" })],
    [makeTask({ due_date: "2026-08-29T05:00:00.000Z" })],
  );
  assert.equal(result.items.length, 1);
});

test("recovery is lower priority and opt-in", () => {
  const lead = makeLead({
    last_contact_date: "2026-08-01T06:00:00.000Z",
    status: "דורש המשך טיפול",
  });
  assert.equal(run([lead]).items.length, 0);
  const result = run([lead], [], { includeRecovery: true });
  assert.equal(result.items[0]?.followup_type, "recovery");
  assert.equal(result.items[0]?.priority, "P3");
});

test("cache policy prevents storing follow-up responses", () => {
  assert.match(LEAD_FOLLOWUPS_CACHE_CONTROL, /no-store/);
});
