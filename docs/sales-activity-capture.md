# Sales Activity capture

## Scope and behavior

- Dashboard handled actions, lead completion actions, and Pipeline handled/swipe-right actions open the same dialog. Opening/cancelling does not mutate data or advance the daily queue.
- Users explicitly report one of six outcomes; summary is optional (maximum 2,000 characters).
- WhatsApp means the user confirms a message was actually sent. Merely opening WhatsApp is not recorded as sending.
- No-answer records `contact_attempt`, not `call_completed`, and does not fabricate a successful contact timestamp.
- Status is intentionally unchanged. Existing explicit stage controls remain available; irrelevant is an activity outcome, not an implicit lost/closed transition.
- Next step defaults to keeping the current plan. Schedule writes the existing lead `next_action_type` and `next_action_date`; none clears only those fields. This uses the existing lead follow-up model, not a new task model.
- Existing manual/automated tasks are never completed, rescheduled, or removed by this feature. Existing agent suggestions can still appear independently of the explicit lead follow-up date.
- Terminal leads allow history-only capture with no lead updates. Access is available through lead edit/additional actions, including mobile.
- Existing current notes are not overwritten. History contains the latest 50 actual activity records.

## Deployment prerequisite (not executed remotely)

Apply `supabase/migrations/20260913002144_sales_activity_capture.sql` in an approved staging environment first, after the existing Sales Intelligence migration. It adds three nullable activity snapshot columns and one RPC. It does not change existing RLS policies or existing rows.

Deploy code only after the migration is available. Without it, history/save returns a safe unavailable response and does not fall back to the old unrecorded mutation.

The RPC uses SECURITY INVOKER, existing RLS, `auth.uid()`, an owned-lead row lock and a server-side subscription check. Activity insertion and lead scheduling are one transaction. No service role is used. API GET/POST additionally authenticate and check subscription and tenant ownership. Existing agents/integrations are unchanged.

The activity primary key is the request id. A replay returns the original identity without changing the lead again; reusing the id with different content is rejected. UI disables duplicate submissions and retains the identical request on an uncertain network response. After an uncertain response, retry in the same dialog; if it was closed or refreshed, inspect history before recording another event. Separate user-confirmed submissions are separate activities, not content-deduplicated.

Dates use the browser's local timezone and are transmitted as ISO instants. Past dates are rejected for new scheduled actions. An existing successful replay is accepted even if its original future date has since passed.

## Local checks

```powershell
npm run typecheck
npm run lint
npm run build
node node_modules/typescript/bin/tsc -p tests/tsconfig.sales-activity.json
node --test .test-dist/tests/sales-activity.test.js
npm run test:lead-followups
npm run test:sales-intelligence
```

For isolated SQL tests, start an unconnected, disposable local container (no published ports):

```powershell
docker run -d --name gf-sales-activity-qa-20260913 --network none -e POSTGRES_PASSWORD=isolated-qa-only public.ecr.aws/supabase/postgres:17.6.1.167
node --test tests/sales-activity-db.test.mjs
docker stop gf-sales-activity-qa-20260913
```

The DB test creates a uniquely named synthetic database inside this exact container and asserts no network/port connections. It never reads application ENV. It uses the repository schema, a minimal local Auth/subscription fixture, and the new migration; it is not proof of the deployed schema or Supabase Auth/PostgREST configuration.

`tests/sales-activity-ui.test.mjs` renders the real dialog with compiled app CSS in a synthetic localhost harness. With an existing Playwright installation and Chrome, run `node --test tests/sales-activity-ui.test.mjs`. An external installed runtime can be passed through the process-only `QA_PLAYWRIGHT_PATH` variable. It tests 1440/390/360 widths, dark/light themes, readback, cancellation, exact timezone conversion, terminal behavior and double-submit/retry behavior. Its HTTP responses are stubbed locally, not the deployed API. It installs nothing and contacts no remote application.

## Staging browser acceptance

Use a dedicated synthetic QA account after migration. Verify on desktop/mobile and available themes:

1. Open/cancel each handled entry point: no status, date, count, or daily queue change.
2. Save no-answer without summary: one contact attempt in history, status unchanged.
3. Schedule a future follow-up: exact chosen local time read back in Leads and daily actions when due; no task duplication.
4. Choose keep, then none: keep preserves current plan, none clears only lead scheduling; existing tasks remain.
5. Close a QA lead via the existing status control; log history via additional actions. No sales follow-up can be created and manual tasks remain available.
6. Double submit or retry a simulated lost response: one activity for the same request; refresh history to confirm persistence.
7. A second user cannot read/write the first user's lead. Anonymous/expired accounts cannot use the API.
8. Verify Sales Intelligence reads the new event's type/outcome/summary using its existing read-only contract.
9. Verify focus, Escape/cancel, validation, history loading/error/empty states and no console errors.

No Production migration, user-data mutation, commit, push, or deployment is part of this implementation.
