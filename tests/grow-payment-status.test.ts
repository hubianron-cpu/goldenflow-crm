import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyGrowPaymentStatus } from "../lib/grow/payment-status";

test("documented Grow paid envelope is successful without mutating the callback", () => {
  const payload = { err: "", status: "1", data: { status: "שולם", statusCode: "2" } };
  const before = JSON.stringify(payload);
  assert.deepEqual(classifyGrowPaymentStatus(payload, "1", "2", ""), {
    isFailedPayment: false, isSuccessfulPayment: true,
  });
  assert.equal(JSON.stringify(payload), before);
});

test("numeric provider statuses are supported", () => {
  assert.equal(classifyGrowPaymentStatus({ status: 1, data: { statusCode: 2 } }, "1", "2", "").isSuccessfulPayment, true);
});

test("form-encoded data JSON is supported without changing it", () => {
  const payload = { status: "1", data: JSON.stringify({ statusCode: "2", status: "paid" }) };
  const before = payload.data;
  assert.equal(classifyGrowPaymentStatus(payload, "1", "2", "").isSuccessfulPayment, true);
  assert.equal(payload.data, before);
});

for (const code of ["", "0", "1", "3", "unknown"]) {
  test(`provider envelope alone does not prove payment: code ${code || "missing"}`, () => {
    assert.equal(classifyGrowPaymentStatus({ status: "1", data: { statusCode: code } }, "1", code, "").isSuccessfulPayment, false);
  });
}

test("a paid code with failed envelope is ignored, not treated as failed payment", () => {
  assert.deepEqual(classifyGrowPaymentStatus({ status: "0", data: { statusCode: "2" } }, "0", "2", ""), {
    isFailedPayment: false, isSuccessfulPayment: false,
  });
});

test("an unrelated or top-level statusCode cannot prove a provider payment", () => {
  assert.equal(classifyGrowPaymentStatus({ status: "1", statusCode: "2" }, "1", "2", "").isSuccessfulPayment, false);
});

test("conflicting extracted and canonical codes cannot activate", () => {
  assert.equal(classifyGrowPaymentStatus({ status: "1", statusCode: "3", data: { statusCode: "2" } }, "1", "3", "").isSuccessfulPayment, false);
});

test("provider errors block activation without inventing a failed payment", () => {
  assert.deepEqual(classifyGrowPaymentStatus({ err: "provider error", status: "1", data: { statusCode: "2" } }, "1", "2", ""), {
    isFailedPayment: false, isSuccessfulPayment: false,
  });
});

for (const signal of ["declined", "cancelled", "נכשל"]) {
  test(`nested payment failure overrides the paid code: ${signal}`, () => {
    assert.deepEqual(classifyGrowPaymentStatus({ status: "1", data: { statusCode: "2", status: signal } }, "1", "2", ""), {
      isFailedPayment: true, isSuccessfulPayment: false,
    });
  });
}

test("explicit payment error overrides a paid code", () => {
  assert.equal(classifyGrowPaymentStatus({ status: "1", data: { statusCode: "2" } }, "1", "2", "declined").isSuccessfulPayment, false);
});

test("legacy success remains compatible", () => {
  assert.equal(classifyGrowPaymentStatus({ status: "success" }, "success", "", "").isSuccessfulPayment, true);
});

test("legacy success cannot override a contradictory payment code", () => {
  assert.equal(classifyGrowPaymentStatus({ status: "success", statusCode: "3" }, "success", "3", "").isSuccessfulPayment, false);
});

test("malformed provider data fails closed", () => {
  assert.equal(classifyGrowPaymentStatus({ status: "1", data: "{" }, "1", "2", "").isSuccessfulPayment, false);
});
