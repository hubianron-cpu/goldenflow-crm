// Real server module with synthetic Google transport/DB adapter; no network or secrets.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import test from "node:test";
const require = createRequire(import.meta.url);
const model = require("../.test-dist/lib/expenses/model.js");
const crypto = require("../.test-dist/lib/calendar/crypto.js");
function harness() {
  const rows = new Map(), snapshots = [], calls = [];
  let failure = "", eventTitle = "פגישה עם רואה חשבון - 500 ₪", tokenCalls = 0;
  const admin = {
    from(name) {
      assert.equal(name, "google_calendar_connections");
      let op = "read", values = {}, filters = [];
      const query = {
        select() { return query; },
        eq(k,v) { filters.push(r => r[k] === v); return query; },
        lt(k,v) { filters.push(r => Date.parse(r[k]) < Date.parse(v)); return query; },
        upsert(v) { op = "upsert"; values = v; return query; },
        update(v) { op = "update"; values = v; return query; },
        delete() { op = "delete"; return query; },
        async maybeSingle() { return query.run(); },
        then(resolve, reject) { return Promise.resolve(query.run()).then(resolve, reject); },
        run() {
          if (op === "upsert") {
            rows.set(values.user_id, { generation: "original", token_ciphertext: null, time_zone: "Asia/Jerusalem", reconnect_required: false, sync_lease_until: new Date(0).toISOString(), ...rows.get(values.user_id), ...values });
            return { data: null, error: null };
          }
          const row = [...rows.values()].find(r => filters.every(f => f(r)));
          if (!row) return { data: op === "delete" ? [] : null, error: null };
          if (op === "update") Object.assign(row, values);
          if (op === "delete") {
            rows.delete(row.user_id);
            return { data: [structuredClone(row)], error: null };
          }
          return { data: structuredClone(row), error: null };
        },
      };
      return query;
    },
    async rpc(name, args) { assert.equal(name, "publish_calendar_snapshot"); snapshots.push(args); return { data: true, error: null }; },
  };
  const source = ts.transpileModule(readFileSync("lib/calendar/server.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  const env = { GOOGLE_CALENDAR_CLIENT_ID: "synthetic-client", GOOGLE_CALENDAR_CLIENT_SECRET: "synthetic-secret", GOOGLE_CALENDAR_REDIRECT_URI: "http://localhost:3001/api/calendar/callback", CALENDAR_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"), SUPABASE_SERVICE_ROLE_KEY: "synthetic-service" };
  vm.runInNewContext(source, {
    exports, Buffer, URL, URLSearchParams, AbortSignal, process: { env },
    require(name) {
      if (name === "server-only") return {};
      if (name === "@/lib/supabase/admin") return { getSupabaseAdminClient: () => admin };
      if (name === "./crypto") return crypto;
      if (name === "@/lib/expenses/model") return model;
      if (name === "node:crypto") return require(name);
      throw new Error(`Unexpected import ${name}`);
    },
    async fetch(url, options) {
      calls.push(String(url));
      if (String(url).includes("/token")) {
        tokenCalls++;
        if (failure === "revoked") return { ok: false, json: async () => ({ error: "invalid_grant" }) };
        const grant = options.body.get("grant_type");
        if (grant === "authorization_code") assert.ok(options.body.get("code_verifier"));
        return { ok: true, json: async () => ({ access_token: "synthetic-access", refresh_token: "synthetic-refresh", scope: "https://www.googleapis.com/auth/calendar.events.readonly" }) };
      }
      if (String(url).includes("/revoke")) {
        if (failure === "reconnect-on-revoke") {
          rows.get("QA-A").generation = "reconnected";
          return { ok: true };
        }
        if (failure === "revoke-network") throw new Error("synthetic transport failure");
        if (failure === "revoke-http") return { ok: false, status: 503, json: async () => ({ error: "unavailable" }) };
        if (failure === "revoke-invalid-token") return { ok: false, status: 400, json: async () => ({ error: "invalid_token" }) };
        return { ok: true };
      }
      const parsed = new URL(url);
      assert.equal(parsed.origin, "https://www.googleapis.com");
      assert.equal(parsed.searchParams.get("singleEvents"), "true");
      if (failure === "page" && parsed.searchParams.has("pageToken")) return { ok: false, status: 500 };
      return { ok: true, json: async () => ({ timeZone: "Asia/Jerusalem", ...(failure === "page" ? { nextPageToken: "page2" } : {}), items: [{ id: "one", summary: eventTitle, start: { dateTime: "2026-09-21T10:00:00+03:00" }, end: { dateTime: "2026-09-21T11:00:00+03:00" } }] }) };
    },
  });
  return { api: exports, rows, snapshots, calls, setFailure: value => failure = value, setTitle: value => eventTitle = value, tokenCalls: () => tokenCalls };
}

test("OAuth state is user-bound, expiring, single-use; tokens encrypted, scope read-only", async () => {
  const h = harness();
  const { state, url } = await h.api.startConnection("QA-A");
  const params = new URL(url).searchParams;
  assert.equal(params.get("scope"), "https://www.googleapis.com/auth/calendar.events.readonly");
  assert.equal(params.get("code_challenge_method"), "S256");
  assert.notEqual(h.rows.get("QA-A").oauth_state_hash, state);
  await assert.rejects(h.api.finishConnection("QA-B", "code", state));
  await assert.rejects(h.api.finishConnection("QA-A", "code", "wrong-state"));
  assert.equal(h.tokenCalls(), 0);
  await h.api.finishConnection("QA-A", "code", state);
  assert.ok(h.rows.get("QA-A").token_ciphertext);
  assert.ok(!h.rows.get("QA-A").token_ciphertext.includes("synthetic-refresh"));
  await assert.rejects(h.api.finishConnection("QA-A", "code", state));
  assert.equal(h.tokenCalls(), 1);
  const again = await h.api.startConnection("QA-A");
  h.rows.get("QA-A").oauth_expires_at = new Date(0).toISOString();
  await assert.rejects(h.api.finishConnection("QA-A", "code", again.state));
});
test("shared sync drives both consumers; partial provider failure never publishes", async () => {
  const h = harness(); const auth = await h.api.startConnection("QA-A");
  await h.api.finishConnection("QA-A", "code", auth.state);
  await h.api.syncCalendar("QA-A");
  assert.equal(h.snapshots.length, 1);
  assert.equal(h.snapshots[0].p_events.length, 1);
  assert.equal(h.snapshots[0].p_events[0].amount_agorot, 50000);
  assert.equal(h.snapshots[0].p_events[0].is_meeting, true);
  h.setTitle("פגישה"); await h.api.syncCalendar("QA-A");
  assert.equal(h.snapshots[1].p_events[0].amount_agorot, null);
  h.setFailure("page"); await assert.rejects(h.api.syncCalendar("QA-A"));
  assert.equal(h.snapshots.length, 2);
  assert.ok(Date.parse(h.rows.get("QA-A").sync_lease_until) < Date.now());
});
test("revoked grants require reconnect; sync lease prevents overlap; disconnect revokes", async () => {
  const h = harness();
  assert.equal(await h.api.disconnectCalendar("QA-A"), false);
  let auth = await h.api.startConnection("QA-A");
  await h.api.finishConnection("QA-A", "code", auth.state);
  h.rows.get("QA-A").sync_lease_until = new Date(Date.now() + 60000).toISOString();
  await assert.rejects(h.api.syncCalendar("QA-A"));
  h.rows.get("QA-A").sync_lease_until = new Date(0).toISOString();
  h.setFailure("revoked"); await assert.rejects(h.api.syncCalendar("QA-A"));
  assert.equal(h.rows.get("QA-A").reconnect_required, true);
  assert.equal(h.rows.get("QA-A").token_ciphertext, null);
  h.setFailure(""); auth = await h.api.startConnection("QA-A");
  await h.api.finishConnection("QA-A", "code", auth.state);
  assert.equal(h.rows.get("QA-A").reconnect_required, false);
  assert.equal(await h.api.disconnectCalendar("QA-A"), true);
  assert.equal(h.rows.has("QA-A"), false);
  assert.ok(h.calls.includes("https://oauth2.googleapis.com/revoke"));
});
test("disconnect retains encrypted credentials until Google revocation succeeds", async () => {
  const h = harness(); const auth = await h.api.startConnection("QA-A");
  await h.api.finishConnection("QA-A", "code", auth.state);
  const encrypted = h.rows.get("QA-A").token_ciphertext;
  h.setFailure("revoke-http");
  await assert.rejects(h.api.disconnectCalendar("QA-A"), /could not be revoked/);
  assert.equal(h.rows.get("QA-A").token_ciphertext, encrypted);
  h.setFailure("revoke-network");
  await assert.rejects(h.api.disconnectCalendar("QA-A"), /could not be revoked/);
  assert.equal(h.rows.get("QA-A").token_ciphertext, encrypted);
  h.setFailure("revoke-invalid-token");
  await h.api.disconnectCalendar("QA-A");
  assert.equal(h.rows.has("QA-A"), false);
});
test("disconnect does not delete a connection replaced while revocation runs", async () => {
  const h = harness(); const auth = await h.api.startConnection("QA-A");
  await h.api.finishConnection("QA-A", "code", auth.state);
  h.setFailure("reconnect-on-revoke");
  await assert.rejects(h.api.disconnectCalendar("QA-A"), /Connection changed/);
  assert.equal(h.rows.get("QA-A").generation, "reconnected");
});
