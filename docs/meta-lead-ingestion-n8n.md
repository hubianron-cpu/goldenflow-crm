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

