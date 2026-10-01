-- Disposable CI/local database ONLY. Mirrors the read-only Production findings.
alter table public.user_subscriptions drop constraint user_subscriptions_status_check;
alter table public.user_subscriptions add constraint user_subscriptions_status_check
  check (status in ('trial','active','expired','cancelled'));
alter table public.user_subscriptions add constraint user_subscriptions_cancellation_window_check
  check ((renewal_cancelled_at is null and access_until is null) or
    (renewal_cancelled_at is not null and access_until is not null and access_until > renewal_cancelled_at));
