# Grow / Meshulam webhook

This webhook is for GoldenFlow CRM subscription activation after a successful recurring payment in Grow / Meshulam.

## Vercel environment variable

Add this server-only variable in Vercel:

```text
GROW_WEBHOOK_KEY=...
```

Do not prefix it with `NEXT_PUBLIC_`.

## Notify URL

Paste this Notify URL inside Grow / Meshulam:

```text
https://app.goldenflowcrm.com/api/webhooks/grow
```

## Required Supabase SQL

Run this migration in the Supabase SQL Editor before enabling the webhook:

```text
supabase/20260604_grow_meshulam_webhook.sql
```

It adds Grow payment fields to `public.user_subscriptions` and creates `public.grow_webhook_events` for idempotency.

The affiliate release additionally requires, in order:

1. `supabase/migrations/20260927211222_affiliate_referrals.sql`.
2. `supabase/migrations/20260930231614_grow_atomic_processing.sql`.
3. Deploy the application only after verifying the function and its privileges.

Production migrations, merge and deployment require separate approval. A missing RPC
fails closed with HTTP 500; there is no fallback to non-atomic subscription writes.
The RPC uses invoker permissions, is executable only by `service_role`, and commits
subscription updates, affiliate conversion and the minimized audit in one transaction.
A transaction-scoped advisory lock serializes the same transaction even before its
audit row exists. A subscription row lock also serializes different transactions
for the same user and preserves concurrent manual cancellation.

## Payment and retry contract

The actual Grow envelope `status=1` is accepted only with nested `data.statusCode=2`
and no payment/error signal contradicting it. The legacy `status=success` format
remains supported. Do not rewrite provider callbacks to force a successful outcome.

Every callback needs a nonempty transaction ID. Successful payments also need a
positive finite amount and a payer email matching the resolved CRM user. Missing
transaction IDs return HTTP 400; identity/amount conflicts return HTTP 409.
Verify these fields in the Sandbox integration before approving the release.

A verified retry of a recorded successful payment returns `duplicate_verified=true`
without updating the subscription, attribution or audit. Its `status=active` describes
the original payment processing result, not the user's current subscription access.
An `ignored` or `payment_failed` event can advance to success on the same transaction;
late failures cannot undo that success. Database errors roll back all three writes
and return HTTP 500 so the provider can retry safely.

## Verification gates

- Run `node --test tests/grow-webhook-retry.test.mjs` for the release route/RPC boundary.
- Run `tests/grow-atomic.sql` on Staging for real SQL behavior and rollback; it rolls
  back its synthetic fixtures and its temporary failure trigger.
- CI runs the same migration and SQL tests on disposable Postgres, plus independent
  concurrent sessions in `tests/grow-atomic-concurrency.test.mjs`.
- `tests/grow-staging-concurrency.mjs <synthetic-user-id>` is an opt-in local runner
  for the actual release route against Staging, not a public deployed QA endpoint.
  It requires a synthetic account with a QA-prefixed email and stores no credentials.
- Keep PR #34 Draft until the remaining release and activation gates pass.
- On 2026-10-01 the isolated receiver delegated to the exact release handler at
  `6dee0da` and processed one real ILS 1 Grow Sandbox callback. Make run
  `46d19e1748154729b9ecd78adabc7c03` completed successfully; provider approval had
  Status 1 and empty Err. Staging readback showed one activation audit and one
  first referral conversion for transaction `553047`. Both scenarios stayed OFF.
- This proves the first real callback and acknowledgment, not autonomous provider
  retry timing or a replay of that real callback on this head. Synthetic deployed
  retry and live database concurrency evidence remain separate.

### Live Staging concurrency evidence (2026-10-01)

The local runner executed the release webhook module against Supabase Staging
`pzxwaoghixsqcstfrorn` using synthetic Auth fixture
`116ccdaf-6ceb-4784-83a6-e7bc5ca26f51`. The process exited successfully:

- 20 simultaneous callbacks: one successful processing and 19 verified duplicates.
- 10 parallel retries: subscription, referral and audit snapshots unchanged.
- Concurrent late failure and success: the successful result remained unchanged.
- Pending then failed then 10 parallel successful callbacks: one promotion and
  nine verified duplicates; the first affiliate conversion remained unchanged.
- Read-only database confirmation: two successful event rows for two distinct
  test transactions, one first conversion and an active synthetic subscription.

This proves concurrency against the live Staging database through the actual
release handler, with synthetic provider payloads. It is not a real Grow payment
or a deployed HTTP ingress test. Credentials were kept in memory only. The local
runner shut down after completion; the synthetic fixture remains pending cleanup
approval. Earlier setup failures were caused by incomplete synthetic Auth fields,
not payment processing; those fields were corrected only for this fixture.
GitHub Actions run `36798957641` completed successfully on release commit
`6dee0da0016690187aea6fa0ea3b8a76f7e1ba95`, including SQL and independent-session
concurrency tests. Keep PR #34 Draft; no merge or Production migration/deployment
is authorized by this evidence. See `grow-sandbox-release-checklist.md` for the
historical preparation and the updated acceptance evidence below.

## Affiliate activation and release prerequisites

The current local follow-up uses `create_affiliate_click(text)` instead of a direct
insert. It serializes new clicks per partner in Postgres and caps them at 60 per
rolling minute and 500 per rolling hour, shared across serverless instances.
No visitor IP or new persistent limiter table is stored. Existing valid unclaimed
cookies retain their original expiry without consuming new-click capacity.
Capacity exhaustion returns HTTP 429 with Retry-After; database errors or a missing
RPC fail closed with HTTP 503. These are global partner caps, not per-person limits:
an attacker can exhaust availability, but cannot create unlimited click rows through
the application route. Consider edge-level abuse protection if traffic warrants it.

Apply only approved missing prerequisites in this order before deployment/activation:
base Grow schema and cancellation/access fields; affiliate-referrals migration;
atomic Grow processing migration; `20261001025829_affiliate_click_rate_limit.sql`.
Also apply `20261001044306_grow_subscription_payment_statuses.sql` before app
deployment: Production's current status check rejects payment_failed. Production
read-only schema/aggregate findings are recorded in affiliate-production-readiness.md.
Verify server-only RPC execution, required table grants, RLS and PostgREST reload.
Tracking OFF does not bypass the atomic payment RPC requirement.

Local helper/route tests passed for the follow-up. Disposable Postgres 17 minute/hour,
window recovery and privileges tests passed as service_role. Twenty independent
concurrent sessions with 58 existing minute-window rows created exactly two rows
and rejected 18 requests; the final count remained 60. Tests are also wired into
CI, which has NOT yet run for this uncommitted follow-up. Prior green CI and Sandbox
evidence apply to `6dee0da`, not a later untested head. Production read-only schema,
privilege and legacy event compatibility checks completed read-only; missing
migrations and orphaned historical retries remain release considerations.

Affiliate disclosure and manual first-payment/refund/commission reconciliation
must be approved before tracking is enabled. Attribution expiry is NOT a database
deletion policy. Do not claim expired click rows are automatically deleted.
See `affiliate-release-policy.md` for the draft disclosure and operational gates.
Temporary receiver expiry blocks processing but does not delete deployments or QA
accounts. Cleanup requires separate approval; do not extend or delete implicitly.

## User matching

The webhook tries to match a GoldenFlow CRM user in this order:

1. Internal user id from `cField1`, `cField2`, `dynamicFields`, or `purchaseCustomField`.
2. Existing `grow_direct_debit_id` for failed recurring payments.
3. `payerEmail` or `email`.

When possible, send the Supabase auth user id in a custom field from Grow / Meshulam.

## Safe test payload

Use a test user email and the same webhook key configured in Vercel:

```json
{
  "webhookKey": "YOUR_GROW_WEBHOOK_KEY",
  "transactionCode": "TEST-TX-001",
  "status": "success",
  "paymentSum": "199",
  "payerEmail": "test@example.com",
  "directDebitId": "TEST-DD-001"
}
```

Expected result:

- First request: subscription changes to `active`.
- Verified duplicate request: acknowledged without additional writes.
- Wrong `webhookKey`: returns `401 Unauthorized`.
