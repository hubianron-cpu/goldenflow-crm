create table if not exists public.roi_tools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null default '',
  monthly_cost numeric not null default 0 check (monthly_cost >= 0),
  leads_count integer not null default 0 check (leads_count >= 0),
  sales_count integer not null default 0 check (sales_count >= 0),
  average_sale_value numeric not null default 0 check (average_sale_value >= 0),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists roi_tools_user_created_idx on public.roi_tools (user_id, created_at desc);

alter table public.roi_tools enable row level security;

drop policy if exists "roi_tools_select_own" on public.roi_tools;
drop policy if exists "roi_tools_insert_own" on public.roi_tools;
drop policy if exists "roi_tools_update_own" on public.roi_tools;
drop policy if exists "roi_tools_delete_own" on public.roi_tools;

create policy "roi_tools_select_own"
on public.roi_tools
for select
to authenticated
using (user_id = auth.uid());

create policy "roi_tools_insert_own"
on public.roi_tools
for insert
to authenticated
with check (user_id = auth.uid());

create policy "roi_tools_update_own"
on public.roi_tools
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "roi_tools_delete_own"
on public.roi_tools
for delete
to authenticated
using (user_id = auth.uid());

notify pgrst, 'reload schema';
