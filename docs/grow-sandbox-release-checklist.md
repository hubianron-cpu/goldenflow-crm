# Grow Sandbox release-handler preparation

Prepared 2026-10-01. CRM only. Initial preparation below is historical; subsequent
approved acceptance results are recorded in the follow-up section at the end.

## Read-only evidence

- Release head: `6dee0da0016690187aea6fa0ea3b8a76f7e1ba95`; PR #34 remains Draft.
- Vercel project: `goldenflow-crm`, deployment `dpl_EABjzoWtcJZ89zDEi74nddXfJ74q`, Ready Preview.
- Immutable URL: `https://goldenflow-f83ucwbqn-ronhubi15-6252s-projects.vercel.app`.
- Deployment metadata matches `feature/affiliate-amitifargan-v1` and the release head.
- Branch-specific Preview Supabase URL equals `https://pzxwaoghixsqcstfrorn.supabase.co`.
- Branch-specific anon JWT project reference equals `pzxwaoghixsqcstfrorn`.
- `SUPABASE_SERVICE_ROLE_KEY` and `GROW_WEBHOOK_KEY` have dedicated Preview entries for this branch, predating deployment. They override general entries, but Sensitive values are unavailable for inspection: their actual content has NOT been reverified.
- Branch-specific `AFFILIATE_TRACKING_ENABLED` is true for this Preview only. No Production flag was changed.
- Vercel SSO protection is `all_except_custom_domains`. A cookie-free POST with empty JSON to this Preview webhook returned HTTP 401 with a Vercel Authentication marker, not the application Unauthorized response. Provider ingress is blocked before the application handler.
- The old isolated QA project was removed. Its former URL, expired guard and deleted fixture must not be reused as if they were a working endpoint.

Status: configuration isolation is partially verified; end-to-end runtime isolation and provider reachability remain BLOCKED. No sensitive values were saved in this document.

## Proposed isolated test target (requires separate approval)

Do not weaken CRM deployment protection or use a broad project bypass token.
Prepare a separate, temporary QA project only after approval for its public endpoint and Staging secret access. Its guard must delegate to the exact release handler from the head above, without implementing a second payment processor.

Requirements before accepting a payment:

1. Pin the Supabase URL to Staging; verify the service credential against that project without printing it. Never use Production credentials. New secret-format keys need a live project/privilege check, not a JWT-only guard.
2. Use a dedicated webhook secret, server-side only, QA email AND Auth UUID allowlist, request size limits, and an explicit expiry no more than 48 hours ahead. Default disabled.
3. Create a fresh synthetic Auth account through the supported Auth Admin API and verify its affiliate claim. Existing atomic-test fixture already has a conversion and cannot prove a first conversion again. No real customer account is allowed.
4. Build the receiver from the pinned release commit. Keep all temporary receiver code outside the release commit and PR deployment. Never package the old guard unchanged: it contains a deleted QA user and expired configuration.
5. Test cookie-free rejection for no/wrong secret, other identity, unsupported body, and disabled/expired configuration; ensure no tenant writes. A fresh target also needs one authorized synthetic success/retry probe before the real payment, using its own disposable fixture so the payment fixture remains unconverted.
6. Verify the existing Make Grow connection's Sandbox environment using configuration, not its name. The old scenario IDs (creator 7689571, callback 7705992) are historical references, not proof of current saved state. Do not edit or activate them yet.
7. Prepare a separate OFF callback scenario: original callback fields -> dedicated secret header -> receiver -> approval gate -> Grow Approve Transaction. Preserve actual status, statusCode, transaction ID, payer email, amount and date; do not rewrite status to success.
8. Approval gate must require HTTP success AND `ok=true` AND either a processed successful payment or `duplicate_verified=true`. A duplicate is not a second subscription or conversion. Reject ignored/error/payment_failed results even when HTTP 200.
9. Save the proposed callback URL and exact field mapping for separate approval. Do not change the payment-link creator's notify URL or run either scenario yet.

## Separately approved single payment

- One verified Grow Sandbox payment link, ILS 1, pinned to the fresh QA email and UUID where supported.
- Sandbox host and documented test card only; no real payment instrument.
- Before payment: trial subscription, one claimed referral, zero conversion and payment events.
- After callback through deployed release handler: successful subscription processing, exactly one transaction audit row and one first conversion.
- Replay the same callback once, without creating/paying a second link: verified duplicate, successful provider acknowledgment and unchanged subscription/referral/audit snapshots.
- Provider acknowledgment is a separate observation from receiver HTTP 200. Do not claim autonomous retry timing was tested by manual replay.
- Keep scheduling OFF after the run. Cleanup of fixture, temporary project and secrets requires separate approval; retain evidence without credentials.

No payment, Make edit/run, receiver creation, secret change, Production operation, merge or fixture deletion occurred in this preparation.

## Subsequent authorized acceptance and current release gates

The user subsequently authorized isolated provisioning and one Sandbox payment.
Preview `dpl_Fp1oViKXgaboiZ7hLwYnRMmjfHpK` in separate project
`goldenflow-crm-grow-release-qa` delegated to release `6dee0da` with Staging-only
credentials and allowlisted synthetic identities. Wrong key returned 401; a foreign
synthetic identity returned 422, without cookies or redirects.

One ILS 1 payment on sandbox.grow.link reached the real release handler through Make
run `46d19e1748154729b9ecd78adabc7c03` at 05:15:52 Asia/Jerusalem on 2026-10-01.
Grow approval succeeded. Transaction `553047` produced one activation audit and
one referral conversion in Staging. Both scenarios remained Inactive afterward.
No replay of this real callback or autonomous provider retry was tested. Earlier
synthetic deployed retries and database concurrency passed and remain separate.

Guard expiry remains 2026-10-01T03:30:01.043Z. Neither expiry nor environment-key
rotation deletes immutable deployments or synthetic accounts. Cleanup is separately
authorized; no cleanup is part of the release review.

PR #34 remains Draft. The follow-up click limiter is local/uncommitted; its new SQL
and concurrency tests passed on disposable local Postgres 17. New-head CI remains
pending commit/push; previous green CI does not validate the local changes. Check
Production schema/privileges and legacy paid-event compatibility read-only after
reauthentication. Approve affiliate disclosure and operational reconciliation before
enabling tracking. No migration, merge or Production deployment is authorized here.
