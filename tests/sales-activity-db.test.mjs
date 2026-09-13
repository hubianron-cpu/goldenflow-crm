// Isolated local PostgreSQL only. No application env, Supabase URL, or remote credentials are read.
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import test, { before } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

const container = "gf-sales-activity-qa-20260913";
const database = `sales_activity_qa_${Date.now()}`;
const exec = promisify(execFile);
const args = ["exec", "-i", container, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-At"];
const sql = (input) => execFileSync("docker", args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = (n) => `set role authenticated; select set_config('request.jwt.claim.sub', '${id(n)}', false);`;
const call = (request, lead = 10, outcome = "no_answer", mode = "keep", date = "null") =>
  `select public.record_lead_sales_activity('${id(request)}','${id(lead)}','${outcome}','QA summary','${mode}',${mode === "schedule" ? "'call'" : "null"},${date});`;

before(async () => {
  const state = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8" }))[0];
  assert.equal(state.HostConfig.NetworkMode, "none");
  assert.equal(Object.keys(state.HostConfig.PortBindings ?? {}).length, 0);
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { execFileSync("docker", ["exec", container, "pg_isready", "-U", "postgres"], { stdio: "pipe" }); ready = true; break; }
    catch { await delay(500); }
  }
  assert.equal(ready, true, "Isolated PostgreSQL did not become ready within the bounded startup window");
  execFileSync("docker", ["exec", container, "createdb", "-U", "postgres", database]);
  sql(`
    do $$ begin
      if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin; end if;
    end $$;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
  `);
  sql(readFileSync("supabase/schema.sql", "utf8"));
  sql(`
    grant select, insert, update, delete on public.leads, public.tasks to authenticated;
    create table public.user_subscriptions(user_id uuid primary key, status text, trial_end_at timestamptz);
    alter table public.user_subscriptions enable row level security;
    create policy own_sub on public.user_subscriptions for select to authenticated using(user_id=auth.uid());
    grant select on public.user_subscriptions to authenticated;
    insert into auth.users(id) values ('${id(1)}'),('${id(2)}'),('${id(3)}');
    insert into public.user_subscriptions values ('${id(1)}','active',null),('${id(2)}','trial',now()+interval '14 days');
    insert into public.leads(id,user_id,full_name,phone,value,source,status,notes) values
      ('${id(10)}','${id(1)}','QA activity lead','0000000000',97,'QA','לידים חדשים','preserved note'),
      ('${id(11)}','${id(2)}','QA other tenant','0000000001',98,'QA','יצירת קשר','other note'),
      ('${id(12)}','${id(1)}','QA terminal','0000000002',99,'QA','נסגר בהצלחה','closed note'),
      ('${id(13)}','${id(1)}','QA rollback','0000000003',99,'QA','יצירת קשר','rollback note'),
      ('${id(14)}','${id(3)}','QA missing subscription','0000000004',99,'QA','יצירת קשר','');
    insert into public.tasks(id,user_id,title,linked_lead_id,is_automated) values
      ('${id(20)}','${id(1)}','QA manual task','${id(12)}',false),
      ('${id(21)}','${id(1)}','QA automated task','${id(10)}',true);
  `);
  sql(readFileSync("supabase/migrations/20260913002144_sales_activity_capture.sql", "utf8"));
});

test("activity readback and no-answer do not invent a completed call or advance stage", () => {
  sql(actor(1) + call(100));
  assert.equal(sql(actor(1) + `select activity_type||':'||outcome from public.lead_sales_activities where id='${id(100)}';`).split("\n").at(-1), "contact_attempt:לא ענה");
  assert.equal(sql(`select status||':'||(last_contact_date is null)::text||':'||notes||':'||value from public.leads where id='${id(10)}';`), "לידים חדשים:true:preserved note:97");
});
test("future follow-up exact timestamp is atomic, replay does not overwrite later scheduling", () => {
  sql(actor(1) + call(101, 10, "call", "schedule", "'2030-01-02T12:30:00+02:00'"));
  assert.equal(sql(`select (direction is null)::text from public.lead_sales_activities where id='${id(101)}'`), "true");
  assert.equal(sql(`select next_action_type||':'||to_char(next_action_date at time zone 'UTC','YYYY-MM-DD HH24:MI') from public.leads where id='${id(10)}'`), "call:2030-01-02 10:30");
  sql(actor(1) + call(102, 10, "later", "schedule", "'2030-02-02T10:00:00Z'"));
  sql(actor(1) + call(101, 10, "call", "schedule", "'2030-01-02T12:30:00+02:00'"));
  assert.equal(sql(`select extract(month from next_action_date) from public.leads where id='${id(10)}'`), "2");
  assert.equal(sql(`select count(*) from public.lead_sales_activities where id='${id(101)}'`), "1");
});
test("no follow-up clears only the lead fields and preserves both manual and automated tasks", () => {
  sql(actor(1) + call(103, 10, "whatsapp", "none"));
  assert.equal(sql(`select (next_action_date is null and next_action_type is null)::text from public.leads where id='${id(10)}'`), "true");
  assert.equal(sql("select count(*) from public.tasks"), "2");
});
test("closed lead history is allowed without changing lead or manual task, scheduling forbidden", () => {
  const before = sql(`select row_to_json(l) from public.leads l where id='${id(12)}'`);
  sql(actor(1) + call(104, 12, "irrelevant"));
  assert.equal(sql(`select row_to_json(l) from public.leads l where id='${id(12)}'`), before);
  assert.throws(() => sql(actor(1) + call(105, 12, "call", "schedule", "'2030-01-02T10:00Z'")), /Invalid next step/);
  assert.equal(sql(`select count(*) from public.tasks where linked_lead_id='${id(12)}' and status='פתוחה'`), "1");
});
test("two-tenant read/write isolation, anonymous denial, valid trial and missing subscription", () => {
  assert.equal(sql(actor(2) + "select count(*) from public.lead_sales_activities;").split("\n").at(-1), "0");
  assert.throws(() => sql(actor(2) + call(106, 10)), /Lead not found/);
  assert.throws(() => sql("set role anon;" + call(106)), /permission denied/);
  sql(actor(2) + call(107, 11));
  assert.throws(() => sql(actor(3) + call(108, 14)), /Subscription access required/);
  for (const status of ["expired", "cancelled", "trial"]) {
    sql(`update public.user_subscriptions set status='${status}',trial_end_at=now()-interval '1 day' where user_id='${id(2)}'`);
    assert.throws(() => sql(actor(2) + call(109, 11)), /Subscription access required/);
  }
});
test("duplicate concurrent submit creates exactly one activity; changed payload rejected", async () => {
  const command = actor(1) + call(110, 10, "offer");
  await Promise.all([exec("docker", [...args.filter((arg) => arg !== "-i"), "-c", command]), exec("docker", [...args.filter((arg) => arg !== "-i"), "-c", command])]);
  assert.equal(sql(`select count(*) from public.lead_sales_activities where id='${id(110)}'`), "1");
  assert.throws(() => sql(actor(1) + call(110, 10, "no_answer")), /Request already used/);
});
test("lead update failure rolls back activity insertion and malformed inputs write nothing", () => {
  sql(`create function public.qa_deny_update() returns trigger language plpgsql as $$ begin if new.id='${id(13)}' then raise exception 'QA forced failure'; end if; return new; end $$;
    create trigger qa_deny_update before update on public.leads for each row execute function public.qa_deny_update();`);
  assert.throws(() => sql(actor(1) + call(111, 13, "call")), /QA forced failure/);
  assert.equal(sql(`select count(*) from public.lead_sales_activities where id='${id(111)}'`), "0");
  assert.throws(() => sql(actor(1) + call(112, 10, "bad")), /Invalid activity/);
  assert.throws(() => sql(actor(1) + call(113, 10, "call", "schedule", "'2020-01-01Z'")), /Invalid next step|invalid input syntax/);
  assert.equal(sql(`select count(*) from public.lead_sales_activities where id in ('${id(112)}','${id(113)}')`), "0");
});
