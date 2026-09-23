begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  deletion_action "char";
begin
  if to_regclass('public.client_activations') is not null then
    if exists (
      select 1 from public.client_activations a
      left join auth.users u on u.id = a.business_id
      where u.id is null
    ) then
      raise exception 'client_activations contains an unknown business_id';
    end if;

    select c.confdeltype into deletion_action
    from pg_constraint c
    where c.conrelid = 'public.client_activations'::regclass
      and c.conname = 'client_activations_business_id_fkey';

    if deletion_action is null then
      alter table public.client_activations
        add constraint client_activations_business_id_fkey
        foreign key (business_id) references auth.users(id) on delete cascade;
    elsif deletion_action <> 'c' then
      raise exception 'client_activations business_id foreign key has unexpected delete action';
    end if;
  end if;

  if to_regclass('public.business_center_content_items') is not null then
    select c.confdeltype into deletion_action
    from pg_constraint c
    where c.conrelid = 'public.business_center_content_items'::regclass
      and c.conname = 'business_center_content_items_user_id_fkey';

    if deletion_action is null then
      raise exception 'business_center_content_items user_id foreign key is missing';
    elsif deletion_action <> 'c' then
      alter table public.business_center_content_items
        drop constraint business_center_content_items_user_id_fkey;
      alter table public.business_center_content_items
        add constraint business_center_content_items_user_id_fkey
        foreign key (user_id) references auth.users(id) on delete cascade;
    end if;
  end if;
end $$;

commit;
