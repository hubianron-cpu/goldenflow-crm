// Actual independent Postgres sessions; runs only on a disposable localhost CI DB.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";

const database = process.env.GROW_TEST_DATABASE_URL;
test("Postgres serializes parallel callbacks and keeps one conversion", { skip: !database }, async () => {
  assert.equal(new URL(database).hostname,"127.0.0.1");
  const id=randomUUID(), code="qa-parallel-"+randomUUID();
  const event=JSON.stringify({transaction_code:code,outcome:"paid",amount:1,email_matches:true,
    affiliate_enabled:true,paid_at:new Date().toISOString()});
  function sql(query) {
    return new Promise((resolve,reject) => {
      const child=spawn("psql",[database,"-X","-qAt","-v","ON_ERROR_STOP=1"],{stdio:["pipe","pipe","pipe"]});
      let output="";
      child.stdout.on("data",chunk => {output+=chunk;});
      child.stderr.on("data",() => {});
      child.on("error",reject);
      child.on("close",code => code===0 ? resolve(output.trim()) : reject(new Error("Scoped CI SQL failed")));
      child.stdin.end(query);
    });
  }
  await sql(`insert into auth.users(id,email) values('${id}','${id}@qa.invalid');
    insert into public.affiliate_referrals(click_token,affiliate_code,user_id,clicked_at,expires_at)
      values(gen_random_uuid(),'amitifargan','${id}',now()-interval '1 day',now()+interval '29 days');`);
  try {
    const query=`set role service_role; select public.process_grow_callback('${id}','${event}'::jsonb);`;
    const responses=await Promise.all(Array.from({length:20},()=>sql(query).then(JSON.parse)));
    assert.equal(responses.filter(r=>r.status==="active"&&!r.duplicate).length,1);
    assert.equal(responses.filter(r=>r.duplicate_verified).length,19);
    const snapshotQuery=`select jsonb_build_object('subscription',to_jsonb(s),'event',to_jsonb(e),'referral',to_jsonb(a))
      from public.user_subscriptions s,public.grow_webhook_events e,public.affiliate_referrals a
      where s.user_id='${id}' and a.user_id='${id}' and e.transaction_code='${code}';`;
    const before=JSON.parse(await sql(snapshotQuery));
    await Promise.all(Array.from({length:10},()=>sql(query)));
    assert.deepEqual(JSON.parse(await sql(snapshotQuery)),before);
    const failed=JSON.stringify({...JSON.parse(event),outcome:"failed"});
    await Promise.all([sql(query),sql(`set role service_role;select public.process_grow_callback('${id}','${failed}');`)]);
    assert.deepEqual(JSON.parse(await sql(snapshotQuery)),before);
  } finally {
    await sql(`delete from public.grow_webhook_events where user_id='${id}' and transaction_code='${code}';
      delete from auth.users where id='${id}' and email='${id}@qa.invalid';`);
  }
});
