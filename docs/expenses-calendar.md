# Expenses and shared Google Calendar V1

One connection per CRM user, one read-only primary calendar, one snapshot consumed by expenses and meetings. No Calendar content is sent to an LLM. No Google event is written. Manual expenses remain available without Google.

## Setup (staging first)

Apply `supabase/migrations/20260919211839_shared_calendar_expenses.sql` after review. No production migration is performed by the application.

Enable Google Calendar API, configure the OAuth consent screen and a Web application OAuth client. Add the exact callback URL `/api/calendar/callback` on the chosen application origin. Configure server-only values in that environment:

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REDIRECT_URI` (absolute callback URL; HTTPS except localhost)
- `CALENDAR_TOKEN_ENCRYPTION_KEY` (32 cryptographically random bytes encoded as base64; never a NEXT_PUBLIC variable)
- Existing `SUPABASE_SERVICE_ROLE_KEY` is reused only on the server.

Never commit keys or paste them into chat. Keep the encryption key stable; rotating it requires reconnecting calendars. Add QA Google accounts as test users while the consent screen is in testing. External production use may require Google verification. Missing configuration disables connection but not manual expenses.

Scope: `https://www.googleapis.com/auth/calendar.events.readonly`. Primary calendar only in V1. OAuth uses expiring, single-use owner-bound state, HttpOnly SameSite cookie and PKCE. Refresh tokens are AES-256-GCM encrypted with owner AAD; access tokens are transient. Client roles cannot read connection credentials or write Calendar snapshots.

## Semantics

- Money is integer agorot, ILS only. Explicit currency required; ambiguous multiple amounts and malformed numbers are ignored.
- Meetings require the whole word `פגישה` or `פגישת`. All-day events do not count as meetings. One event can feed both summaries.
- Forecast starts today (not overdue expenses). Week ends Sunday; month ends at the next month; rolling windows are 30/90 calendar days, exclusive end.
- Meeting summary covers the entire Sunday-Saturday week, including earlier meetings. An event overlapping the boundary counts once in each affected week, with only the minutes within that week.
- Use Calendar response timezone after sync; otherwise the existing CRM default, Asia/Jerusalem. No new per-user timezone setting.
- `singleEvents=true` expands actual recurring occurrences. IDs and iCalUID/start deduplication prevent copied occurrences inflating totals.
- Initial sync runs after OAuth. Subsequent sync is explicit via the sync button; this is not a realtime/push integration. Last-sync time is visible; snapshots older than 24 hours or lacking horizon coverage show a stale warning.
- Full bounded snapshots cover this week through 100 days ahead. Pagination is completed before transactional publication. More than 10,000 provider events fails without publishing partial data. Changed/removed amounts, moved or cancelled/deleted events are reconciled on the next successful sync.
- Manual and Calendar expenses can be marked paid/cancelled locally; these overrides survive sync for the same event ID. Google owns title/date/amount. No manual recurrence editor in V1; recurring Google events are supported.
- Disconnect deletes the cached Calendar events/credentials, leaves manual expenses, and attempts Google token revocation. It does not delete Google events.

## Verification

`npx tsc -p tests/tsconfig.expenses.json` then `node --test .test-dist/tests/expenses.test.js`.
`node --test tests/calendar-server.test.mjs` tests actual server logic using fake Google transport and credentials.
`node --test tests/expenses-db.test.mjs` requires the existing local `gf-sales-activity-qa-20260913` PostgreSQL container, with network mode `none` and no port bindings. It creates a uniquely named synthetic database and checks tenant isolation and snapshot publication using the real migration.
`node --test tests/expenses-ui.test.mjs` uses an installed Playwright runtime supplied by `QA_PLAYWRIGHT_PATH` and installed Chrome. It renders the actual component/built CSS, with localhost-only synthetic HTTP fixtures. Screenshots are stored under ignored `.test-dist/expenses-visual`.
`npm run typecheck`, `npm run lint`, `npm run build`.
Database/browser test scripts use isolated synthetic fixtures only. They do not prove live Google consent/refresh/revocation or deployed Supabase configuration. Before release, run two-user staging E2E including Google connect, resync, edits, deletion, revoke and reconnect. No commit/deploy is implicit in setup.

References: [Google server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Calendar event listing](https://developers.google.com/workspace/calendar/api/v3/reference/events/list), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
