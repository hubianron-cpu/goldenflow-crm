begin;

alter table public.user_subscriptions
  add column renewal_cancelled_at timestamptz,
  add column access_until timestamptz,
  add constraint user_subscriptions_cancellation_window_check check (
    (renewal_cancelled_at is null and access_until is null) or
    (renewal_cancelled_at is not null and access_until is not null and access_until > renewal_cancelled_at)
  );

-- The activity RPC has its own subscription gate; keep it aligned with the API and middleware.
create or replace function public.record_lead_sales_activity(
  p_request_id uuid,
  p_lead_id uuid,
  p_outcome text,
  p_summary text,
  p_next_step text,
  p_next_type text,
  p_next_date timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_lead public.leads%rowtype;
  v_activity public.lead_sales_activities%rowtype;
  v_type text;
  v_label text;
  v_direction text;
  v_terminal boolean;
begin
  if v_user is null or not exists (
    select 1 from public.user_subscriptions s
    where s.user_id = v_user
      and (
        (s.status = 'active' and (s.renewal_cancelled_at is null or s.access_until > now())) or
        (s.status = 'trial' and s.trial_end_at > now())
      )
  ) then
    raise exception 'Subscription access required' using errcode = '42501';
  end if;
  if p_request_id is null or p_lead_id is null or p_outcome is null or
     p_outcome not in ('no_answer', 'call', 'whatsapp', 'offer', 'later', 'irrelevant') or
     p_summary is null or char_length(p_summary) > 2000 or p_next_step is null or
     p_next_step not in ('keep', 'none', 'schedule') or
     (p_next_step = 'schedule' and (p_next_date is null or not isfinite(p_next_date) or p_next_type is null or p_next_type not in ('call', 'message', 'meeting', 'follow-up'))) or
     (p_next_step <> 'schedule' and (p_next_date is not null or p_next_type is not null)) then
    raise exception 'Invalid activity' using errcode = '22023';
  end if;

  v_type := case p_outcome when 'no_answer' then 'contact_attempt' when 'call' then 'call_completed'
    when 'whatsapp' then 'message_sent' when 'offer' then 'offer_sent' else 'note_recorded' end;
  v_label := case p_outcome when 'no_answer' then 'לא ענה' when 'call' then 'שיחה התקיימה'
    when 'whatsapp' then 'WhatsApp נשלח' when 'offer' then 'הצעה נשלחה'
    when 'later' then 'ביקש לחזור מאוחר יותר' else 'לא רלוונטי' end;
  v_direction := case when p_outcome in ('no_answer', 'whatsapp', 'offer') then 'outbound'
    when p_outcome = 'irrelevant' then 'internal' else null end;

  select * into v_lead from public.leads where id = p_lead_id and user_id = v_user for update;
  if not found then raise exception 'Lead not found' using errcode = 'P0002'; end if;

  select * into v_activity from public.lead_sales_activities where id = p_request_id and user_id = v_user;
  if found then
    if v_activity.lead_id <> p_lead_id or v_activity.source <> 'crm_manual' or
       v_activity.activity_type <> v_type or v_activity.outcome is distinct from v_label or
       v_activity.direction is distinct from v_direction or
       v_activity.summary is distinct from nullif(btrim(p_summary), '') or
       v_activity.next_step_mode is distinct from p_next_step or
       v_activity.next_action_type is distinct from p_next_type or
       v_activity.next_action_date is distinct from p_next_date then
      raise exception 'Request already used' using errcode = '23505';
    end if;
    return jsonb_build_object('id', v_activity.id, 'replayed', true);
  end if;

  v_terminal := lower(btrim(v_lead.status)) in ('נסגר בהצלחה', 'לא רלוונטי', 'נסגר', 'סגור', 'closed', 'won', 'lost');
  if (v_terminal and p_next_step <> 'keep') or (p_next_step = 'schedule' and p_next_date <= now()) then
    raise exception 'Invalid next step' using errcode = '22023';
  end if;

  insert into public.lead_sales_activities (
    id, user_id, lead_id, occurred_at, activity_type, direction, outcome, summary, source,
    next_step_mode, next_action_type, next_action_date
  ) values (
    p_request_id, v_user, p_lead_id, now(), v_type, v_direction, v_label, nullif(btrim(p_summary), ''), 'crm_manual',
    p_next_step, p_next_type, p_next_date
  );

  if not v_terminal then
    update public.leads set
      last_contact_date = case when p_outcome in ('call', 'whatsapp', 'offer', 'later') then now() else last_contact_date end,
      next_action_type = case p_next_step when 'schedule' then p_next_type when 'none' then null else next_action_type end,
      next_action_date = case p_next_step when 'schedule' then p_next_date when 'none' then null else next_action_date end,
      updated_at = now()
    where id = p_lead_id and user_id = v_user;
    if not found then raise exception 'Lead update denied' using errcode = '42501'; end if;
  end if;
  return jsonb_build_object('id', p_request_id, 'replayed', false);
end;
$$;

notify pgrst, 'reload schema';
commit;
