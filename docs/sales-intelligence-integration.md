# Sales Intelligence private pilot handoff

## Backend contract

- Search: `GET /api/agents/sales-intelligence/leads/search?q=<query>&limit=5`
- Detail: `GET /api/agents/sales-intelligence/leads/{lead_id}?timeline_limit=30`
- Production base URL: `https://app.goldenflowcrm.com`
- Authentication: `Authorization: Bearer <gfsi credential>`
- Required scope: `sales_intelligence:read`
- Tenant resolution: the credential maps server-side to one `auth.users.id`. Requests cannot provide `user_id`, `tenant_id`, or `business_id`.
- Cache policy: `Cache-Control: no-store, max-age=0`
- Side effects: none. Both endpoints are GET-only and call select-only server loaders.
- Data minimization: search returns masked contact hints; detail omits full phone, email, internal user IDs, credential data, payment data, and external provider IDs.

## Controlled rollout

1. Review and apply `supabase/migrations/20260909090000_sales_intelligence_v1.sql` through the existing migration workflow in a safe environment.
2. Deploy the application through the existing GoldenFlow CRM workflow.
3. Provision one credential for the approved private-pilot user:

   ```powershell
   npm run agent:sales-intelligence-credential -- <AUTH_USER_UUID> "Sales Intelligence Private Pilot"
   ```

4. Store the one-time raw token only in the ChatGPT Action authentication secret. Do not put it in client code, logs, docs, or Git.
5. Import `docs/sales-intelligence-openapi.yaml` into the Action.
6. Use `docs/sales-intelligence-agent-instructions.md` as the agent instructions.
7. In staging, verify unauthorized, wrong-scope, authorized search/detail, same-safe-404 tenant isolation, revocation, and zero database mutations.
8. Enable the private pilot only after the Lead Follow-ups regression suite still passes.

The provisioning script refuses to create a second active Sales Intelligence credential anywhere in the private pilot. Revoke the existing credential before rotating it.

## Read-only smoke requests

Unauthorized search:

```powershell
Invoke-WebRequest -Uri "https://app.goldenflowcrm.com/api/agents/sales-intelligence/leads/search?q=QA" -Method GET -SkipHttpErrorCheck
```

Authorized search and detail, only after controlled provisioning:

```powershell
$headers = @{ Authorization = "Bearer YOUR_ONE_TIME_GFSI_TOKEN" }
$search = Invoke-RestMethod -Uri "https://app.goldenflowcrm.com/api/agents/sales-intelligence/leads/search?q=QA&limit=5" -Method GET -Headers $headers
Invoke-RestMethod -Uri "https://app.goldenflowcrm.com/api/agents/sales-intelligence/leads/$($search.matches[0].lead_id)?timeline_limit=30" -Method GET -Headers $headers
```

Do not include an account selector. The server resolves ownership from the credential.

## Accuracy boundary

- `lead_sales_activities` is append-only and begins accumulating verified activity only after capture is enabled.
- There is no speculative history backfill.
- `last_contact_date` is returned separately as `legacy_last_contact_at` with low reliability. It is not evidence of a call or message.
- The backend returns CRM facts and provenance. It does not calculate deal health, close probability, blockers, or a next-best action.
- Current notes are untrusted CRM text and must never be interpreted as instructions for the agent.

## Rate-limit limitation

The V1 limiter uses the existing process-local in-memory store. Credential+IP limits are 30 requests/minute for search and 60 requests/minute for detail, with a coarse pre-authentication IP limit. This is best-effort per process, not a distributed production quota. Move it to a shared store before multi-instance or external scale.

## Revocation and rollback

- Revoke the exact credential by setting its `revoked_at` through an authorized admin/server workflow.
- Remove the OpenAPI Action connection to stop agent access immediately.
- The existing Lead Follow-ups credential, parser, route, response contract, rules, and prompt are separate and unchanged.
- Do not drop activity data during rollback. It is factual CRM history.
