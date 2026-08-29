create extension if not exists "pgcrypto";

create table if not exists public.agent_integration_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_prefix text not null,
  token_hash text not null unique,
  scopes text[] not null default array[]::text[],
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agent_integration_credentials_name_check
    check (char_length(btrim(name)) between 1 and 100),
  constraint agent_integration_credentials_token_prefix_check
    check (token_prefix ~ '^gflf_[a-f0-9]{12}$'),
  constraint agent_integration_credentials_token_hash_check
    check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint agent_integration_credentials_scopes_check
    check (cardinality(scopes) > 0)
);

create index if not exists agent_integration_credentials_user_active_idx
  on public.agent_integration_credentials (user_id, revoked_at, expires_at);

alter table public.agent_integration_credentials enable row level security;

-- Credentials are server-managed only. No anon/authenticated RLS policies are created.
revoke all on table public.agent_integration_credentials from anon, authenticated;
grant select, insert, update, delete on table public.agent_integration_credentials to service_role;

comment on table public.agent_integration_credentials is
  'Server-only, revocable integration credentials. Raw tokens are never stored.';

notify pgrst, 'reload schema';
