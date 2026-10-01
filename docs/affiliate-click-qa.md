# Local click limiter acceptance - 2026-10-01

Uncommitted follow-up to PR #34 / head 6dee0da. CRM only.

Database: disposable postgres:17 container gf-affiliate-qa-20261001-limit.
Container network was NONE, with no published ports and a read-only repository
mount. No Staging/Production credentials or customer data were used.

Applied only inside this isolated database: test bootstrap, affiliate_referrals,
and 20261001025829_affiliate_click_rate_limit.sql.

Executed tests/affiliate-click-limit.sql as service_role with ON_ERROR_STOP=1:
unsupported partner rejected; 60 creations accepted then blocked without insertion;
500 rows in the hourly window blocked creation; expired window restored capacity;
30-day expiry verified; anon/authenticated execute denied and service_role allowed.
Fixture changes rolled back.

Executed tests/affiliate-click-concurrency.test.mjs through docker exec psql in
independent sessions: 58 existing rows + 20 parallel calls produced exactly two
created responses and 18 rate_limited responses. Final count 60; test cleanup was
limited to the disposable database. The container was stopped after verification.

This is real Postgres SQL/concurrency evidence, not mocked database behavior.
It is not evidence of deployment, application of a Production migration or new CI.
No retained QA accounts, payment receiver, Production resources or backup files
were deleted. Public disclosure approval and authorized Production read-only checks
remain pending; the draft is not a legal approval.
