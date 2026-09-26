import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadModule(path, dependencies) {
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    URL,
    require(name) {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

function harness() {
  let user = { id: "synthetic-owner" };
  let subscriptionChecks = 0;
  const disconnectCalls = [];
  const NextResponse = {
    json(body, options = {}) { return { body, status: options.status ?? 200 }; },
  };
  const access = loadModule("lib/expenses/access.ts", {
    "server-only": {},
    "next/server": { NextResponse },
    "@/lib/supabase/server": { createServerClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) },
    "@/lib/subscription-guard": { requireSubscriptionAccess: async () => { subscriptionChecks++; return { ok: false }; } },
  });
  const route = loadModule("app/api/calendar/disconnect/route.ts", {
    "next/server": { NextResponse },
    "@/lib/expenses/access": access,
    "@/lib/calendar/server": { disconnectCalendar: async id => { disconnectCalls.push(id); return true; } },
  });
  return { access, route, disconnectCalls, subscriptionChecks: () => subscriptionChecks, setUser: value => user = value };
}

const sameOriginRequest = () => new Request("https://preview.example/api/calendar/disconnect", {
  method: "POST", headers: { origin: "https://preview.example" },
});

test("expired account can disconnect without restoring expense access", async () => {
  const h = harness();
  const response = await h.route.POST(sameOriginRequest());
  assert.equal(response.status, 200);
  assert.equal(response.body.disconnected, true);
  assert.deepEqual(h.disconnectCalls, ["synthetic-owner"]);
  assert.equal(h.subscriptionChecks(), 0);

  const expense = await h.access.expenseContext(sameOriginRequest());
  assert.equal(expense.error.status, 403);
  assert.equal(h.subscriptionChecks(), 1);
});

test("disconnect still rejects unauthenticated and cross-origin requests", async () => {
  const h = harness();
  const foreign = new Request("https://preview.example/api/calendar/disconnect", {
    method: "POST", headers: { origin: "https://other.example" },
  });
  assert.equal((await h.route.POST(foreign)).status, 403);
  h.setUser(null);
  assert.equal((await h.route.POST(sameOriginRequest())).status, 401);
  assert.deepEqual(h.disconnectCalls, []);
  assert.equal(h.subscriptionChecks(), 0);
});
