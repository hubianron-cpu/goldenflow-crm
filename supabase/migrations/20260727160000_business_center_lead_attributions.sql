create table if not exists public.business_center_lead_attributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  content_item_id uuid not null references public.business_center_content_items(id) on delete restrict,
  attribution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_center_lead_attributions_notes_check
    check (
      attribution_notes is null
      or (
        char_length(attribution_notes) <= 500
        and attribution_notes = btrim(attribution_notes)
      )
    )
);

alter table public.business_center_lead_attributions enable row level security;

create unique index if not exists business_center_lead_attributions_user_lead_key
  on public.business_center_lead_attributions (user_id, lead_id);

create index if not exists business_center_lead_attributions_user_idx
  on public.business_center_lead_attributions (user_id);

create index if not exists business_center_lead_attributions_content_idx
  on public.business_center_lead_attributions (content_item_id);

create index if not exists business_center_lead_attributions_user_content_idx
  on public.business_center_lead_attributions (user_id, content_item_id);

drop trigger if exists set_business_center_lead_attributions_updated_at
  on public.business_center_lead_attributions;
create trigger set_business_center_lead_attributions_updated_at
before update on public.business_center_lead_attributions
for each row execute function public.set_updated_at();

drop policy if exists "business_center_lead_attributions_select_own"
  on public.business_center_lead_attributions;
create policy "business_center_lead_attributions_select_own"
on public.business_center_lead_attributions
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.leads
    where leads.id = business_center_lead_attributions.lead_id
      and leads.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.business_center_content_items
    where business_center_content_items.id =
      business_center_lead_attributions.content_item_id
      and business_center_content_items.user_id = auth.uid()
  )
);

drop policy if exists "business_center_lead_attributions_insert_own"
  on public.business_center_lead_attributions;
create policy "business_center_lead_attributions_insert_own"
on public.business_center_lead_attributions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.leads
    where leads.id = business_center_lead_attributions.lead_id
      and leads.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.business_center_content_items
    where business_center_content_items.id =
      business_center_lead_attributions.content_item_id
      and business_center_content_items.user_id = auth.uid()
  )
);

drop policy if exists "business_center_lead_attributions_update_own"
  on public.business_center_lead_attributions;
create policy "business_center_lead_attributions_update_own"
on public.business_center_lead_attributions
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.leads
    where leads.id = business_center_lead_attributions.lead_id
      and leads.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.business_center_content_items
    where business_center_content_items.id =
      business_center_lead_attributions.content_item_id
      and business_center_content_items.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.leads
    where leads.id = business_center_lead_attributions.lead_id
      and leads.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.business_center_content_items
    where business_center_content_items.id =
      business_center_lead_attributions.content_item_id
      and business_center_content_items.user_id = auth.uid()
  )
);

drop policy if exists "business_center_lead_attributions_delete_own"
  on public.business_center_lead_attributions;
create policy "business_center_lead_attributions_delete_own"
on public.business_center_lead_attributions
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.leads
    where leads.id = business_center_lead_attributions.lead_id
      and leads.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.business_center_content_items
    where business_center_content_items.id =
      business_center_lead_attributions.content_item_id
      and business_center_content_items.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
