alter table public.user_subscriptions
  add column if not exists grow_transaction_code text,
  add column if not exists grow_direct_debit_id text,
  add column if not exists grow_last_payment_date timestamptz,
  add column if not exists grow_last_payment_sum numeric,
  add column if not exists grow_last_error_message text;

alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_status_check;

alter table public.user_subscriptions
  add constraint user_subscriptions_status_check
  check (status in ('trial', 'active', 'expired', 'cancelled', 'payment_failed', 'past_due'));

create table if not exists public.grow_webhook_events (
  id uuid primary key default gen_random_uuid(),
  transaction_code text unique,
  event_type text not null,
  user_id uuid references public.users(id) on delete set null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists grow_webhook_events_transaction_code_idx
on public.grow_webhook_events (transaction_code);

create index if not exists grow_webhook_events_user_id_idx
on public.grow_webhook_events (user_id);

alter table public.grow_webhook_events enable row level security;

drop policy if exists "Admins only can view grow webhook events" on public.grow_webhook_events;

notify pgrst, 'reload schema';
