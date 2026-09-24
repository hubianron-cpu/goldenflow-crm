import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { closeCrmAccountInOrder } from "../lib/account-closure/order.mjs";

const STAGING_URL = "https://pzxwaoghixsqcstfrorn.supabase.co";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (url !== STAGING_URL || !key || process.env.CRM_ACCOUNT_DELETION_QA !== "synthetic-staging-only") {
  throw new Error("QA requires the exact CRM Staging URL, a server key, and an explicit synthetic-only flag");
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const marker = randomUUID();
const email = `codex-crm-deletion-${marker}@example.invalid`;
const ids = { user: null, lead: null, content: null, attribution: null, roi: null, task: null, expense: null, credential: null, outbox: null, calendarEvent: null, activation: null, event: null, audit: null };
let authDeleted = false;

function checked(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data;
}

async function count(table, column, value, selectColumn = "id") {
  const result = await admin.from(table).select(selectColumn, { count: "exact", head: true }).eq(column, value);
  checked(result, `count ${table}`);
  return result.count;
}

async function cleanup() {
  if (ids.audit) checked(await admin.from("grow_webhook_events").delete().eq("id", ids.audit), "cleanup audit");
  if (!authDeleted && ids.user) {
    if (ids.calendarEvent) checked(await admin.from("google_calendar_events").delete().eq("user_id", ids.user).eq("event_id", ids.calendarEvent), "cleanup calendar event");
    checked(await admin.from("google_calendar_connections").delete().eq("user_id", ids.user), "cleanup calendar connection");
    if (ids.event) checked(await admin.from("client_activation_events").delete().eq("id", ids.event), "cleanup activation event");
    if (ids.activation) checked(await admin.from("client_activations").delete().eq("id", ids.activation).eq("business_id", ids.user), "cleanup activation");
    if (ids.outbox) checked(await admin.from("crm_client_activation_outbox").delete().eq("id", ids.outbox), "cleanup outbox");
    if (ids.credential) checked(await admin.from("agent_integration_credentials").delete().eq("id", ids.credential), "cleanup credential");
    if (ids.expense) checked(await admin.from("manual_expenses").delete().eq("id", ids.expense), "cleanup expense");
    if (ids.task) checked(await admin.from("tasks").delete().eq("id", ids.task).eq("user_id", ids.user), "cleanup task");
    if (ids.attribution) checked(await admin.from("business_center_lead_attributions").delete().eq("id", ids.attribution), "cleanup attribution");
    if (ids.content) checked(await admin.from("business_center_content_items").delete().eq("id", ids.content), "cleanup content");
    if (ids.roi) checked(await admin.from("roi_tools").delete().eq("id", ids.roi), "cleanup ROI tool");
    if (ids.lead) checked(await admin.from("leads").delete().eq("id", ids.lead).eq("user_id", ids.user), "cleanup lead");
    checked(await admin.auth.admin.deleteUser(ids.user), "cleanup synthetic Auth user");
  }
}

try {
  const created = checked(await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: randomBytes(32).toString("base64url"),
  }), "create synthetic Auth user");
  assert.ok(created.user?.id);
  ids.user = created.user.id;

  const lead = checked(await admin.from("leads").insert({ user_id: ids.user, full_name: "Synthetic Account Deletion QA" }).select("id").single(), "create synthetic lead");
  ids.lead = lead.id;
  const roi = checked(await admin.from("roi_tools").insert({ user_id: ids.user, name: "Synthetic Account Deletion QA" }).select("id").single(), "create synthetic ROI tool");
  ids.roi = roi.id;
  const content = checked(await admin.from("business_center_content_items").insert({
    user_id: ids.user,
    title: "Synthetic Account Deletion QA",
    platform: "Other",
    content_type: "Other",
  }).select("id").single(), "create synthetic content");
  ids.content = content.id;
  const attribution = checked(await admin.from("business_center_lead_attributions").insert({
    user_id: ids.user,
    lead_id: ids.lead,
    content_item_id: ids.content,
  }).select("id").single(), "create synthetic attribution");
  ids.attribution = attribution.id;
  const standaloneDelete = await admin.from("business_center_content_items").delete().eq("id", ids.content);
  assert.equal(standaloneDelete.error?.code, "23503", "attributed content must not be deleted alone");
  assert.equal(await count("business_center_content_items", "id", ids.content), 1);
  assert.equal(await count("business_center_lead_attributions", "id", ids.attribution), 1);
  const task = checked(await admin.from("tasks").insert({ user_id: ids.user, title: "Synthetic account deletion QA", linked_lead_id: ids.lead }).select("id").single(), "create synthetic task");
  ids.task = task.id;
  const expense = checked(await admin.from("manual_expenses").insert({ user_id: ids.user, title: "Synthetic account deletion QA", amount_agorot: 50000, due_date: "2026-09-24" }).select("id").single(), "create synthetic expense");
  ids.expense = expense.id;
  const credential = checked(await admin.from("agent_integration_credentials").insert({
    user_id: ids.user,
    name: "Synthetic account deletion QA",
    token_prefix: `gflf_${randomBytes(6).toString("hex")}`,
    token_hash: randomBytes(32).toString("hex"),
    scopes: ["lead_followups:read"],
  }).select("id").single(), "create synthetic credential");
  ids.credential = credential.id;
  const outbox = checked(await admin.from("crm_client_activation_outbox").insert({ user_id: ids.user, lead_id: ids.lead }).select("id").single(), "create synthetic outbox");
  ids.outbox = outbox.id;
  checked(await admin.from("google_calendar_connections").insert({ user_id: ids.user }), "create synthetic local calendar connection");
  ids.calendarEvent = `synthetic-qa-${marker}`;
  checked(await admin.from("google_calendar_events").insert({
    user_id: ids.user,
    event_id: ids.calendarEvent,
    title: "Synthetic account deletion QA",
    starts_at: "2026-09-24T10:00:00Z",
    ends_at: "2026-09-24T11:00:00Z",
    event_date: "2026-09-24",
    all_day: false,
    amount_agorot: 50000,
    is_meeting: true,
  }), "create synthetic local calendar event");
  const activation = checked(await admin.from("client_activations").insert({
    business_id: ids.user,
    crm_deal_id: ids.lead,
    crm_client_id: randomUUID(),
    full_name: "Synthetic Account Deletion QA",
  }).select("id").single(), "create synthetic activation");
  ids.activation = activation.id;
  const event = checked(await admin.from("client_activation_events").insert({
    activation_id: ids.activation,
    event_type: "synthetic_qa",
    event_key: marker,
  }).select("id").single(), "create synthetic activation event");
  ids.event = event.id;
  const audit = checked(await admin.from("grow_webhook_events").insert({
    transaction_code: `synthetic-qa-${marker}`,
    event_type: "synthetic_qa",
    user_id: ids.user,
    payload: { schema_version: 1, payment_date: null, payment_sum: null },
  }).select("id").single(), "create synthetic payment audit");
  ids.audit = audit.id;

  assert.equal(await count("client_activations", "business_id", ids.user), 1);
  await closeCrmAccountInOrder(ids.user, email, {
    async getUser(id) {
      return checked(await admin.auth.admin.getUserById(id), "verify synthetic Auth identity").user;
    },
    async disconnectCalendar(id) {
      // This synthetic row has no Google token. Live revocation is a separate QA gate.
      checked(await admin.from("google_calendar_connections").delete().eq("user_id", id), "disconnect synthetic calendar");
    },
    async hasCalendarConnection(id) {
      return (await count("google_calendar_connections", "user_id", id, "user_id")) !== 0;
    },
    async deleteAuthUser(id) {
      checked(await admin.auth.admin.deleteUser(id), "delete synthetic Auth user");
    },
  });
  authDeleted = true;

  const deletedAuth = await admin.auth.admin.getUserById(ids.user);
  assert.ok(deletedAuth.error || !deletedAuth.data.user, "synthetic Auth user must be gone");
  assert.equal(await count("users", "id", ids.user), 0);
  assert.equal(await count("leads", "user_id", ids.user), 0);
  assert.equal(await count("business_center_content_items", "user_id", ids.user), 0);
  assert.equal(await count("business_center_lead_attributions", "user_id", ids.user), 0);
  assert.equal(await count("roi_tools", "user_id", ids.user), 0);
  assert.equal(await count("tasks", "user_id", ids.user), 0);
  assert.equal(await count("manual_expenses", "user_id", ids.user), 0);
  assert.equal(await count("agent_integration_credentials", "user_id", ids.user), 0);
  assert.equal(await count("crm_client_activation_outbox", "user_id", ids.user), 0);
  assert.equal(await count("google_calendar_connections", "user_id", ids.user, "user_id"), 0);
  assert.equal(await count("google_calendar_events", "user_id", ids.user, "user_id"), 0);
  assert.equal(await count("client_activations", "business_id", ids.user), 0);
  assert.equal(await count("client_activation_events", "activation_id", ids.activation), 0);

  const retained = checked(await admin.from("grow_webhook_events").select("user_id,payload").eq("id", ids.audit).single(), "verify minimized audit");
  assert.equal(retained.user_id, null);
  assert.deepEqual(Object.keys(retained.payload).sort(), ["payment_date", "payment_sum", "schema_version"]);
  console.log("CRM_STAGING_SYNTHETIC_DELETION_OK=true");
} finally {
  await cleanup();
  if (ids.user) {
    assert.equal(await count("client_activations", "business_id", ids.user), 0);
    assert.equal(await count("business_center_content_items", "id", ids.content), 0);
    assert.equal(await count("business_center_lead_attributions", "id", ids.attribution), 0);
    assert.equal(await count("roi_tools", "id", ids.roi), 0);
    assert.equal(await count("grow_webhook_events", "id", ids.audit), 0);
    console.log("CRM_STAGING_SYNTHETIC_CLEANUP_OK=true");
  }
}
