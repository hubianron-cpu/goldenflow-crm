import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";

function loadModule(path, dependencies, context = {}) {
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, URL, ...context,
    require(name) {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

test("Calendar access is closed by default and QA mode requires an exact UUID", () => {
  const env = {};
  const gate = loadModule("lib/calendar/access.ts", { "server-only": {} }, { process: { env } });
  assert.equal(gate.calendarAccessAllowed(owner), false);
  env.GOOGLE_CALENDAR_ACCESS_MODE = "qa";
  env.GOOGLE_CALENDAR_QA_USER_IDS = ` ${other}, ${owner.toUpperCase()} `;
  assert.equal(gate.calendarAccessAllowed(owner), true);
  assert.equal(gate.calendarAccessAllowed("00000000-0000-4000-8000-000000000003"), false);
  assert.equal(gate.calendarAccessAllowed("not-a-uuid"), false);
  env.GOOGLE_CALENDAR_ACCESS_MODE = "invalid";
  assert.equal(gate.calendarAccessAllowed(owner), false);
  env.GOOGLE_CALENDAR_ACCESS_MODE = "public";
  assert.equal(gate.calendarAccessAllowed(owner), true);
  assert.equal(gate.calendarAccessAllowed("not-a-uuid"), false);
});

test("connect and sync cannot reach Google for an unlisted subscriber", async () => {
  let allowed = false, started = 0, synced = 0;
  const response = (body, options = {}) => ({ body, status: options.status ?? 200 });
  const deps = {
    "next/server": { NextResponse: { json: response } },
    "@/lib/expenses/access": {
      expenseContext: async () => ({ user: { id: owner } }),
      expenseError: (status = 500) => response({ error: true }, { status }),
    },
    "@/lib/calendar/access": { calendarAccessAllowed: () => allowed },
    "@/lib/calendar/server": {
      calendarConfig: () => { started++; return null; },
      startConnection: async () => { started++; },
      syncCalendar: async () => { synced++; },
    },
  };
  const connect = loadModule("app/api/calendar/connect/route.ts", deps);
  const sync = loadModule("app/api/calendar/sync/route.ts", deps);
  const request = new Request("https://preview.example/api/calendar/connect", { method: "POST" });
  assert.equal((await connect.POST(request)).status, 403);
  assert.equal((await sync.POST(request)).status, 403);
  assert.equal(started, 0);
  assert.equal(synced, 0);
  allowed = true;
  assert.equal((await sync.POST(request)).status, 200);
  assert.equal(synced, 1);
});

test("callback cannot exchange OAuth code when QA access was removed", async () => {
  let allowed = false, finished = 0, synced = 0;
  const response = {
    cookies: { set() {} },
    headers: { set() {} },
  };
  const callback = loadModule("app/api/calendar/callback/route.ts", {
    "next/server": { NextResponse: { redirect: url => ({ ...response, url: String(url) }) } },
    "@/lib/expenses/access": { expenseContext: async () => ({ user: { id: owner } }) },
    "@/lib/calendar/access": { calendarAccessAllowed: () => allowed },
    "@/lib/calendar/server": {
      finishConnection: async () => { finished++; },
      syncCalendar: async () => { synced++; },
    },
  });
  const request = {
    nextUrl: new URL("https://preview.example/api/calendar/callback?state=qa-state&code=qa-code"),
    url: "https://preview.example/api/calendar/callback?state=qa-state&code=qa-code",
    cookies: { get: () => ({ value: "qa-state" }) },
  };
  assert.match((await callback.GET(request)).url, /calendar=failed/);
  assert.equal(finished, 0);
  assert.equal(synced, 0);
  allowed = true;
  assert.match((await callback.GET(request)).url, /calendar=connected/);
  assert.equal(finished, 1);
  assert.equal(synced, 1);
});
