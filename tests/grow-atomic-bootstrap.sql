-- Disposable CI Postgres only; never apply this bootstrap to Supabase.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, raw_app_meta_data jsonb);
create table public.users(id uuid primary key references auth.users(id) on delete cascade, email text);
create table public.user_subscriptions(
  user_id uuid primary key references public.users(id) on delete cascade,
  status text not null default 'trial', plan_name text not null default 'trial_14_days',
  trial_start_at timestamptz default now(), trial_end_at timestamptz default now()+interval '14 days',
  upgraded_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now(),
  renewal_cancelled_at timestamptz, access_until timestamptz
);
create function public.create_atomic_test_user() returns trigger language plpgsql as $$
begin
  insert into public.users(id,email) values(new.id,new.email);
  insert into public.user_subscriptions(user_id) values(new.id);
  return new;
end;
$$;
create trigger create_atomic_test_user after insert on auth.users
  for each row execute function public.create_atomic_test_user();
grant usage on schema public to service_role;
alter default privileges in schema public grant select,insert,update,delete on tables to service_role;
grant select,insert,update,delete on public.user_subscriptions to service_role;
