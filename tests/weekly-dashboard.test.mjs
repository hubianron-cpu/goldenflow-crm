import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = "crm";
const key = "test-only-weekly-read-key-000000000000000000";
function compile(path, imports) {
  const input = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(input, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const output = {};
  new Function("require", "exports", code)(imports, output);
  return output;
}
const { readWeeklyDashboard } = compile("../lib/weekly-dashboard.ts", require);
const request = (token = key, method = "GET") =>
  new Request("https://source.test/api/integrations/weekly-dashboard", {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

test("unconfigured, unauthorized and write requests cannot reach the database", async () => {
  let calls = 0;
  const count = async () => {
    calls++;
    return 1;
  };
  assert.equal(
    (await readWeeklyDashboard(request(), source, undefined, count)).status,
    503,
  );
  assert.equal(
    (await readWeeklyDashboard(request("wrong"), source, key, count)).status,
    401,
  );
  assert.equal(
    (await readWeeklyDashboard(request(key, "POST"), source, key, count))
      .status,
    405,
  );
  assert.equal(calls, 0);
});
test("authenticated zero is valid and response includes no account or credential data", async () => {
  const response = await readWeeklyDashboard(
    request(),
    source,
    key,
    async () => 0,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.activeSubscriptions, 0);
  assert.equal(body.source, source);
  assert.equal(body.definition, "active-subscriptions-excluding-trials");
  assert.equal(new Date(body.observedAt).toISOString(), body.observedAt);
  assert.deepEqual(Object.keys(body).sort(), [
    "activeSubscriptions",
    "definition",
    "format",
    "observedAt",
    "source",
    "version",
  ]);
});
test("database failures and invalid counts fail closed without leaking details", async () => {
  for (const value of [-1, 1.5, Number.NaN, 1e13]) {
    assert.equal(
      (await readWeeklyDashboard(request(), source, key, async () => value))
        .status,
      503,
    );
  }
  const response = await readWeeklyDashboard(
    request(),
    source,
    key,
    async () => {
      throw new Error("private-database-details");
    },
  );
  assert.equal(response.status, 503);
  assert.equal(
    (await response.text()).includes("private-database-details"),
    false,
  );
});
test("route authorizes before access and requests exact aggregate count with active policy", async () => {
  const calls = [];
  const result = { count: 17, error: null };
  const query = {
    select: (...args) => {
      calls.push(["select", ...args]);
      return query;
    },
    eq: (...args) => {
      calls.push(["eq", ...args]);
      return source === "crm" ? query : Promise.resolve(result);
    },
    or: (...args) => {
      calls.push(["or", ...args]);
      return Promise.resolve(result);
    },
  };
  const db = {
    from: (table) => {
      calls.push(["from", table]);
      return query;
    },
  };
  const imports = (name) => {
    if (name === "@/lib/weekly-dashboard") return { readWeeklyDashboard };
    if (name === "@/lib/supabase/admin")
      return { getSupabaseAdminClient: () => db };
    if (name === "@/lib/serverSupabase")
      return { createServerSupabaseClients: () => ({ adminClient: db }) };
    throw new Error("Unexpected dependency");
  };
  const { GET } = compile(
    "../app/api/integrations/weekly-dashboard/route.ts",
    imports,
  );
  const prior = process.env.WEEKLY_DASHBOARD_READ_KEY;
  process.env.WEEKLY_DASHBOARD_READ_KEY = key;
  try {
    assert.equal((await GET(request("wrong"))).status, 401);
    assert.deepEqual(calls, []);
    const response = await GET(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).activeSubscriptions, 17);
    assert.deepEqual(calls.slice(0, 3), [
      ["from", "user_subscriptions"],
      ["select", "user_id", { count: "exact", head: true }],
      ["eq", "status", "active"],
    ]);
    if (source === "crm")
      assert.match(
        calls[3][1],
        /^renewal_cancelled_at\.is\.null,access_until\.gt\.\d{4}-/,
      );
    else assert.equal(calls.length, 3);
  } finally {
    if (prior === undefined) delete process.env.WEEKLY_DASHBOARD_READ_KEY;
    else process.env.WEEKLY_DASHBOARD_READ_KEY = prior;
  }
});
