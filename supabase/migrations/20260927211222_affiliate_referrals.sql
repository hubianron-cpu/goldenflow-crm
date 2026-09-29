begin;

create table public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  click_token uuid not null unique,
  affiliate_code text not null check (affiliate_code ~ '^[a-z0-9_]{3,40}$'),
  clicked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  user_id uuid unique references auth.users(id) on delete cascade,
  conversion_transaction_code text unique,
  conversion_amount numeric(12,2),
  converted_at timestamptz,
  constraint affiliate_referral_window check (expires_at > clicked_at),
  constraint affiliate_conversion_complete check (
    (conversion_transaction_code is null and conversion_amount is null and converted_at is null)
    or (conversion_transaction_code is not null and conversion_amount is not null and converted_at is not null and user_id is not null)
  )
);

create index affiliate_referrals_code_click_idx on public.affiliate_referrals (affiliate_code, clicked_at);
create index affiliate_referrals_expiry_idx on public.affiliate_referrals (expires_at);

alter table public.affiliate_referrals enable row level security;
revoke all on public.affiliate_referrals from anon, authenticated;
grant select, insert, update, delete on public.affiliate_referrals to service_role;

comment on table public.affiliate_referrals is 'CRM affiliate click, registration, and first confirmed payment; server only. Converted rows require refund reconciliation before commission payout.';

notify pgrst, 'reload schema';
commit;
