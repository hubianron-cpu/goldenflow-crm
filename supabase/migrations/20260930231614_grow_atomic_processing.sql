begin;

-- Invoker rights: only the server's service_role can process a verified callback.
create or replace function public.process_grow_callback(p_user_id uuid, p_event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_code text := nullif(btrim(p_event->>'transaction_code'), '');
  v_outcome text := p_event->>'outcome';
  v_amount numeric := (p_event->>'amount')::numeric;
  v_mandate text := nullif(btrim(p_event->>'direct_debit_id'), '');
  v_paid_at timestamptz := coalesce((p_event->>'paid_at')::timestamptz, now());
  v_existing public.grow_webhook_events%rowtype;
  v_subscription public.user_subscriptions%rowtype;
  v_audit jsonb;
  v_type text := 'ignored';
  v_result jsonb := jsonb_build_object('ok', true, 'ignored', true);
begin
  if v_code is null or length(v_code) > 200 or v_outcome is null
      or v_outcome not in ('paid', 'failed', 'ignored') then
    return jsonb_build_object('error', 'Invalid transaction', 'http_status', 400);
  end if;
  if v_outcome = 'paid' and (v_amount is null or v_amount <= 0
      or v_amount::text in ('NaN', 'Infinity', '-Infinity')
      or (p_user_id is not null and not coalesce((p_event->>'email_matches')::boolean, false))) then
    return jsonb_build_object('error', 'Invalid payment identity or amount', 'http_status', 409);
  end if;

  -- Serialize even when the transaction has no event row yet. Hash collisions only delay work.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('grow:' || v_code, 0));
  select * into v_existing from public.grow_webhook_events
    where transaction_code = v_code for update;
  if found then
    if (v_existing.user_id is not null and v_existing.user_id is distinct from p_user_id)
        or v_existing.event_type not in ('ignored', 'payment_failed', 'subscription_activated') then
      return jsonb_build_object('error', 'Transaction identity conflict', 'http_status', 409);
    end if;
    if v_existing.event_type = 'subscription_activated' then
      if p_user_id is null or v_existing.user_id is distinct from p_user_id then
        return jsonb_build_object('error', 'Transaction identity unavailable', 'http_status', 409);
      end if;
      if v_outcome <> 'paid' then
        return jsonb_build_object('ok', true, 'ignored', true, 'reason', 'already_paid');
      end if;
      if (v_existing.payload->>'payment_sum')::numeric is distinct from v_amount then
        return jsonb_build_object('error', 'Transaction amount conflict', 'http_status', 409);
      end if;
      -- This describes the recorded payment outcome, not current subscription access.
      return jsonb_build_object('ok', true, 'duplicate', true, 'duplicate_verified', true, 'status', 'active');
    end if;
  end if;

  -- Never store the provider body, email, webhook key, or arbitrary JSON fields.
  v_audit := jsonb_build_object('schema_version', 1, 'payment_sum', v_amount,
    'payment_date', case when p_event->>'audit_date' ~ '^([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}/[0-9]{1,2}/[0-9]{2}([0-9]{2})?)$'
      then p_event->>'audit_date' else null end);
  if p_user_id is null then
    v_result := jsonb_build_object('ok', true, 'message', 'No matching user found');
  elsif v_outcome <> 'ignored' then
    -- Also serialize different transactions and manual cancellation for the same subscription.
    select * into v_subscription from public.user_subscriptions where user_id = p_user_id for update;
    if not found then
      v_result := jsonb_build_object('ok', true, 'ignored', true, 'reason', 'missing_subscription');
    elsif v_outcome = 'failed' then
      if v_subscription.renewal_cancelled_at is null then
        update public.user_subscriptions set status = 'payment_failed',
          grow_direct_debit_id = coalesce(v_mandate, grow_direct_debit_id),
          grow_last_error_message = nullif(p_event->>'error_message', ''),
          grow_last_payment_date = v_paid_at, grow_last_payment_sum = v_amount,
          grow_transaction_code = v_code, updated_at = now() where user_id = p_user_id;
      end if;
      v_type := 'payment_failed';
      v_result := jsonb_build_object('ok', true, 'status', 'payment_failed');
    elsif v_subscription.renewal_cancelled_at is not null and
        (v_subscription.grow_direct_debit_id is null or v_mandate is null
          or v_subscription.grow_direct_debit_id = v_mandate) then
      v_result := jsonb_build_object('ok', true, 'ignored', true, 'reason', 'cancelled_mandate');
    else
      update public.user_subscriptions set status = 'active', plan_name = 'monthly',
        grow_direct_debit_id = coalesce(v_mandate, grow_direct_debit_id),
        grow_last_payment_date = v_paid_at, grow_last_payment_sum = v_amount,
        grow_transaction_code = v_code, upgraded_at = coalesce(upgraded_at, now()),
        renewal_cancelled_at = null,
        access_until = case when v_subscription.renewal_cancelled_at is not null then null else access_until end,
        updated_at = now() where user_id = p_user_id;
      if coalesce((p_event->>'affiliate_enabled')::boolean, false) then
        update public.affiliate_referrals set conversion_transaction_code = v_code,
          conversion_amount = v_amount, converted_at = v_paid_at
          where user_id = p_user_id and conversion_transaction_code is null
            and clicked_at <= v_paid_at and expires_at > v_paid_at;
      end if;
      v_type := 'subscription_activated';
      v_result := jsonb_build_object('ok', true, 'status', 'active');
    end if;
  end if;

  if v_existing.id is not null then
    update public.grow_webhook_events set event_type = v_type, user_id = p_user_id,
      payload = v_audit, processed_at = now() where id = v_existing.id;
  else
    -- A legacy writer that ignores the advisory lock must cause rollback, not overwrite.
    insert into public.grow_webhook_events(transaction_code, event_type, user_id, payload, processed_at)
      values (v_code, v_type, p_user_id, v_audit, now());
  end if;
  return v_result;
  -- Do not swallow exceptions: Postgres rolls subscription, conversion and audit back together.
end;
$$;

revoke all on function public.process_grow_callback(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.process_grow_callback(uuid, jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
