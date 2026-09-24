begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  owner_column smallint;
  owner_fk record;
begin
  if to_regclass('public.roi_tools') is null then
    raise exception 'roi_tools baseline schema must exist before account-deletion migration';
  end if;

  select attnum into owner_column
  from pg_attribute
  where attrelid = 'public.roi_tools'::regclass
    and attname = 'user_id'
    and not attisdropped;

  if owner_column is null then
    raise exception 'roi_tools.user_id is missing';
  end if;

  if exists (
    select 1 from public.roi_tools r
    left join auth.users u on u.id = r.user_id
    where u.id is null
  ) then
    raise exception 'roi_tools contains an unknown user_id; reconcile rows before adding cascade';
  end if;

  if (
    select count(*) from pg_constraint
    where conrelid = 'public.roi_tools'::regclass
      and contype = 'f'
      and conkey = array[owner_column]::smallint[]
  ) > 1 then
    raise exception 'roi_tools.user_id has multiple foreign keys';
  end if;

  select conname, confrelid, confdeltype, convalidated into owner_fk
  from pg_constraint
  where conrelid = 'public.roi_tools'::regclass
    and contype = 'f'
    and conkey = array[owner_column]::smallint[];

  if not found then
    alter table public.roi_tools
      add constraint roi_tools_user_id_fkey
      foreign key (user_id) references auth.users(id)
      on delete cascade not valid;
    alter table public.roi_tools
      validate constraint roi_tools_user_id_fkey;
  elsif owner_fk.confrelid <> 'auth.users'::regclass
    or owner_fk.confdeltype <> 'c'
    or not owner_fk.convalidated then
    raise exception 'roi_tools.user_id has an unexpected foreign key';
  end if;
end $$;

commit;
