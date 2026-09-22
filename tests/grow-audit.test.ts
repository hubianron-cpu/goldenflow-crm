import assert from "node:assert/strict";
import { test } from "node:test";
import { growAuditPayload } from "../lib/grow/audit";

test("Grow audit retains only a normalized amount and date", () => {
  const audit = growAuditPayload({ paymentDate: "2026-09-22T12:30:00+03:00", paymentSum: 500 });

  assert.deepEqual(audit, {
    schema_version: 1,
    payment_date: "2026-09-22",
    payment_sum: 500,
  });
  assert.deepEqual(Object.keys(audit).sort(), ["payment_date", "payment_sum", "schema_version"]);
});

test("Grow audit retains the legacy Grow day/month/year date without provider data", () => {
  assert.deepEqual(growAuditPayload({ paymentDate: "22/9/26", paymentSum: 500 }), {
    schema_version: 1,
    payment_date: "22/9/26",
    payment_sum: 500,
  });
});

test("Grow audit cannot carry provider PII, credentials or arbitrary text", () => {
  const details = {
    paymentDate: "payer@example.invalid",
    paymentSum: Number.NaN,
    payerEmail: "payer@example.invalid",
    webhookKey: "synthetic-secret",
    customer: { phone: "0000000000" },
  };
  const audit = growAuditPayload(details);

  assert.deepEqual(audit, { schema_version: 1, payment_date: null, payment_sum: null });
  assert.equal(JSON.stringify(audit).includes("example.invalid"), false);
  assert.equal(JSON.stringify(audit).includes("synthetic-secret"), false);
});
