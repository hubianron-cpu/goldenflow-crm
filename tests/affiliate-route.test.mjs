import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function harness({ enabled = true, existing = false, limited = false, failed = false } = {}) {
  let creates = 0;
  let cookies = 0;
  class AffiliateRateLimitError extends Error {}
  class NextResponse extends Response {
    cookies = { set() { cookies += 1; } };
    static redirect(url) { return new NextResponse(null, { status: 307, headers: { Location: String(url) } }); }
  }
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync("app/r/[code]/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, process: { env: { NODE_ENV: "production" } }, URL,
    console: { error() {} }, require(name) {
      if (name === "next/server") return { NextResponse };
      if (name === "@/lib/env") return { hasSupabaseEnv: () => true };
      if (name === "@/lib/supabase/admin") return { getSupabaseAdminClient: () => ({}) };
      if (name === "@/lib/affiliate") return {
        AffiliateRateLimitError, REFERRAL_COOKIE: "referral",
        isAllowedAffiliate: code => code === "amitifargan",
        isAffiliateTrackingEnabled: () => enabled,
        getActiveReferralClick: async () => existing ? { token: "existing", expiresAt: new Date() } : null,
        createReferralClick: async () => {
          creates += 1;
          if (limited) throw new AffiliateRateLimitError();
          if (failed) throw new Error("Missing RPC");
          return { token: "new", expiresAt: new Date() };
        },
      };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return { send: code => exports.GET({ url: "https://crm.invalid/r/amitifargan", cookies: { get: () => undefined } },
    { params: Promise.resolve({ code: code ?? "amitifargan" }) }),
    get creates() { return creates; }, get cookies() { return cookies; } };
}

test("throttled requests return 429 with retry guidance and no cookie", async () => {
  const h = harness({ limited: true });
  const response = await h.send();
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(h.cookies, 0);
});
test("valid existing click reuses its cookie without consuming create capacity", async () => {
  const h = harness({ existing: true, limited: true });
  assert.equal((await h.send()).status, 307);
  assert.equal(h.creates, 0);
  assert.equal(h.cookies, 1);
});
test("missing RPC fails closed rather than inserting directly", async () => {
  const h = harness({ failed: true });
  assert.equal((await h.send()).status, 503);
  assert.equal(h.cookies, 0);
});
test("disabled tracking and unknown partners cannot create rows", async () => {
  const h = harness({ enabled: false });
  assert.equal((await h.send()).status, 503);
  assert.equal((await h.send("other")).status, 404);
  assert.equal(h.creates, 0);
});
test("allowed new click redirects to registration and sets one cookie", async () => {
  const h = harness();
  const response = await h.send();
  assert.equal(response.headers.get("Location"), "https://crm.invalid/register");
  assert.equal(h.creates, 1);
  assert.equal(h.cookies, 1);
});
