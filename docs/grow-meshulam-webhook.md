# Grow / Meshulam webhook

This webhook is for GoldenFlow CRM subscription activation after a successful recurring payment in Grow / Meshulam.

## Vercel environment variable

Add this server-only variable in Vercel:

```text
GROW_WEBHOOK_KEY=...
```

Do not prefix it with `NEXT_PUBLIC_`.

## Notify URL

Paste this Notify URL inside Grow / Meshulam:

```text
https://app.goldenflowcrm.com/api/webhooks/grow
```

## Required Supabase SQL

Run this migration in the Supabase SQL Editor before enabling the webhook:

```text
supabase/20260604_grow_meshulam_webhook.sql
```

It adds Grow payment fields to `public.user_subscriptions` and creates `public.grow_webhook_events` for idempotency.

## User matching

The webhook tries to match a GoldenFlow CRM user in this order:

1. Internal user id from `cField1`, `cField2`, `dynamicFields`, or `purchaseCustomField`.
2. Existing `grow_direct_debit_id` for failed recurring payments.
3. `payerEmail` or `email`.

When possible, send the Supabase auth user id in a custom field from Grow / Meshulam.

## Safe test payload

Use a test user email and the same webhook key configured in Vercel:

```json
{
  "webhookKey": "YOUR_GROW_WEBHOOK_KEY",
  "transactionCode": "TEST-TX-001",
  "status": "success",
  "paymentSum": "199",
  "payerEmail": "test@example.com",
  "directDebitId": "TEST-DD-001"
}
```

Expected result:

- First request: subscription changes to `active`.
- Duplicate request with the same `transactionCode`: ignored safely.
- Wrong `webhookKey`: returns `401 Unauthorized`.
