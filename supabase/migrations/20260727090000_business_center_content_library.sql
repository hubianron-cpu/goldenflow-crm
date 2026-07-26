create table if not exists public.business_center_content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text not null,
  platform text not null,
  content_type text not null,
  status text not null default 'draft',
  published_on date,
  content_url text,
  topic text,
  target_audience text,
  promoted_product text,
  campaign_source text,
  notes text,
  views_count bigint,
  likes_count bigint,
  comments_count bigint,
  saves_count bigint,
  shares_count bigint,
  profile_visits_count bigint,
  metrics_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_center_content_items_title_check
    check (
      char_length(title) between 1 and 200
      and title = btrim(title)
    ),
  constraint business_center_content_items_platform_check
    check (platform in ('Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Other')),
  constraint business_center_content_items_type_check
    check (content_type in ('Reel', 'Post', 'Carousel', 'Story', 'Video', 'Live', 'Other')),
  constraint business_center_content_items_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint business_center_content_items_published_date_check
    check (status <> 'published' or published_on is not null),
  constraint business_center_content_items_url_check
    check (
      content_url is null
      or (
        char_length(content_url) <= 2048
        and content_url = btrim(content_url)
        and content_url ~* '^https?://'
      )
    ),
  constraint business_center_content_items_text_lengths_check
    check (
      (topic is null or char_length(topic) <= 150)
      and (target_audience is null or char_length(target_audience) <= 200)
      and (promoted_product is null or char_length(promoted_product) <= 200)
      and (campaign_source is null or char_length(campaign_source) <= 200)
      and (notes is null or char_length(notes) <= 1000)
    ),
  constraint business_center_content_items_metrics_check
    check (
      (views_count is null or views_count >= 0)
      and (likes_count is null or likes_count >= 0)
      and (comments_count is null or comments_count >= 0)
      and (saves_count is null or saves_count >= 0)
      and (shares_count is null or shares_count >= 0)
      and (profile_visits_count is null or profile_visits_count >= 0)
    )
);

alter table public.business_center_content_items enable row level security;

create unique index if not exists business_center_content_items_owner_platform_url_key
  on public.business_center_content_items (user_id, platform, content_url)
  where content_url is not null;

create index if not exists business_center_content_items_owner_status_date_idx
  on public.business_center_content_items (
    user_id,
    status,
    published_on desc nulls last,
    created_at desc
  );

create index if not exists business_center_content_items_owner_platform_idx
  on public.business_center_content_items (user_id, platform);

create index if not exists business_center_content_items_owner_views_idx
  on public.business_center_content_items (
    user_id,
    views_count desc nulls last,
    created_at desc
  );

drop trigger if exists set_business_center_content_items_updated_at
  on public.business_center_content_items;
create trigger set_business_center_content_items_updated_at
before update on public.business_center_content_items
for each row execute function public.set_updated_at();

drop policy if exists "business_center_content_items_select_own"
  on public.business_center_content_items;
create policy "business_center_content_items_select_own"
on public.business_center_content_items
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "business_center_content_items_insert_own"
  on public.business_center_content_items;
create policy "business_center_content_items_insert_own"
on public.business_center_content_items
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "business_center_content_items_update_own"
  on public.business_center_content_items;
create policy "business_center_content_items_update_own"
on public.business_center_content_items
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

notify pgrst, 'reload schema';
