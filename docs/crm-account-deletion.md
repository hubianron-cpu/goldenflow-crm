# CRM business account deletion

Status: staging-verified database correction. Full account deletion is not yet verified; this is not a self-service flow or Production runbook approval.

## Scope

- Identify the exact CRM `auth.users.id` after verifying the requester's identity. Do not identify the account by an email appearing in a lead, payment event, or Trainer record.
- Cancel billing separately in Grow and record the paid-through date before closing access. Deleting a CRM account does not cancel a Grow mandate.
- Pause CRM-to-Activation dispatch and resolve in-flight deliveries before deleting the account. Local `client_activations` and child events belong to the CRM business ID and are deleted; Trainer clients are a separate service and must not be deleted automatically.
- If the account has a Google Calendar connection, revoke its Google grant before deleting the encrypted refresh token. Deleting the database connection alone is not evidence of remote revocation.
- Inventory any CRM Storage objects before Auth deletion. Use the Storage API to remove them; deleting `storage.objects` rows directly can orphan files. CRM Staging had no buckets on 2026-09-23.
- Preserve only the approved minimized Grow payment evidence, with no account `user_id` or raw provider payload. Payment-provider records and provider-managed or manual backups have independent retention rules.

## Database gate

The migration `20260923205606_crm_account_deletion_cascade.sql` makes local Activation records cascade with their CRM Auth business owner. It changes `business_center_content_items.user_id` to `ON DELETE CASCADE` when that table exists. It aborts if an Activation row has no matching Auth owner.

Before any Production deletion, verify every CRM-owned foreign key to `auth.users` has the intended delete action. In particular, confirm the content-items table exists and its `user_id` FK is `ON DELETE CASCADE`; it was absent in CRM Staging during this QA. Confirm Activation rows for the target business, Google connection state, Storage inventory, and minimized Grow payloads without exporting personal data. Obtain a recoverable backup and separate Production approval.

After the authorized Auth Admin deletion, verify zero target rows in `users`, `leads`, `tasks`, `manual_expenses`, `google_calendar_connections`, `google_calendar_events`, `agent_integration_credentials`, `crm_client_activation_outbox`, `client_activations`, and `client_activation_events` (through the exact activation IDs). Check indirect lead-owned tables too. Confirm retained Grow rows have `user_id IS NULL` and only approved payment fields. Do not report backup, Google, Grow, or Trainer data as deleted merely because CRM Auth deletion succeeded.

## Staging QA evidence

During this QA, a synthetic Auth user with a lead, task, Activation row, Activation event, and minimized Grow audit row was deleted in `goldenflow-crm-staging` (`pzxwaoghixsqcstfrorn`) through the Auth Admin API. The operational rows and Auth user disappeared; the audit row lost its `user_id` and was then removed because it was synthetic. Independent aggregate checks found no synthetic remnants. The `business_center_content_items` branch of the migration, a real Google revocation, and a CRM Storage deletion were not exercised in that environment.

Run `tests/crm-account-deletion-staging.mjs` only with the exact Staging URL, a Staging server key, and `CRM_ACCOUNT_DELETION_QA=synthetic-staging-only`. It never accepts a Production URL.

## Remaining verification

- Production schema, Storage inventory, and backup configuration require a read-only account with access to `vzzbegctrqnxxsrfmvjo`. The currently connected Supabase account returned `You do not have access to this project`; do not infer Production status from Staging.
- CRM Staging currently has zero Storage buckets and objects. The CRM application code did not show a Storage upload/download path, but that does not rule out manual or provider-side exports.
- Five encrypted manual full-database Production backups were found under the local `GoldenFlowBackups` directory. The backup script has no age-based retention or deletion schedule. One restore-check record reports a successful isolated restore; none of this proves account-specific erasure from the archives. Do not remove backup files without a separately approved retention and recovery policy.
- The Calendar disconnect code in the feature release branch did not verify Google's revocation response before removing local credentials. A local isolated fix and synthetic tests exist on `codex/calendar-revoke-account-deletion`, but a live QA revocation and deployment have not been verified.
- External systems, including Grow provider records, n8n/Meta ingestion history, and independent Trainer data, need separate inventory and retention decisions. No absence of external copies has been established.
