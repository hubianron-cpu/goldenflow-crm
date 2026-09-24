begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  owner_action "char";
  attribution_action "char";
  attribution_deferrable boolean;
  attribution_deferred boolean;
begin
  if to_regclass('public.business_center_content_items') is null
    or to_regclass('public.business_center_lead_attributions') is null then
    raise exception 'CRM content and attribution tables must both exist';
  end if;

  select confdeltype into owner_action
  from pg_constraint
  where conrelid = 'public.business_center_content_items'::regclass
    and conname = 'business_center_content_items_user_id_fkey';

  if owner_action = 'a' then
    alter table public.business_center_content_items
      drop constraint business_center_content_items_user_id_fkey;
    alter table public.business_center_content_items
      add constraint business_center_content_items_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  elsif owner_action is distinct from 'c' then
    raise exception 'Unexpected content owner foreign key action: %', owner_action;
  end if;

  select confdeltype, condeferrable, condeferred
    into attribution_action, attribution_deferrable, attribution_deferred
  from pg_constraint
  where conrelid = 'public.business_center_lead_attributions'::regclass
    and conname = 'business_center_lead_attributions_content_item_id_fkey';

  if attribution_action = 'r' then
    alter table public.business_center_lead_attributions
      drop constraint business_center_lead_attributions_content_item_id_fkey;
    alter table public.business_center_lead_attributions
      add constraint business_center_lead_attributions_content_item_id_fkey
      foreign key (content_item_id) references public.business_center_content_items(id)
      on delete no action deferrable initially deferred;
  elsif attribution_action is distinct from 'a'
    or not attribution_deferrable
    or not attribution_deferred then
    raise exception 'Unexpected content attribution foreign key configuration';
  end if;
end $$;

commit;
