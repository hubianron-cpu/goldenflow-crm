import assert from "node:assert/strict";
import test from "node:test";
import { isClosureQaRequest, isClosureQaRuntime, isClosureQaUser } from "../lib/account-closure/qa-guard.mjs";

const env = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "codex/crm-deletion-combined-qa",
  NEXT_PUBLIC_SUPABASE_URL: "https://pzxwaoghixsqcstfrorn.supabase.co",
  CRM_ACCOUNT_DELETION_QA: "synthetic-staging-only",
};
const user = { id: "qa-id", email: "hubianron+crm-closure-qa-abc123@gmail.com", app_metadata: { crm_closure_qa: true } };

test("QA route is disabled outside exact Staging Preview branch", () => {
  assert.equal(isClosureQaRuntime(env), true);
  for (const [key, value] of [
    ["VERCEL_ENV", "production"],
    ["VERCEL_GIT_COMMIT_REF", "main"],
    ["NEXT_PUBLIC_SUPABASE_URL", "https://vzzbegctrqnxxsrfmvjo.supabase.co"],
    ["CRM_ACCOUNT_DELETION_QA", ""],
  ]) assert.equal(isClosureQaRuntime({ ...env, [key]: value }), false);
});

test("QA route requires marked synthetic account and same-origin typed confirmation", () => {
  assert.equal(isClosureQaUser(user), true);
  assert.equal(isClosureQaUser({ ...user, email: "ronhubian85@gmail.com" }), false);
  assert.equal(isClosureQaUser({ ...user, app_metadata: {} }), false);
  assert.equal(isClosureQaRequest("https://qa.example", "https://qa.example/api/qa/close-account", user.email, user.email), true);
  assert.equal(isClosureQaRequest("https://other.example", "https://qa.example/api/qa/close-account", user.email, user.email), false);
  assert.equal(isClosureQaRequest("https://qa.example", "https://qa.example/api/qa/close-account", "wrong", user.email), false);
});
