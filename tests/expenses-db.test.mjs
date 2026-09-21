// Local PostgreSQL only. No application env, remote URL or real users are used.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test, { before } from "node:test";

const container = "gf-sales-activity-qa-20260913";
const database = `expenses_qa_${Date.now()}`;
const id = n => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sql = input => execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-At"], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const asOwner = n => `set role authenticated; select set_config('request.jwt.claim.sub','${id(n)}',false);`;
const scalar = input => sql(input).split("\n").at(-1);
const event = (amount = 50000) => ({ event_id: "qa-event", title: "QA meeting expense", starts_at: "2026-09-21T10:00:00Z", ends_at: "2026-09-21T11:00:00Z", event_date: "2026-09-21", all_day: false, amount_agorot: amount, is_meeting: true });
const publish = (events, generation = 10) => `set role service_role; select public.publish_calendar_snapshot('${id(1)}','${id(generation)}','${JSON.stringify(events)}','Asia/Jerusalem','2026-12-31');`;

before(() => {
  const state = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8" }))[0];
  assert.equal(state.HostConfig.NetworkMode, "none");
  assert.equal(Object.keys(state.HostConfig.PortBindings ?? {}).length, 0);
  execFileSync("docker", ["exec", container, "createdb", "-U", "postgres", database]);
  sql(`create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon,service_role;
    insert into auth.users values ('${id(1)}'),('${id(2)}');`);
  sql(readFileSync("supabase/migrations/20260919211839_shared_calendar_expenses.sql", "utf8"));
  sql(`insert into public.manual_expenses(id,user_id,title,amount_agorot,due_date) values
    ('${id(3)}','${id(1)}','QA A',10000,'2026-09-21'),('${id(4)}','${id(2)}','QA B',20000,'2026-09-21');
    insert into public.google_calendar_connections(user_id,generation,token_ciphertext) values ('${id(1)}','${id(10)}','encrypted-synthetic');`);
});
test("migration enables RLS and exact grants on all new tables", () => {
  assert.equal(scalar("select count(*) from pg_class where relname in ('manual_expenses','google_calendar_connections','google_calendar_events') and relrowsecurity"), "3");
  assert.equal(scalar("select has_table_privilege('authenticated','public.google_calendar_connections','SELECT')"), "f");
  assert.equal(scalar("select has_function_privilege('authenticated','public.publish_calendar_snapshot(uuid,uuid,jsonb,text,date)','EXECUTE')"), "f");
});
test("tenant A cannot read, edit, delete or reassign B expenses", () => {
  assert.equal(scalar(`${asOwner(1)} select count(*) from public.manual_expenses;`), "1");
  assert.equal(scalar(`${asOwner(1)} with changed as (update public.manual_expenses set title='BAD' where id='${id(4)}' returning *) select count(*) from changed;`), "0");
  assert.equal(scalar(`${asOwner(1)} with changed as (delete from public.manual_expenses where id='${id(4)}' returning *) select count(*) from changed;`), "0");
  assert.throws(() => sql(`${asOwner(1)} update public.manual_expenses set user_id='${id(2)}' where id='${id(3)}';`));
  assert.throws(() => sql(`${asOwner(1)} insert into public.manual_expenses(user_id,title,amount_agorot,due_date) values ('${id(2)}','BAD',1,current_date);`));
  assert.throws(() => sql("set role anon; select * from public.manual_expenses;"));
});
test("manual create edit paid cancelled delete; duplicate request id rejected", () => {
  sql(`${asOwner(1)} insert into public.manual_expenses(id,user_id,title,amount_agorot,due_date) values ('${id(5)}','${id(1)}','QA new',101,current_date);`);
  assert.throws(() => sql(`${asOwner(1)} insert into public.manual_expenses(id,user_id,title,amount_agorot,due_date) values ('${id(5)}','${id(1)}','QA duplicate',101,current_date);`));
  for (const status of ["paid", "cancelled", "planned"]) {
    assert.equal(scalar(`${asOwner(1)} update public.manual_expenses set status='${status}',title='QA edited' where id='${id(5)}'; select status from public.manual_expenses where id='${id(5)}';`), status);
  }
  sql(`${asOwner(1)} delete from public.manual_expenses where id='${id(5)}';`);
  assert.equal(scalar(`select count(*) from public.manual_expenses where id='${id(5)}'`), "0");
});
test("atomic snapshots update without duplicates, preserve overrides, isolate readers", () => {
  assert.equal(scalar(publish([event()])), "t");
  assert.equal(scalar(publish([event()])), "t");
  assert.equal(scalar("select count(*) from public.google_calendar_events"), "1");
  assert.equal(scalar(`${asOwner(2)} select count(*) from public.google_calendar_events`), "0");
  assert.throws(() => sql(`${asOwner(1)} select token_ciphertext from public.google_calendar_connections;`));
  assert.throws(() => sql(`${asOwner(1)} update public.google_calendar_events set title='BAD';`));
  sql("update public.google_calendar_events set expense_status='paid'");
  assert.equal(scalar(publish([{ ...event(65000), event_date: "2026-09-22" }])), "t");
  assert.equal(scalar("select amount_agorot||':'||expense_status||':'||event_date from public.google_calendar_events"), "65000:paid:2026-09-22");
  assert.equal(scalar(publish([event(null)])), "t");
  assert.equal(scalar("select count(*) from public.google_calendar_events where amount_agorot is not null"), "0");
  assert.equal(scalar(publish([])), "t");
  assert.equal(scalar("select count(*) from public.google_calendar_events"), "0");
  assert.equal(scalar("select count(*) from public.manual_expenses"), "2");
});
test("bad snapshot rolls back; stale generation and disconnect cannot republish", () => {
  sql(publish([event()]));
  assert.throws(() => sql(publish([event(), { ...event(), event_id: "bad", amount_agorot: -1 }])));
  assert.equal(scalar("select count(*) from public.google_calendar_events"), "1");
  assert.equal(scalar(publish([], 99)), "f");
  assert.equal(scalar("select count(*) from public.google_calendar_events"), "1");
  sql(`delete from public.google_calendar_connections where user_id='${id(1)}'`);
  assert.equal(scalar(publish([event()])), "f");
  assert.equal(scalar("select count(*) from public.google_calendar_events"), "0");
  assert.equal(scalar("select count(*) from public.manual_expenses"), "2");
});
