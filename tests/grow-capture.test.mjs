import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";

const { POST } = await import("../app/api/webhooks/grow/route.ts");

const originalEnv = {
  captureDigest: process.env.GROW_CAPTURE_TEST_EMAIL_SHA256,
  growKey: process.env.GROW_WEBHOOK_KEY,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
};

let capturedInfo = [];
let originalConsoleInfo;

function canonicalEmail(value) {
  return value.trim().toLowerCase();
}

function digest(value) {
  return createHash("sha256").update(canonicalEmail(value), "utf8").digest("hex");
}

function request(payload, key = "synthetic-webhook-secret") {
  return new Request(`https://example.test/api/webhooks/grow?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function captureEvidence() {
  const entry = capturedInfo.find(([label]) => label === "GROW_TEMP_SANITIZED_CAPTURE");
  return entry?.[1] ?? null;
}

beforeEach(() => {
  capturedInfo = [];
  originalConsoleInfo = console.info;
  console.info = (...args) => capturedInfo.push(args);
  process.env.GROW_WEBHOOK_KEY = "synthetic-webhook-secret";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

afterEach(() => {
  console.info = originalConsoleInfo;
  for (const [name, value] of [
    ["GROW_CAPTURE_TEST_EMAIL_SHA256", originalEnv.captureDigest],
    ["GROW_WEBHOOK_KEY", originalEnv.growKey],
    ["SUPABASE_SERVICE_ROLE_KEY", originalEnv.serviceKey],
    ["NEXT_PUBLIC_SUPABASE_URL", originalEnv.supabaseUrl],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("canonical digest match captures before Supabase or CRM processing", async () => {
  process.env.GROW_CAPTURE_TEST_EMAIL_SHA256 = digest("capture-user@example.test");
  const response = await POST(request({
    payerEmail: "  CAPTURE-USER@EXAMPLE.TEST ",
    paymentDate: "2026-08-22T10:20:30+03:00",
    paymentSum: "1.00",
    status: " SUCCESS ",
    transactionCode: "synthetic-transaction-do-not-log",
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { captured: true, ok: true, processed: false });
  assert.equal(capturedInfo.some(([label]) => label === "GROW_SUPABASE_ADMIN_CLIENT_READY"), false);
  assert.equal(capturedInfo.some(([label]) => label === "GROW_USER_LOOKUP_STARTED"), false);

  const evidence = captureEvidence();
  assert.deepEqual(evidence, {
    amountAliasName: "paymentSum",
    contentTypeCategory: "json",
    method: "POST",
    normalizedStatusValue: "success",
    paymentDatePresent: true,
    rawAmountPrimitiveType: "string",
    rawAmountValue: "1.00",
    rawPaymentDatePrimitiveType: "string",
    rawPaymentDateValue: "2026-08-22T10:20:30+03:00",
    transactionAliasName: "transactionCode",
    transactionIdentityPresent: true,
  });
  assert.equal(JSON.stringify(capturedInfo).includes("synthetic-transaction-do-not-log"), false);
  assert.equal(JSON.stringify(capturedInfo).includes("capture-user@example.test"), false);
  assert.equal(JSON.stringify(capturedInfo).includes(process.env.GROW_CAPTURE_TEST_EMAIL_SHA256), false);
});

test("wrong webhook secret is rejected before controlled capture", async () => {
  process.env.GROW_CAPTURE_TEST_EMAIL_SHA256 = digest("capture-user@example.test");
  const response = await POST(request({ email: "capture-user@example.test" }, "wrong-secret"));
  assert.equal(response.status, 401);
  assert.equal(captureEvidence(), null);
});

test("non-test identity falls through to the original CRM path", async () => {
  process.env.GROW_CAPTURE_TEST_EMAIL_SHA256 = digest("capture-user@example.test");
  const response = await POST(request({
    email: "ordinary-user@example.test",
    status: "success",
    transactionId: "ordinary-synthetic-transaction",
  }));
  assert.equal(response.status, 500);
  assert.equal(captureEvidence(), null);
  assert.equal(capturedInfo.some(([label]) => label === "GROW_SUPABASE_ADMIN_CLIENT_READY"), true);
});

test("conflicting protected aliases produce fixed markers without transaction values", async () => {
  process.env.GROW_CAPTURE_TEST_EMAIL_SHA256 = digest("capture-user@example.test");
  const response = await POST(request({
    email: "capture-user@example.test",
    paymentSum: "1.00",
    sum: "2.00",
    status: "success",
    transactionCode: "synthetic-transaction-a",
    transactionId: "synthetic-transaction-b",
  }));
  assert.equal(response.status, 200);
  const evidence = captureEvidence();
  assert.equal(evidence.amountAliasName, "CONFLICTING AMOUNT ALIASES");
  assert.equal(evidence.rawAmountPrimitiveType, "conflict");
  assert.equal(evidence.rawAmountValue, null);
  assert.equal(evidence.transactionAliasName, "CONFLICTING TRANSACTION ALIASES");
  assert.equal(JSON.stringify(capturedInfo).includes("synthetic-transaction-a"), false);
  assert.equal(JSON.stringify(capturedInfo).includes("synthetic-transaction-b"), false);
});

test("unsafe non-scalars and oversized evidence are replaced by fixed markers", async () => {
  process.env.GROW_CAPTURE_TEST_EMAIL_SHA256 = digest("capture-user@example.test");
  const response = await POST(request({
    email: "capture-user@example.test",
    paymentDate: { nested: "not retained" },
    paymentSum: "9".repeat(65),
    status: "success",
    transactionCode: "synthetic-transaction-c",
  }));
  assert.equal(response.status, 200);
  const evidence = captureEvidence();
  assert.equal(evidence.rawAmountPrimitiveType, "INVALID/OVERSIZED");
  assert.equal(evidence.rawAmountValue, "INVALID/OVERSIZED");
  assert.equal(evidence.rawPaymentDatePrimitiveType, "INVALID/NON-SCALAR");
  assert.equal(evidence.rawPaymentDateValue, "INVALID/NON-SCALAR");
});

test("missing paymentDate is reported without manufacturing a timestamp", async () => {
  process.env.GROW_CAPTURE_TEST_EMAIL_SHA256 = digest("capture-user@example.test");
  const response = await POST(request({
    email: "capture-user@example.test",
    sum: "1",
    status: "success",
    transactionId: "synthetic-transaction-d",
  }));
  assert.equal(response.status, 200);
  const evidence = captureEvidence();
  assert.equal(evidence.paymentDatePresent, false);
  assert.equal(evidence.rawPaymentDatePrimitiveType, "missing");
  assert.equal(evidence.rawPaymentDateValue, null);
});
