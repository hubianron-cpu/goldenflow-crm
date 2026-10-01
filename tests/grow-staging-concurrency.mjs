// Opt-in live Staging test. Credentials stay in memory and are never logged or saved.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as crypto from "node:crypto";
import ts from "typescript";

const stagingUrl = "https://pzxwaoghixsqcstfrorn.supabase.co";
const fixtureId = process.argv[2];
assert.match(fixtureId || "", /^[0-9a-f-]{36}$/);
const nonce = randomUUID();
let phase = "credentials";

async function run(key) {
  phase = "fixture-auth";
  const client = createClient(stagingUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.admin.getUserById(fixtureId);
  if (error) {
    const safeCode = /^[a-z0-9_]+$/i.test(error.code || "") ? error.code : "unknown";
    phase = `fixture-auth-status-${Number(error.status) || 0}-code-${safeCode}`;
  }
  assert.ifError(error);
  phase = "fixture-email-guard";
  assert.match(data.user?.email || "", /^qa-grow-atomic-[0-9a-f-]+@example\.com$/);
  const email = data.user.email;
  const code = `qa-atomic-parallel-${fixtureId}`;
  const env = { NEXT_PUBLIC_SUPABASE_URL: stagingUrl, SUPABASE_SERVICE_ROLE_KEY: key,
    GROW_WEBHOOK_KEY: nonce, AFFILIATE_TRACKING_ENABLED: "true" };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, Date, Buffer, URL, URLSearchParams, process: { env },
      console: { info() {}, error() {} }, require(name) {
        if (name === "crypto" || name === "node:crypto") return crypto;
        if (name === "next/server") return { NextResponse: { json: (body, init) => Response.json(body, init) } };
        if (name === "@supabase/supabase-js") return { createClient: (url, secret) => {
          assert.equal(url, stagingUrl); assert.equal(secret, key); return client;
        } };
        if (name.startsWith("@/lib/")) return load(name.replace("@/", "") + ".ts");
        throw new Error("Unexpected release import");
      } }, { filename: file });
    return exports;
  }
  phase = "load-release-route";
  const route = load("app/api/webhooks/grow/route.ts");
  async function send(status = "paid", statusCode = 2, transactionId = code) {
    const response = await route.POST(new Request("https://qa.invalid/api/webhooks/grow", {
      method: "POST", headers: { "content-type": "application/json", "x-webhook-key": nonce },
      body: JSON.stringify({ status: 1, err: "", user_id: fixtureId,
        data: { status, statusCode, transactionId, payerEmail: email, sum: 1 } }),
    }));
    if (response.status !== 200) phase = `callback-http-${response.status}`;
    assert.equal(response.status, 200);
    return response.json();
  }
  async function snapshot() {
    const [s, a, g] = await Promise.all([
      client.from("user_subscriptions").select("*").eq("user_id",fixtureId).single(),
      client.from("affiliate_referrals").select("*").eq("user_id",fixtureId).single(),
      client.from("grow_webhook_events").select("*").eq("transaction_code",code).single(),
    ]);
    for (const result of [s,a,g]) assert.ifError(result.error);
    return { subscription:s.data, referral:a.data, event:g.data };
  }
  phase = "parallel-first-payment";
  const results = await Promise.all(Array.from({ length: 20 }, () => send()));
  assert.equal(results.filter(r => r.status === "active" && !r.duplicate).length,1);
  assert.equal(results.filter(r => r.duplicate_verified === true).length,19);
  phase = "first-payment-snapshot";
  const before = await snapshot();
  assert.equal(before.event.event_type,"subscription_activated");
  assert.equal(before.referral.conversion_transaction_code,code);
  phase = "parallel-retries";
  const retries = await Promise.all(Array.from({ length: 10 }, () => send()));
  assert.ok(retries.every(r => r.duplicate_verified === true));
  assert.deepEqual(await snapshot(),before);
  phase = "late-failure";
  await Promise.all([send("declined",3),send("paid",2)]);
  assert.deepEqual(await snapshot(),before);
  phase = "pending-failed-paid-transition";
  const secondCode = code + "-transition";
  assert.equal((await send("pending",1,secondCode)).ignored,true);
  assert.equal((await send("declined",3,secondCode)).status,"payment_failed");
  const promoted = await Promise.all(Array.from({ length: 10 }, () => send("paid",2,secondCode)));
  assert.equal(promoted.filter(r => !r.duplicate && r.status === "active").length,1);
  assert.equal(promoted.filter(r => r.duplicate_verified).length,9);
  const referral = await client.from("affiliate_referrals").select("*").eq("user_id",fixtureId).single();
  assert.ifError(referral.error);
  assert.deepEqual(referral.data,before.referral);
  return { passed:true, simultaneous_callbacks:20, processed_once:1, verified_duplicates:19,
    parallel_retry_zero_writes:true, late_failure_preserved:true, pending_failed_paid_transition:true,
    affiliate_conversion_unchanged:true, target:"pzxwaoghixsqcstfrorn", fixture_id:fixtureId };
}

const server = createServer(async (request,response) => {
  if (request.url !== `/${nonce}`) { response.writeHead(404).end(); return; }
  if (request.method === "GET") {
    response.writeHead(200,{"content-type":"text/html","cache-control":"no-store"});
    response.end('<h1>CRM Staging atomic QA</h1><p>Staging only. Key stays in RAM.</p><form method="post"><input name="key" type="password" autocomplete="off" aria-label="Staging key"><button>Run Staging QA</button></form>');
    return;
  }
  if (request.method !== "POST" || request.headers.origin !== "http://127.0.0.1:3189") {
    response.writeHead(403).end(); return;
  }
  let body="";
  for await (const chunk of request) { body+=chunk; if(body.length>8192) { response.writeHead(413).end();return; } }
  const key=(new URLSearchParams(body).get("key") || "").trim();
  if (!/^(sb_secret_|eyJ)/.test(key)) {
    console.error(`STAGING_QA_INPUT_INVALID empty=${key.length === 0}; no credential output`);
    response.writeHead(400,{"content-type":"text/html","cache-control":"no-store"});
    response.end('<h1>Key not accepted</h1><p>Paste the complete Staging secret key (sb_secret_ or legacy service_role). No key was logged. Go back and try again.</p>');
    return;
  }
  try {
    const result=await run(key);
    console.log(JSON.stringify(result));
    response.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    response.end(JSON.stringify(result));
  } catch {
    console.error(`STAGING_ATOMIC_QA_FAILED phase=${phase}; no credential output`);
    response.writeHead(500).end("Staging QA failed; credentials not logged");
    process.exitCode=1;
  } finally { server.close(); }
});
server.listen(3189,"127.0.0.1",() => console.log(`QA form: http://127.0.0.1:3189/${nonce}`));
