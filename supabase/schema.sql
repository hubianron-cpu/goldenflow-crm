create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  daily_target numeric default 3000,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  value numeric not null default 0,
  source text not null,
  status text not null,
  reason_not_closed text,
  notes text,
  last_contact_date timestamptz,
  next_action_date timestamptz,
  next_action_type text,
  deal_probability integer default 0,
  priority text default 'medium',
  closed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint leads_deal_probability_range check (deal_probability >= 0 and deal_probability <= 100),
  constraint leads_priority_values check (priority in ('high', 'medium', 'low')),
  constraint leads_next_action_type_values check (
    next_action_type is null or next_action_type in ('call', 'message', 'meeting', 'follow-up')
  )
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  linked_lead_id uuid references public.leads(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  status text not null default 'פתוחה',
  priority text default 'בינונית',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  is_automated boolean not null default false,
  constraint tasks_status_values check (status in ('פתוחה', 'בתהליך', 'הושלמה', 'נדחתה')),
  constraint tasks_priority_values check (priority in ('נמוכה', 'בינונית', 'גבוהה', 'דחוף'))
);

create table if not exists public.task_automations_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  rule_type text not null check (rule_type in ('new_lead', 'followup_24h')),
  created_at timestamptz not null default now(),
  unique (lead_id, rule_type)
);

create table if not exists public.agent_integration_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_prefix text not null,
  token_hash text not null unique,
  scopes text[] not null default array[]::text[],
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agent_integration_credentials_name_check
    check (char_length(btrim(name)) between 1 and 100),
  constraint agent_integration_credentials_token_prefix_check
    check (token_prefix ~ '^gflf_[a-f0-9]{12}$'),
  constraint agent_integration_credentials_token_hash_check
    check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint agent_integration_credentials_scopes_check
    check (cardinality(scopes) > 0)
);

create index if not exists task_automations_log_lead_rule_idx
on public.task_automations_log (lead_id, rule_type);

create index if not exists agent_integration_credentials_user_active_idx
on public.agent_integration_credentials (user_id, revoked_at, expires_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, first_name, daily_target)
  values (new.id, nullif(btrim(new.raw_user_meta_data ->> 'first_name'), ''), 3000)
  on conflict (id) do update
    set first_name = coalesce(excluded.first_name, public.users.first_name),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.users (id, first_name)
select id, nullif(btrim(raw_user_meta_data ->> 'first_name'), '')
from auth.users
on conflict (id) do update
  set first_name = coalesce(excluded.first_name, public.users.first_name),
      updated_at = now();

alter table public.users
  add column if not exists daily_target numeric default 3000;

update public.users
set daily_target = 3000
where daily_target is null;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.leads
  add column if not exists closed_at timestamptz;

update public.leads
set closed_at = coalesce(last_contact_date, updated_at, created_at)
where status = 'נסגר' and closed_at is null;

alter table public.users enable row level security;
alter table public.leads enable row level security;
alter table public.tasks enable row level security;
alter table public.task_automations_log enable row level security;
alter table public.agent_integration_credentials enable row level security;

revoke all on table public.agent_integration_credentials from anon, authenticated;
grant select, insert, update, delete on table public.agent_integration_credentials to service_role;

drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_insert_own" on public.users;
drop policy if exists "users_update_own" on public.users;

create policy "users_select_own" on public.users for select to authenticated using (id = auth.uid());
create policy "users_insert_own" on public.users for insert to authenticated with check (id = auth.uid());
create policy "users_update_own" on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "leads_select_own" on public.leads for select to authenticated using (user_id = auth.uid());
create policy "leads_insert_own" on public.leads for insert to authenticated with check (user_id = auth.uid());
create policy "leads_update_own" on public.leads for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "leads_delete_own" on public.leads for delete to authenticated using (user_id = auth.uid());

create policy "tasks_select_own" on public.tasks for select to authenticated using (user_id = auth.uid() or assigned_to = auth.uid());
create policy "tasks_insert_own" on public.tasks for insert to authenticated with check (user_id = auth.uid());
create policy "tasks_update_own" on public.tasks for update to authenticated using (user_id = auth.uid() or assigned_to = auth.uid()) with check (user_id = auth.uid() or assigned_to = auth.uid());
create policy "tasks_delete_own" on public.tasks for delete to authenticated using (user_id = auth.uid());

create policy "task_automations_log_select_own" on public.task_automations_log for select to authenticated using (
  exists (select 1 from public.leads where leads.id = task_automations_log.lead_id and leads.user_id = auth.uid())
);
create policy "task_automations_log_insert_own" on public.task_automations_log for insert to authenticated with check (
  exists (select 1 from public.leads where leads.id = task_automations_log.lead_id and leads.user_id = auth.uid())
);
