# Meta Lead Ads ingestion through n8n

GoldenFlow receives normalized Facebook Lead Ads events at:

```text
POST https://app.goldenflowcrm.com/api/integrations/meta/leads
```

This endpoint does not connect to Meta directly. It accepts only server-to-server
requests authenticated with `META_LEAD_INGEST_SECRET`.

## Required GoldenFlow configuration

Configure these server-only environment variables in the deployment:

```text
META_LEAD_OWNER_USER_ID=<the auth.users UUID that owns incoming leads>
META_LEAD_INGEST_SECRET=<a long random secret shared only with n8n>
```

Do not use a `NEXT_PUBLIC_` prefix and do not place either value in browser code.

The migration `supabase/migrations/20260729090000_meta_lead_ingestion.sql` must be
reviewed and applied before activating the workflow.

## Workflow

### 1. Facebook Lead Ads Trigger

1. Select the relevant Facebook Page.
2. Select the relevant lead form.
3. Run a test execution with test data.
4. Inspect the node's real output. Field names can differ between forms and
   should not be assumed from the examples below.

### 2. Set or Code

Map the trigger output to this contract:

| GoldenFlow field | Source from the trigger |
| --- | --- |
| `externalLeadId` | Meta lead ID (`id` or `leadgen_id`) converted to a string |
| `submittedAt` | Meta creation timestamp (`created_time`) |
| `fullName` | The mapped full-name answer, when present |
| `phone` | The mapped phone answer, when present |
| `email` | The mapped email answer, when present |
| `pageId` | Page ID |
| `pageName` | Page name, when present |
| `formId` | Form ID |
| `formName` | Form name, when present |
| `campaignId` | Campaign ID, when present |
| `campaignName` | Campaign name, when present |
| `adSetId` | Ad set ID, when present |
| `adSetName` | Ad set name, when present |
| `adId` | Ad ID, when present |
| `adName` | Ad name, when present |

Meta IDs must remain strings. At least one of `phone` or `email` is required.
Do not send `user_id`, raw form answers, access tokens, or unmapped fields.

### 3. HTTP Request

- Method: `POST`
- URL: `https://app.goldenflowcrm.com/api/integrations/meta/leads`
- Content type: `application/json`
- Header: `Authorization: Bearer <META_LEAD_INGEST_SECRET>`
- Response format: JSON

Store the bearer secret in an encrypted n8n credential when possible. If the
n8n installation supports private environment variables, an expression such as
`Bearer {{$env.META_LEAD_INGEST_SECRET}}` can be used instead. Never place the
secret in the URL, query string, or JSON body.

## Retry policy

- Retry a small number of times for network errors, `429`, and `5xx` responses.
- Use exponential backoff.
- Do not retry `400` or `401` until the mapping or credential is corrected.
- Add an n8n Error Workflow or alert for exhausted retries.
- Activate the workflow in Production only after the test payload succeeds.

Retries are idempotent by `user_id + provider + externalLeadId`. A repeated
event returns `already_processed` and does not create another lead or task.

## Test payload

Use fictional values only:

```json
{
  "externalLeadId": "test_20260729_001",
  "submittedAt": "2026-07-29T10:30:00Z",
  "fullName": "ישראל בדיקה",
  "phone": "+972501111111",
  "email": "meta-test@example.invalid",
  "pageId": "123456789",
  "pageName": "GoldenFlow Test",
  "formId": "987654321",
  "formName": "טופס בדיקה",
  "campaignId": "111222333",
  "campaignName": "קמפיין בדיקה",
  "adSetId": "444555666",
  "adSetName": "קהל בדיקה",
  "adId": "777888999",
  "adName": "מודעת בדיקה"
}
```

Expected responses:

- First event: HTTP `201`, `result: "created"`.
- New Meta event matched to an existing lead: HTTP `200`,
  `result: "linked_existing"`.
- Repeated `externalLeadId`: HTTP `200`, `result: "already_processed"`.

## Stage 8.3: inactive manual workflow template

Workflow name:

```text
Facebook Lead Ads -> GoldenFlow CRM
```

This template must remain inactive until the n8n version and the real output of
the selected Facebook Page and form have been inspected. Do not import a
generated workflow JSON without validating it against that n8n instance.

### Verified GoldenFlow contract

- Method: `POST`
- URL: `https://app.goldenflowcrm.com/api/integrations/meta/leads`
- Authentication: `Authorization: Bearer <META_LEAD_INGEST_SECRET>`
- Content type: `application/json`
- Maximum body size: 32 KiB
- Required: `externalLeadId`
- Required contact data: at least one of `phone` or `email`
- Unknown JSON fields are rejected
- Meta IDs must be sent as strings
- GoldenFlow owns user assignment, deduplication, metadata persistence and
  follow-up task creation

Allowed JSON fields:

```text
externalLeadId, submittedAt, fullName, phone, email,
pageId, pageName, formId, formName,
campaignId, campaignName, adSetId, adSetName, adId, adName
```

Do not send `user_id`, credentials, access tokens, raw form answers, retry
counters or any other internal n8n field.

### Workflow map

```text
Facebook Lead Ads Trigger
  -> Normalize Meta Lead
  -> Validate Required Fields
     -> valid -> Send Lead to GoldenFlow
                   -> Classify GoldenFlow Response
                      -> Success
                      -> Retryable Failure
                      -> Permanent Failure
     -> invalid -> Permanent Failure
```

### Node configuration

#### 1. Facebook Lead Ads Trigger

- Node: the Facebook Lead Ads trigger available in the installed n8n version
- Credential: a dedicated Meta credential stored only in n8n
- Page: select manually in n8n
- Form: select manually in n8n
- Event: new lead
- Activation: off while building and testing

Run a Meta test lead and inspect the complete real output before configuring
the next node. Record the exact paths for the lead ID, creation time, form
answers, Page ID, Form ID, campaign ID, ad set ID and ad ID. Do not infer
missing names or add Graph API calls in this MVP.

#### 2. Normalize Meta Lead

Use `Edit Fields` when the trigger provides flat values. Use a `Code` node only
when the real trigger output contains a dynamic answers array that cannot be
mapped safely without code.

The node must output only the allowed GoldenFlow fields. Map:

| GoldenFlow field | Real Meta value to select |
| --- | --- |
| `externalLeadId` | Lead ID, commonly exposed as `id` or `leadgen_id` |
| `submittedAt` | Lead submission timestamp |
| `fullName` | Full-name answer, or safely joined first and last name |
| `phone` | Phone answer |
| `email` | Email answer |
| `pageId` / `pageName` | Page values present in the trigger |
| `formId` / `formName` | Form values present in the trigger |
| `campaignId` / `campaignName` | Campaign values present in the trigger |
| `adSetId` / `adSetName` | Ad set values present in the trigger |
| `adId` / `adName` | Ad values present in the trigger |

Leave an optional field empty when Meta does not provide it. Do not invent
names from IDs. Preserve all IDs as strings.

#### 3. Validate Required Fields

Use an `If` or `Filter` node with both rules:

1. `externalLeadId` is a non-empty string.
2. At least one of `phone` or `email` is a non-empty string.

The false branch must stop before the HTTP Request and produce a generic
failure such as `Meta lead mapping is incomplete`. Do not include the person's
name, phone, email or raw payload in the error message.

#### 4. Send Lead to GoldenFlow

- Node: `HTTP Request`
- Method: `POST`
- URL: `https://app.goldenflowcrm.com/api/integrations/meta/leads`
- Authentication: encrypted Header Auth credential
- Header name: `Authorization`
- Header value: `Bearer <secret stored in n8n>`
- Body content type: JSON
- Response: include status code and JSON body
- Timeout: 15 seconds
- Body: explicitly map only the allowed fields from `Normalize Meta Lead`

Do not put the secret in the URL, query string, request body, workflow name,
node name or exported workflow JSON.

#### 5. Classify GoldenFlow Response

Use a `Switch` node and inspect both the HTTP status and JSON body:

| Condition | Classification |
| --- | --- |
| `201`, `ok: true`, `result: "created"` | Success |
| `200`, `ok: true`, `result: "linked_existing"` | Success |
| `200`, `ok: true`, `result: "already_processed"` | Success |
| `200`/`201` with `taskResult: "failed"` | Partial success; one limited retry, then alert |
| Network error, timeout, `429`, `500`, `502`, `504` | Retryable failure |
| `400`, `401`, `413`, `415`, any other `4xx` | Permanent failure |
| `503` | Configuration blocker; do not keep retrying |
| Unexpected success body or result | Permanent failure |

The exact response paths used in expressions depend on the installed n8n
version and must be confirmed from one manual HTTP Request execution.

#### 6. Success

Use `No Operation` or `Edit Fields` and retain only:

```text
ok, result, leadId, taskResult, warning
```

Do not retain or log the normalized lead payload in the success output.

#### 7. Retryable Failure

- Maximum attempts: 3 total
- Backoff: 5 seconds, then 15 seconds
- Respect `Retry-After` for `429` when the installed n8n version exposes it
- Reuse the same `externalLeadId` and unchanged normalized payload
- Never add the retry counter to the GoldenFlow request body
- After exhaustion, route to `Permanent Failure`

Use the installed version's error output and loop/wait controls. Do not enable a
generic retry mode that repeatedly sends invalid `400` or `401` requests.

#### 8. Permanent Failure

Use `Stop And Error` with a generic message containing only:

```text
workflow stage, HTTP status, GoldenFlow result, n8n execution ID
```

Do not include names, phone numbers, email addresses, Meta access tokens,
credentials or raw response objects.

### Credential setup

Create these credentials manually in n8n:

1. A Facebook Lead Ads credential with access only to the intended Page/form.
2. A dedicated HTTP Header Auth credential for GoldenFlow.

The GoldenFlow credential must set the `Authorization` header to `Bearer`
followed by the server-only ingestion secret. Never add the Supabase service
role key to n8n.

### Manual test branch

Before connecting Meta, use a temporary `Manual Trigger` and `Edit Fields`
node with fictional values:

```json
{
  "externalLeadId": "n8n_manual_test_UNIQUE_TIMESTAMP",
  "submittedAt": "2026-07-30T10:30:00Z",
  "fullName": "ליד בדיקת n8n",
  "phone": "+999000000001",
  "email": "n8n-meta-test-UNIQUE_TIMESTAMP@example.invalid",
  "pageId": "N8N_TEST_PAGE",
  "formId": "N8N_TEST_FORM",
  "campaignId": "N8N_TEST_CAMPAIGN",
  "adId": "N8N_TEST_AD"
}
```

Run once and expect HTTP `201` with `created`. Replay the exact same item and
expect HTTP `200` with `already_processed`. Do not activate the workflow with
the Manual Trigger test branch connected.

### Meta test lead

1. Connect the dedicated Meta credential in n8n.
2. Select the intended Page and form.
3. Start a manual trigger/listening session in n8n.
4. Create one fictional lead using Meta's Lead Ads testing tool.
5. Inspect and document the real trigger paths.
6. Complete the mapping in `Normalize Meta Lead`.
7. Execute once and verify one CRM lead, one metadata row and at most one open
   automated follow-up task.
8. Replay the same event only through a manual n8n execution to verify
   `already_processed`.

### Before activation

- Confirm the n8n version and node names.
- Confirm the real trigger output paths for the selected Page/form.
- Confirm no credential IDs, access tokens, secrets, Page IDs or Form IDs are
  present in an export.
- Confirm the GoldenFlow Production endpoint returns `401` without valid auth.
- Confirm `created`, `already_processed` and `linked_existing` were already
  validated against Production.
- Confirm retry is limited and does not retry permanent `4xx` errors.
- Confirm the HTTP body includes only allowed GoldenFlow fields.
- Confirm execution-data retention is minimized and access is restricted.
- Keep the workflow inactive until the manual and Meta test-lead checks pass.

### After activation

- Monitor the first three real executions.
- Verify each Meta event produces one CRM lead or links to the correct existing
  lead.
- Verify at most one open automated follow-up task per lead.
- Verify campaign, form and ad metadata when Meta supplies those values.
- Verify there are no repeated `400`, `401`, `429` or `5xx` responses.
- Disable the workflow immediately if mapping errors, duplicates or unexpected
  user assignment are observed.
