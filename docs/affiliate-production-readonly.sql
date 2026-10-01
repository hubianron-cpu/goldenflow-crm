-- Authorized CRM Production verification only. Never executes a business RPC.
-- Run metadata first. Run the second section only if grow_webhook_events exists.
begin transaction read only;
select table_name, column_name, data_type
from information_schema.columns
where table_schema='public' and table_name in
  ('user_subscriptions','grow_webhook_events','affiliate_referrals')
order by table_name,ordinal_position;

select c.relname,c.relrowsecurity,r.role,
  has_table_privilege(r.role,c.oid,'SELECT') as can_select,
  has_table_privilege(r.role,c.oid,'INSERT') as can_insert,
  has_table_privilege(r.role,c.oid,'UPDATE') as can_update,
  has_table_privilege(r.role,c.oid,'DELETE') as can_delete
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values ('anon'),('authenticated'),('service_role')) r(role)
where n.nspname='public' and c.relname in
  ('user_subscriptions','grow_webhook_events','affiliate_referrals');

select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef,p.proconfig,r.role,
  has_function_privilege(r.role,p.oid,'EXECUTE') as can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join (values ('anon'),('authenticated'),('service_role')) r(role)
where n.nspname='public' and p.proname in
  ('process_grow_callback','create_affiliate_click');

select conrelid::regclass as relation,conname,pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid in
  (select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in
      ('user_subscriptions','grow_webhook_events','affiliate_referrals'));
commit;

-- Aggregate-only compatibility evidence: no payer email, keys or raw payloads.
begin transaction read only;
select count(*) as successful_events,
  count(*) filter (where user_id is null) as missing_owner,
  count(*) filter (where transaction_code is null or btrim(transaction_code)='') as missing_transaction,
  count(*) filter (where payload->>'payment_sum' is null) as missing_comparable_amount,
  count(*) filter (where payload->>'payment_sum' is not null
    and not (payload->>'payment_sum' ~ '^[0-9]+([.][0-9]+)?$')) as amount_needs_review
from public.grow_webhook_events where event_type='subscription_activated';
commit;
