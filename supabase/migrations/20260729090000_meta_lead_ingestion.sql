alter table public.leads
  add column if not exists email text;

alter table public.leads
  alter column phone drop not null;

create index if not exists leads_user_email_idx
  on public.leads (user_id, email)
  where email is not null and btrim(email) <> '';

create table if not exists public.lead_external_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  provider text not null,
  external_lead_id text not null,
  submitted_at timestamptz,
  received_at timestamptz not null default now(),
  page_id text,
  page_name text,
  form_id text,
  form_name text,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text,
  ad_name text,
  created_at timestamptz not null default now(),
  constraint lead_external_sources_provider_check
    check (provider = 'meta_lead_ads'),
  constraint lead_external_sources_external_id_check
    check (
      external_lead_id = btrim(external_lead_id)
      and char_length(external_lead_id) between 1 and 128
    ),
  constraint lead_external_sources_optional_ids_check
    check (
      (page_id is null or char_length(page_id) <= 128)
      and (form_id is null or char_length(form_id) <= 128)
      and (campaign_id is null or char_length(campaign_id) <= 128)
      and (adset_id is null or char_length(adset_id) <= 128)
      and (ad_id is null or char_length(ad_id) <= 128)
    ),
  constraint lead_external_sources_optional_names_check
    check (
      (page_name is null or char_length(page_name) <= 160)
      and (form_name is null or char_length(form_name) <= 240)
      and (campaign_name is null or char_length(campaign_name) <= 240)
      and (adset_name is null or char_length(adset_name) <= 240)
      and (ad_name is null or char_length(ad_name) <= 240)
    )
);

create unique index if not exists lead_external_sources_provider_event_key
  on public.lead_external_sources (user_id, provider, external_lead_id);

create index if not exists lead_external_sources_user_idx
  on public.lead_external_sources (user_id);

create index if not exists lead_external_sources_lead_idx
  on public.lead_external_sources (lead_id);

create index if not exists lead_external_sources_submitted_idx
  on public.lead_external_sources (submitted_at);

alter table public.lead_external_sources enable row level security;

drop policy if exists "lead_external_sources_select_own"
  on public.lead_external_sources;
create policy "lead_external_sources_select_own"
on public.lead_external_sources
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.leads
    where leads.id = lead_external_sources.lead_id
      and leads.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
