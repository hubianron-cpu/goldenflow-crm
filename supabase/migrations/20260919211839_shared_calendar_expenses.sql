begin;

create table public.manual_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  amount_agorot bigint not null check (amount_agorot > 0 and amount_agorot <= 10000000000),
  currency text not null default 'ILS' check (currency = 'ILS'),
  due_date date not null,
  status text not null default 'planned' check (status in ('planned','paid','cancelled')),
  category text not null default '' check (length(category) <= 80),
  notes text not null default '' check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index manual_expenses_owner_date on public.manual_expenses(user_id, due_date);
alter table public.manual_expenses enable row level security;
revoke all on public.manual_expenses from public, anon, authenticated;
grant select, insert, update, delete on public.manual_expenses to authenticated;
grant all on public.manual_expenses to service_role;
create policy expenses_select on public.manual_expenses for select to authenticated using ((select auth.uid()) = user_id);
create policy expenses_insert on public.manual_expenses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy expenses_update on public.manual_expenses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy expenses_delete on public.manual_expenses for delete to authenticated using ((select auth.uid()) = user_id);

-- Credentials and pending OAuth state are never readable by browser roles.
create table public.google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  generation uuid not null default gen_random_uuid(),
  token_ciphertext text,
  oauth_state_hash text,
  oauth_verifier_ciphertext text,
  oauth_expires_at timestamptz,
  time_zone text not null default 'Asia/Jerusalem',
  reconnect_required boolean not null default false,
  last_synced_at timestamptz,
  sync_until date,
  sync_lease_until timestamptz not null default '-infinity',
  created_at timestamptz not null default now()
);
alter table public.google_calendar_connections enable row level security;
revoke all on public.google_calendar_connections from public, anon, authenticated;
grant all on public.google_calendar_connections to service_role;

create table public.google_calendar_events (
  user_id uuid not null references public.google_calendar_connections(user_id) on delete cascade,
  event_id text not null,
  title text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  event_date date not null,
  all_day boolean not null,
  amount_agorot bigint check (amount_agorot > 0 and amount_agorot <= 10000000000),
  is_meeting boolean not null,
  expense_status text not null default 'planned' check (expense_status in ('planned','paid','cancelled')),
  primary key (user_id, event_id),
  check (all_day or (starts_at is not null and ends_at > starts_at))
);
alter table public.google_calendar_events enable row level security;
revoke all on public.google_calendar_events from public, anon, authenticated;
grant select on public.google_calendar_events to authenticated;
grant all on public.google_calendar_events to service_role;
create policy calendar_events_select on public.google_calendar_events for select to authenticated using ((select auth.uid()) = user_id);

-- Publish only complete snapshots, never partial pages. A stale sync cannot revive
-- a disconnected/reconnected account. Manual expenses are never touched.
create function public.publish_calendar_snapshot(p_user_id uuid, p_generation uuid, p_events jsonb, p_time_zone text, p_until date)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.google_calendar_connections
    where user_id = p_user_id and generation = p_generation and token_ciphertext is not null
    for update;
  if not found then return false; end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 10000 then
    raise exception 'Invalid snapshot';
  end if;
  insert into public.google_calendar_events(user_id,event_id,title,starts_at,ends_at,event_date,all_day,amount_agorot,is_meeting)
    select p_user_id,e.event_id,e.title,e.starts_at,e.ends_at,e.event_date,e.all_day,e.amount_agorot,e.is_meeting
    from jsonb_to_recordset(p_events) as e(event_id text,title text,starts_at timestamptz,ends_at timestamptz,event_date date,all_day boolean,amount_agorot bigint,is_meeting boolean)
    on conflict(user_id,event_id) do update set
      title=excluded.title,starts_at=excluded.starts_at,ends_at=excluded.ends_at,
      event_date=excluded.event_date,all_day=excluded.all_day,amount_agorot=excluded.amount_agorot,is_meeting=excluded.is_meeting;
  delete from public.google_calendar_events where user_id=p_user_id
    and event_id not in (select e->>'event_id' from jsonb_array_elements(p_events) e);
  update public.google_calendar_connections set time_zone=p_time_zone,last_synced_at=now(),sync_until=p_until,
    sync_lease_until='-infinity',reconnect_required=false where user_id=p_user_id;
  return true;
end;
$$;
revoke all on function public.publish_calendar_snapshot(uuid,uuid,jsonb,text,date) from public, anon, authenticated;
grant execute on function public.publish_calendar_snapshot(uuid,uuid,jsonb,text,date) to service_role;

commit;
