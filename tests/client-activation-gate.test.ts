import assert from "node:assert/strict";
import test from "node:test";
import { isClientActivationLeadAllowed } from "../lib/integrations/client-activation-gate";

test("global enable allows any lead", () => {
  assert.equal(isClientActivationLeadAllowed(true, null, "lead-a"), true);
});

test("disabled activation rejects leads without a QA allowlist", () => {
  assert.equal(isClientActivationLeadAllowed(false, null, "lead-a"), false);
});

test("disabled activation allows only the exact QA lead", () => {
  assert.equal(isClientActivationLeadAllowed(false, "lead-qa", "lead-qa"), true);
  assert.equal(isClientActivationLeadAllowed(false, "lead-qa", "lead-real"), false);
});
