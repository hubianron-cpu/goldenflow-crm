# Production read-only review - 2026-10-01

Verified in Chrome SQL Editor, project vzzbegctrqnxxsrfmvjo (CRM for Coach).
Queries executed inside BEGIN TRANSACTION READ ONLY, metadata and aggregates only.
No business RPC invoked; no account, subscription, event or schema changed.

- Base Grow and cancellation/access columns exist.
- affiliate_referrals is absent. Both process_grow_callback and create_affiliate_click
  are absent. Application rollout before migrations would fail payment processing.
- user_subscriptions has a unique user_id, Auth FK with cascade and the paired
  cancellation/access check. Its status check currently allows only trial, active,
  expired, cancelled: payment_failed writes would fail. A focused status migration
  now accompanies this release; it changes the check, not existing row values.
- RLS is enabled on subscriptions and Grow events. Subscriptions have owner SELECT
  and false INSERT/UPDATE/DELETE policies for authenticated. Grow events have no
  public policies. service_role has required existing table grants. New affiliate
  table/function grants must be verified after their approved migrations.
- Two historical activation audits have comparable amount fields but null user_id.
  Neither matches any subscription's current transaction. They cannot be called
  verified duplicates: retry through the new RPC safely returns identity-unavailable
  409. Do not fabricate ownership, delete audit rows or reactivate an account.

## Ordered release gates

1. Green CI for the new head, including Production-parity constraints and SQL tests.
2. Verify a recoverable current backup under the approved retention policy.
3. Obtain specific Production migration approval. Apply affiliate_referrals, atomic
   Grow processing, shared click limiter, and payment status extension before app
   release. Existing base/cancellation columns need no repeat migration.
4. Verify RLS, table grants, exact RPC bodies, server-only execute and status check.
5. Obtain release approval and deploy the tested head, initially tracking OFF.
6. Enable partner tracking only after explicit operational approval/disclosure
   decision. Ron has requested launch before legal review; this is not legal signoff.
   Record that pending review and do not claim cookie/retention compliance is proven.

No cleanup of retained QA fixtures or temporary receiver is part of these steps.
