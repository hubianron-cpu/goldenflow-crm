-- Run on Staging only. All fixtures, failure injection and test writes roll back.
begin;
create temporary table grow_atomic_test_results(name text, passed boolean);
create function pg_temp.reject_grow_audit() returns trigger language plpgsql as $$
begin raise exception 'QA injected audit failure'; end;
$$;
do $$
declare
  u uuid := gen_random_uuid();
  other_user uuid := gen_random_uuid();
  rollback_user uuid := gen_random_uuid();
  prefix text := 'qa-atomic-' || gen_random_uuid();
  e jsonb := jsonb_build_object('outcome','paid','amount',1,'email_matches',true,
    'affiliate_enabled',true,'paid_at',now(),'audit_date',to_char(now(),'YYYY-MM-DD'));
  r jsonb;
  before_state jsonb;
  after_state jsonb;
begin
  insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
    values(u,u || '@qa.invalid','{}','{}'),(other_user,other_user || '@qa.invalid','{}','{}'),
      (rollback_user,rollback_user || '@qa.invalid','{}','{}');
  insert into public.affiliate_referrals(click_token,affiliate_code,user_id,clicked_at,expires_at)
    values(gen_random_uuid(),'amitifargan',u,now()-interval '1 day',now()+interval '29 days');
  insert into public.affiliate_referrals(click_token,affiliate_code,user_id,clicked_at,expires_at)
    values(gen_random_uuid(),'amitifargan',rollback_user,now()-interval '1 day',now()+interval '29 days');
  e := e || jsonb_build_object('transaction_code',prefix);
  r := public.process_grow_callback(u,e || '{"outcome":"failed"}');
  assert r->>'status' = 'payment_failed';
  r := public.process_grow_callback(u,e);
  assert r->>'status' = 'active';
  assert (select count(*)=1 from public.grow_webhook_events where transaction_code=prefix);
  assert (select event_type='subscription_activated' from public.grow_webhook_events where transaction_code=prefix);
  assert (select conversion_transaction_code=prefix from public.affiliate_referrals where user_id=u);
  insert into grow_atomic_test_results values('failed_to_paid_same_transaction',true);

  select jsonb_build_object('subscription',to_jsonb(s),'referral',to_jsonb(a),'event',to_jsonb(g))
    into before_state from public.user_subscriptions s,public.affiliate_referrals a,public.grow_webhook_events g
    where s.user_id=u and a.user_id=u and g.transaction_code=prefix;
  r := public.process_grow_callback(u,e);
  assert r->>'duplicate_verified' = 'true';
  select jsonb_build_object('subscription',to_jsonb(s),'referral',to_jsonb(a),'event',to_jsonb(g))
    into after_state from public.user_subscriptions s,public.affiliate_referrals a,public.grow_webhook_events g
    where s.user_id=u and a.user_id=u and g.transaction_code=prefix;
  assert before_state=after_state;
  insert into grow_atomic_test_results values('verified_retry_zero_writes',true);
  r := public.process_grow_callback(u,e || '{"outcome":"failed"}');
  assert r->>'reason'='already_paid';
  assert (select status='active' from public.user_subscriptions where user_id=u);
  insert into grow_atomic_test_results values('late_failure_preserves_success',true);
  assert public.process_grow_callback(other_user,e)->>'http_status'='409';
  assert public.process_grow_callback(u,e || '{"amount":2}')->>'http_status'='409';
  assert public.process_grow_callback(u,e || '{"email_matches":false}')->>'http_status'='409';
  insert into grow_atomic_test_results values('tenant_amount_identity_conflicts',true);

  e := e || jsonb_build_object('transaction_code',prefix || '-ignored');
  assert public.process_grow_callback(other_user,e || '{"outcome":"ignored"}')->>'ignored'='true';
  assert public.process_grow_callback(other_user,e)->>'status'='active';
  assert (select count(*)=1 from public.grow_webhook_events where transaction_code=prefix || '-ignored');
  insert into grow_atomic_test_results values('ignored_to_paid_same_transaction',true);

  update public.user_subscriptions set renewal_cancelled_at=now(),access_until=now()+interval '1 day',
    grow_direct_debit_id='old-qa-mandate' where user_id=other_user;
  e := e || jsonb_build_object('transaction_code',prefix || '-cancelled','direct_debit_id','old-qa-mandate');
  assert public.process_grow_callback(other_user,e)->>'reason'='cancelled_mandate';
  assert public.process_grow_callback(other_user,e || '{"direct_debit_id":"new-qa-mandate"}')->>'status'='active';
  assert (select renewal_cancelled_at is null and access_until is null from public.user_subscriptions where user_id=other_user);
  insert into grow_atomic_test_results values('verified_cancellation_and_new_mandate',true);

  -- The failure happens after subscription/conversion processing, but no partial write survives.
  select jsonb_build_object('subscription',to_jsonb(s),'referral',to_jsonb(a)) into before_state
    from public.user_subscriptions s,public.affiliate_referrals a
    where s.user_id=rollback_user and a.user_id=rollback_user;
  create trigger qa_reject_atomic_audit before insert or update on public.grow_webhook_events
    for each row execute function pg_temp.reject_grow_audit();
  begin
    perform public.process_grow_callback(rollback_user,e || jsonb_build_object('transaction_code',prefix || '-rollback'));
    raise exception 'Expected injected failure was not raised';
  exception when raise_exception then
    if sqlerrm <> 'QA injected audit failure' then raise; end if;
  end;
  drop trigger qa_reject_atomic_audit on public.grow_webhook_events;
  select jsonb_build_object('subscription',to_jsonb(s),'referral',to_jsonb(a)) into after_state
    from public.user_subscriptions s,public.affiliate_referrals a
    where s.user_id=rollback_user and a.user_id=rollback_user;
  assert before_state=after_state;
  assert not exists(select 1 from public.grow_webhook_events where transaction_code=prefix || '-rollback');
  insert into grow_atomic_test_results values('audit_failure_rolls_back_subscription_and_conversion',true);
  assert public.process_grow_callback(rollback_user,e || jsonb_build_object('transaction_code',prefix || '-rollback'))->>'status'='active';
  insert into grow_atomic_test_results values('retry_after_rollback',true);
end;
$$;
select * from grow_atomic_test_results;
rollback;
