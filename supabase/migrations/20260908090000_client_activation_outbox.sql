alter table public.leads
  add column if not exists id_number text,
  add column if not exists program text,
  add column if not exists currency text not null default 'ILS';

alter table public.leads drop constraint if exists leads_activation_currency_check;
alter table public.leads add constraint leads_activation_currency_check
  check (currency ~ '^[A-Z]{3}$');

alter table public.leads drop constraint if exists leads_activation_id_number_check;
alter table public.leads add constraint leads_activation_id_number_check
  check (id_number is null or id_number ~ '^[0-9]{5,20}$');

create table if not exists public.crm_client_activation_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  event_type text not null default 'deal.won',
  delivery_status text not null default 'pending',
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  constraint crm_client_activation_outbox_unique unique (user_id, lead_id, event_type),
  constraint crm_client_activation_outbox_status_check check (delivery_status in ('pending','delivered','failed','manual_review')),
  constraint crm_client_activation_outbox_event_check check (event_type = 'deal.won'),
  constraint crm_client_activation_outbox_attempt_check check (attempt_count >= 0)
);

create index if not exists crm_client_activation_outbox_pending_idx
  on public.crm_client_activation_outbox (user_id, delivery_status, updated_at);

alter table public.crm_client_activation_outbox enable row level security;
revoke all on public.crm_client_activation_outbox from anon, authenticated;
