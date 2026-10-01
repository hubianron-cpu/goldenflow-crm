// Never run this destructive fixture setup against Staging or Production.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

const database = process.env.GROW_TEST_DATABASE_URL;
test("parallel click creators share one database minute cap", { skip: !database }, async () => {
  const url = new URL(database);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.pathname, "/grow_qa");
  const container = process.env.GROW_TEST_PSQL_DOCKER_CONTAINER;
  if (container) assert.match(container, /^gf-affiliate-qa-[a-z0-9-]+$/);
  function sql(query) {
    return new Promise((resolve, reject) => {
      const args = [database, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"];
      const child = spawn(container ? "docker" : "psql",
        container ? ["exec", "-i", container, "psql", ...args] : args,
        { stdio: ["pipe", "pipe", "pipe"] });
      let output = "";
      child.stdout.on("data", chunk => { output += chunk; });
      child.stderr.on("data", () => {});
      child.on("error", reject);
      child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error("Disposable click QA failed")));
      child.stdin.end(query);
    });
  }
  await sql(`delete from public.affiliate_referrals;
    insert into public.affiliate_referrals(click_token,affiliate_code,clicked_at,expires_at)
    select gen_random_uuid(),'amitifargan',clock_timestamp(),clock_timestamp()+interval '30 days'
    from generate_series(1,58);`);
  try {
    const results = await Promise.all(Array.from({ length: 20 }, () => sql(
      "set role service_role; select public.create_affiliate_click('amitifargan');").then(JSON.parse)));
    assert.equal(results.filter(r => r.status === "created").length, 2);
    assert.equal(results.filter(r => r.status === "rate_limited").length, 18);
    assert.equal(await sql("select count(*) from public.affiliate_referrals;"), "60");
  } finally {
    await sql("delete from public.affiliate_referrals;");
  }
});
