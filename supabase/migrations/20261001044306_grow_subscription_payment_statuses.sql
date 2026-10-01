begin;

-- Production cancellation migrations narrowed the earlier Grow status constraint.
-- Extend only the accepted states; do not rewrite subscription or audit rows.
alter table public.user_subscriptions
  drop constraint user_subscriptions_status_check;
alter table public.user_subscriptions
  add constraint user_subscriptions_status_check
  check (status in ('trial','active','expired','cancelled','payment_failed','past_due'))
  not valid;
alter table public.user_subscriptions
  validate constraint user_subscriptions_status_check;

commit;
