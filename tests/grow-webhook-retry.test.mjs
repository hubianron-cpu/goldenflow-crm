// Test the real release route's RPC boundary; DB behavior is verified separately on Postgres.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as crypto from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const id = "11111111-1111-4111-8111-111111111111";
const email = "qa-grow@example.com";
function harness(result = { ok: true, status: "active" }, rpcError = false) {
  const calls = [];
  const modules = new Map();
  function load(file) {
    if (modules.has(file)) return modules.get(file);
    const exports = {};
    modules.set(file, exports);
    vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, Buffer, Date, URL, URLSearchParams,
      process: { env: { GROW_WEBHOOK_KEY: "offline-key", SUPABASE_SERVICE_ROLE_KEY: "offline-key",
        NEXT_PUBLIC_SUPABASE_URL: "https://staging.invalid", AFFILIATE_TRACKING_ENABLED: "true" } },
      console: { info() {}, error() {} },
      require(name) {
        if (name === "crypto" || name === "node:crypto") return crypto;
        if (name === "next/server") return { NextResponse: { json: (body, init) => Response.json(body, init) } };
        if (name === "@supabase/supabase-js") return { createClient: () => ({
          auth: { admin: {
            getUserById: async () => ({ data: { user: { id, email } }, error: null }),
            listUsers: async () => ({ data: { users: [{ id, email }] }, error: null }),
          } },
          from() { throw new Error("Release processing must not fall back to separate DB writes"); },
          async rpc(name, args) {
            calls.push({ name, args: JSON.parse(JSON.stringify(args)) });
            return { data: result, error: rpcError ? { code: "offline_failure" } : null };
          },
        }) };
        if (name.startsWith("@/lib/")) return load(name.replace("@/", "") + ".ts");
        throw new Error("Unexpected import " + name);
      },
    }, { filename: file });
    return exports;
  }
  const route = load("app/api/webhooks/grow/route.ts");
  return { calls, async send(overrides = {}, key = "offline-key") {
    const payload = { status: 1, err: "", user_id: id, data: {
      statusCode: 2, status: "paid", sum: 1, transactionId: "tx-offline", payerEmail: email,
    }, ...overrides };
    const response = await route.POST(new Request("https://crm.invalid/api/webhooks/grow", {
      method: "POST", headers: { "content-type": "application/json", "x-webhook-key": key },
      body: JSON.stringify(payload),
    }));
    return { status: response.status, body: await response.json() };
  } };
}
test("actual Grow paid envelope is passed unchanged in meaning to one atomic RPC", async () => {
  const h = harness();
  assert.equal((await h.send()).body.status, "active");
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].name, "process_grow_callback");
  const { args } = h.calls[0];
  assert.equal(args.p_user_id, id);
  assert.equal(args.p_event.outcome, "paid");
  assert.equal(args.p_event.amount, 1);
  assert.equal(args.p_event.email_matches, true);
  assert.equal(args.p_event.affiliate_enabled, true);
  assert.ok(!JSON.stringify(args).includes(email));
  assert.ok(!JSON.stringify(args).includes("offline-key"));
});
for (const [status, code, outcome] of [["pending", 1, "ignored"], ["declined", 3, "failed"]]) {
  test(status + " is not rewritten to successful payment", async () => {
    const h = harness();
    await h.send({ data: { statusCode: code, status, transactionId: "tx-offline", payerEmail: email } });
    assert.equal(h.calls[0].args.p_event.outcome, outcome);
  });
}
test("legacy success still uses the atomic RPC", async () => {
  const h = harness(); await h.send({ status: "success" });
  assert.equal(h.calls[0].args.p_event.outcome, "paid");
});
test("verified duplicate result is returned without extra processing", async () => {
  const result = { ok: true, duplicate: true, duplicate_verified: true, status: "active" };
  const h = harness(result);
  assert.deepEqual((await h.send()).body, result);
  assert.equal(h.calls.length, 1);
});
test("DB identity conflict is returned as HTTP 409", async () => {
  const h = harness({ error: "Transaction identity conflict", http_status: 409 });
  assert.deepEqual(await h.send(), { status: 409, body: { error: "Transaction identity conflict" } });
});
test("RPC failure fails closed without fallback activation", async () => {
  const h = harness(null, true);
  assert.equal((await h.send()).status, 500);
  assert.equal(h.calls.length, 1);
});
test("invalid webhook key cannot call the database", async () => {
  const h = harness();
  assert.equal((await h.send({}, "wrong-key")).status, 401);
  assert.equal(h.calls.length, 0);
});
test("missing transaction ID is rejected rather than processing without idempotency", async () => {
  const h = harness();
  assert.equal((await h.send({ data: { statusCode: 2, sum: 1, payerEmail: email } })).status, 400);
  assert.equal(h.calls.length, 0);
});
test("mismatched payer email is explicitly passed as an identity failure", async () => {
  const h = harness();
  await h.send({ data: { statusCode: 2, transactionId: "tx-offline", sum: 1, payerEmail: "other@example.com" } });
  assert.equal(h.calls[0].args.p_event.email_matches, false);
});
