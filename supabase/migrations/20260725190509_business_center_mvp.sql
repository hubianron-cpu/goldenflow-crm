create table if not exists public.business_center_monthly_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  target_revenue numeric(14,2),
  target_leads integer,
  target_sales_calls integer,
  target_new_customers integer,
  target_content_published integer,
  actual_revenue numeric(14,2) not null default 0,
  actual_leads integer not null default 0,
  actual_sales_calls integer not null default 0,
  actual_new_customers integer not null default 0,
  actual_content_published integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_center_monthly_metrics_owner_month_key unique (user_id, month_start),
  constraint business_center_monthly_metrics_month_start_check
    check (month_start = date_trunc('month', month_start)::date),
  constraint business_center_monthly_metrics_targets_check
    check (
      (target_revenue is null or target_revenue >= 0)
      and (target_leads is null or target_leads >= 0)
      and (target_sales_calls is null or target_sales_calls >= 0)
      and (target_new_customers is null or target_new_customers >= 0)
      and (target_content_published is null or target_content_published >= 0)
    ),
  constraint business_center_monthly_metrics_actuals_check
    check (
      actual_revenue >= 0
      and actual_leads >= 0
      and actual_sales_calls >= 0
      and actual_new_customers >= 0
      and actual_content_published >= 0
    ),
  constraint business_center_monthly_metrics_notes_length_check
    check (notes is null or char_length(notes) <= 1000)
);

create index if not exists business_center_monthly_metrics_user_month_idx
  on public.business_center_monthly_metrics (user_id, month_start desc);

create table if not exists public.business_center_social_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  display_name text not null default '',
  handle text,
  normalized_handle text,
  profile_url text,
  normalized_profile_url text,
  followers_goal integer,
  is_active boolean not null default true,
  data_source text not null default 'manual',
  external_account_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_center_social_profiles_platform_check
    check (platform in ('Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Other')),
  constraint business_center_social_profiles_identifier_check
    check (
      nullif(btrim(coalesce(handle, '')), '') is not null
      or nullif(btrim(coalesce(profile_url, '')), '') is not null
    ),
  constraint business_center_social_profiles_followers_goal_check
    check (followers_goal is null or followers_goal >= 0),
  constraint business_center_social_profiles_data_source_check
    check (data_source = 'manual'),
  constraint business_center_social_profiles_normalized_handle_check
    check (
      normalized_handle is not distinct from
      nullif(lower(regexp_replace(btrim(coalesce(handle, '')), '^@+', '')), '')
    ),
  constraint business_center_social_profiles_normalized_url_check
    check (
      normalized_profile_url is not distinct from
      nullif(lower(regexp_replace(btrim(coalesce(profile_url, '')), '/+$', '')), '')
    )
);

create unique index if not exists business_center_social_profiles_handle_key
  on public.business_center_social_profiles (user_id, platform, normalized_handle)
  where normalized_handle is not null;

create unique index if not exists business_center_social_profiles_url_key
  on public.business_center_social_profiles (user_id, platform, normalized_profile_url)
  where normalized_handle is null and normalized_profile_url is not null;

create index if not exists business_center_social_profiles_user_active_idx
  on public.business_center_social_profiles (user_id, is_active, created_at desc);

create table if not exists public.business_center_social_snapshots (
  id uuid primary key default gen_random_uuid(),
  social_profile_id uuid not null references public.business_center_social_profiles(id) on delete cascade,
  snapshot_date date not null,
  followers_count integer not null default 0,
  views_count integer,
  profile_visits_count integer,
  attributed_leads_count integer,
  notes text,
  data_source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_center_social_snapshots_profile_date_key
    unique (social_profile_id, snapshot_date),
  constraint business_center_social_snapshots_metrics_check
    check (
      followers_count >= 0
      and (views_count is null or views_count >= 0)
      and (profile_visits_count is null or profile_visits_count >= 0)
      and (attributed_leads_count is null or attributed_leads_count >= 0)
    ),
  constraint business_center_social_snapshots_notes_length_check
    check (notes is null or char_length(notes) <= 500),
  constraint business_center_social_snapshots_data_source_check
    check (data_source = 'manual')
);

create index if not exists business_center_social_snapshots_profile_date_idx
  on public.business_center_social_snapshots (social_profile_id, snapshot_date desc);

drop trigger if exists set_business_center_monthly_metrics_updated_at
  on public.business_center_monthly_metrics;
create trigger set_business_center_monthly_metrics_updated_at
before update on public.business_center_monthly_metrics
for each row execute function public.set_updated_at();

drop trigger if exists set_business_center_social_profiles_updated_at
  on public.business_center_social_profiles;
create trigger set_business_center_social_profiles_updated_at
before update on public.business_center_social_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_business_center_social_snapshots_updated_at
  on public.business_center_social_snapshots;
create trigger set_business_center_social_snapshots_updated_at
before update on public.business_center_social_snapshots
for each row execute function public.set_updated_at();

alter table public.business_center_monthly_metrics enable row level security;
alter table public.business_center_social_profiles enable row level security;
alter table public.business_center_social_snapshots enable row level security;

drop policy if exists "business_center_monthly_metrics_select_own"
  on public.business_center_monthly_metrics;
create policy "business_center_monthly_metrics_select_own"
on public.business_center_monthly_metrics
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "business_center_monthly_metrics_insert_own"
  on public.business_center_monthly_metrics;
create policy "business_center_monthly_metrics_insert_own"
on public.business_center_monthly_metrics
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "business_center_monthly_metrics_update_own"
  on public.business_center_monthly_metrics;
create policy "business_center_monthly_metrics_update_own"
on public.business_center_monthly_metrics
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "business_center_social_profiles_select_own"
  on public.business_center_social_profiles;
create policy "business_center_social_profiles_select_own"
on public.business_center_social_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "business_center_social_profiles_insert_own"
  on public.business_center_social_profiles;
create policy "business_center_social_profiles_insert_own"
on public.business_center_social_profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "business_center_social_profiles_update_own"
  on public.business_center_social_profiles;
create policy "business_center_social_profiles_update_own"
on public.business_center_social_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "business_center_social_snapshots_select_own"
  on public.business_center_social_snapshots;
create policy "business_center_social_snapshots_select_own"
on public.business_center_social_snapshots
for select
to authenticated
using (
  exists (
    select 1
    from public.business_center_social_profiles profiles
    where profiles.id = social_profile_id
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "business_center_social_snapshots_insert_own"
  on public.business_center_social_snapshots;
create policy "business_center_social_snapshots_insert_own"
on public.business_center_social_snapshots
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_center_social_profiles profiles
    where profiles.id = social_profile_id
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "business_center_social_snapshots_update_own"
  on public.business_center_social_snapshots;
create policy "business_center_social_snapshots_update_own"
on public.business_center_social_snapshots
for update
to authenticated
using (
  exists (
    select 1
    from public.business_center_social_profiles profiles
    where profiles.id = social_profile_id
      and profiles.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.business_center_social_profiles profiles
    where profiles.id = social_profile_id
      and profiles.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
