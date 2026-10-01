-- Disposable CI database only. All fixture changes roll back.
begin;
set local role service_role;
delete from public.affiliate_referrals;
do $$
declare r jsonb; i integer;
begin
  begin
    perform public.create_affiliate_click('other');
    raise exception 'Unknown partner accepted';
  exception when invalid_parameter_value then
    null;
  end;
  for i in 1..60 loop
    r := public.create_affiliate_click('amitifargan');
    if r->>'status' <> 'created' then raise exception 'Early minute rejection'; end if;
  end loop;
  if public.create_affiliate_click('amitifargan')->>'status' <> 'rate_limited' then
    raise exception 'Minute limit bypass';
  end if;
  if (select count(*) from public.affiliate_referrals) <> 60 then
    raise exception 'Rejected request inserted a row';
  end if;
  if exists(select 1 from public.affiliate_referrals where expires_at-clicked_at <> interval '30 days') then
    raise exception 'Wrong attribution window';
  end if;
end;
$$;
delete from public.affiliate_referrals;
insert into public.affiliate_referrals(click_token, affiliate_code, clicked_at, expires_at)
select gen_random_uuid(), 'amitifargan', now()-interval '30 minutes', now()+interval '30 days'
from generate_series(1,500);
do $$
begin
  if public.create_affiliate_click('amitifargan')->>'status' <> 'rate_limited' then
    raise exception 'Hour limit bypass';
  end if;
end;
$$;
update public.affiliate_referrals set clicked_at=now()-interval '2 hours';
do $$
begin
  if public.create_affiliate_click('amitifargan')->>'status' <> 'created' then
    raise exception 'Expired window did not recover';
  end if;
  if has_function_privilege('anon','public.create_affiliate_click(text)','execute')
    or has_function_privilege('authenticated','public.create_affiliate_click(text)','execute')
    or not has_function_privilege('service_role','public.create_affiliate_click(text)','execute') then
    raise exception 'Unsafe RPC privileges';
  end if;
end;
$$;
rollback;
