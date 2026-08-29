# Lead Follow-ups integration handoff

## Backend contract

- Route: `GET /api/agents/lead-followups`
- Production base URL: `https://app.goldenflowcrm.com`
- Authentication: `Authorization: Bearer <scoped credential>`
- Required scope: `lead_followups:read`
- Tenant resolution: the credential is mapped server-side to `auth.users.id`; no tenant ID is accepted from the request.
- Cache policy: `Cache-Control: no-store, max-age=0`
- Side effects: none. The endpoint only reads `leads`, `tasks`, `user_subscriptions`, and credential metadata.

## Deployment steps

1. Review and apply `supabase/migrations/20260829090000_lead_followups_agent_credentials.sql` through the existing Supabase migration workflow.
2. Deploy the application code through the existing GoldenFlow CRM deployment workflow.
3. Create one credential for the intended GoldenFlow user:

   ```powershell
   npm run agent:credential -- <AUTH_USER_UUID> "Lead Follow-ups ChatGPT"
   ```

4. Store the one-time token in the ChatGPT Action authentication configuration. Do not put it in client code or commit it to Git.
5. Import `docs/lead-followups-openapi.yaml` into the ChatGPT Action.
6. Use `docs/lead-followups-agent-prompt.md` as the agent system prompt.
7. Verify an unauthorized request, an authorized request, tenant isolation, and the returned data before enabling scheduling.
8. Configure the ChatGPT-side schedule for 10:00 daily in `Asia/Jerusalem` only after the Action is connected and verified.

## Safe smoke commands

Unauthorized request (safe before migration/deployment):

```powershell
Invoke-WebRequest -Uri "https://app.goldenflowcrm.com/api/agents/lead-followups" -Method GET -SkipHttpErrorCheck
```

Authorized request (run only after provisioning the credential):

```powershell
$headers = @{ Authorization = "Bearer YOUR_ONE_TIME_TOKEN" }
Invoke-RestMethod -Uri "https://app.goldenflowcrm.com/api/agents/lead-followups" -Method GET -Headers $headers
```

Do not include `business_id` or `user_id`; the server resolves ownership from the credential.

## Revocation

Revoke a credential by setting its exact row's `revoked_at` to `now()` through an authorized server/admin workflow. The endpoint treats revoked or expired credentials as unauthorized. Never delete or weaken CRM RLS policies to support this integration.

## Current V1 rule coverage

Enabled:

- Explicit overdue lead next action or linked open task: `due`, P1.
- Explicit lead next action or linked open task due today: `due`, P1.
- New lead older than 60 minutes with no recorded contact and no next step: `suggested`, P1.
- Verified recovery-stage lead stale for at least 14 days: `recovery`, P3, opt-in.

Disabled until structured source data exists:

- Proposal sent without next step: no reliable proposal activity timestamp.
- Completed sales meeting without next step: no meetings model.
- High-intent lead stalled: no reliable high-intent activity timestamp.

## Scheduling boundary

The backend is ready to be called by a scheduler after deployment and credential provisioning. This repository does not configure ChatGPT scheduling. Do not report scheduling as verified until a real scheduled Action run succeeds.
