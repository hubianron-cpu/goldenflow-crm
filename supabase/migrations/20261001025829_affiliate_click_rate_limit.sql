begin;

-- A shared cap bounds row creation without retaining visitor IP addresses.
create function public.create_affiliate_click(p_code text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_now timestamptz;
  v_token uuid;
  v_minute bigint;
  v_hour bigint;
begin
  if p_code is distinct from 'amitifargan' then
    raise exception 'Unsupported affiliate code' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('affiliate-click:' || p_code, 0));
  v_now := pg_catalog.clock_timestamp();
  select count(*) filter (where clicked_at > v_now - interval '1 minute'), count(*)
    into v_minute, v_hour
    from public.affiliate_referrals
    where affiliate_code = p_code and clicked_at > v_now - interval '1 hour';
  if v_minute >= 60 or v_hour >= 500 then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  v_token := pg_catalog.gen_random_uuid();
  insert into public.affiliate_referrals(affiliate_code, click_token, clicked_at, expires_at)
    values(p_code, v_token, v_now, v_now + interval '30 days');
  return jsonb_build_object('status', 'created', 'token', v_token,
    'expires_at', v_now + interval '30 days');
end;
$$;

revoke all on function public.create_affiliate_click(text) from public, anon, authenticated;
grant execute on function public.create_affiliate_click(text) to service_role;
notify pgrst, 'reload schema';
commit;
