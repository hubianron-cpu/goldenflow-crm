create extension if not exists "pgcrypto";

alter table public.agent_integration_credentials
  drop constraint if exists agent_integration_credentials_token_prefix_check;

alter table public.agent_integration_credentials
  add constraint agent_integration_credentials_token_prefix_check
  check (token_prefix ~ '^(gflf|gfsi)_[a-f0-9]{12}$');

create unique index if not exists leads_user_id_id_unique_idx
  on public.leads (user_id, id);

create table if not exists public.lead_sales_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null,
  occurred_at timestamptz not null,
  activity_type text not null check (
    activity_type in (
      'contact_attempt',
      'call_completed',
      'meeting_completed',
      'message_sent',
      'message_received',
      'offer_sent',
      'objection_recorded',
      'follow_up_completed',
      'note_recorded'
    )
  ),
  direction text check (direction is null or direction in ('inbound', 'outbound', 'internal')),
  outcome text check (outcome is null or char_length(outcome) <= 500),
  summary text check (summary is null or char_length(summary) <= 2000),
  source text not null check (source in ('crm_manual', 'crm_system', 'integration')),
  created_at timestamptz not null default now(),
  constraint lead_sales_activities_owned_lead_fkey
    foreign key (user_id, lead_id)
    references public.leads (user_id, id)
    on delete cascade
);

create index if not exists lead_sales_activities_tenant_lead_occurred_idx
  on public.lead_sales_activities (user_id, lead_id, occurred_at desc, id desc);

alter table public.lead_sales_activities enable row level security;

drop policy if exists "lead_sales_activities_select_own" on public.lead_sales_activities;
drop policy if exists "lead_sales_activities_insert_own" on public.lead_sales_activities;

create policy "lead_sales_activities_select_own"
on public.lead_sales_activities
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.leads
    where leads.id = lead_sales_activities.lead_id
      and leads.user_id = auth.uid()
  )
);

create policy "lead_sales_activities_insert_own"
on public.lead_sales_activities
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.leads
    where leads.id = lead_sales_activities.lead_id
      and leads.user_id = auth.uid()
  )
);

revoke all on table public.lead_sales_activities from anon, authenticated;
grant select, insert on table public.lead_sales_activities to authenticated;
grant select, insert on table public.lead_sales_activities to service_role;

comment on table public.lead_sales_activities is
  'Append-only verified sales activity facts for tenant-owned CRM leads.';

notify pgrst, 'reload schema';
