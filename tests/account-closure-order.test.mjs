import assert from "node:assert/strict";
import test from "node:test";
import { closeCrmAccountInOrder } from "../lib/account-closure/order.mjs";

function harness() {
  const calls = [];
  let connection = true;
  const operations = {
    async getUser(id) { calls.push("identity"); return { id, email: "synthetic-qa@example.invalid" }; },
    async disconnectCalendar() { calls.push("revoke"); connection = false; },
    async hasCalendarConnection() { calls.push("check-connection"); return connection; },
    async deleteAuthUser() { calls.push("delete-auth"); },
  };
  return { calls, operations };
}

test("revokes Calendar before deleting Auth", async () => {
  const { calls, operations } = harness();
  await closeCrmAccountInOrder("qa-id", "synthetic-qa@example.invalid", operations);
  assert.deepEqual(calls, ["identity", "revoke", "check-connection", "delete-auth"]);
});

test("identity mismatch never revokes or deletes", async () => {
  const { calls, operations } = harness();
  await assert.rejects(closeCrmAccountInOrder("qa-id", "another@example.invalid", operations), /identity mismatch/);
  assert.deepEqual(calls, ["identity"]);
});

test("failed Google revocation leaves Auth untouched", async () => {
  const { calls, operations } = harness();
  operations.disconnectCalendar = async () => { calls.push("revoke"); throw new Error("Google authorization could not be revoked"); };
  await assert.rejects(closeCrmAccountInOrder("qa-id", "synthetic-qa@example.invalid", operations), /could not be revoked/);
  assert.deepEqual(calls, ["identity", "revoke"]);
});

test("remaining local connection blocks Auth deletion", async () => {
  const { calls, operations } = harness();
  operations.disconnectCalendar = async () => { calls.push("revoke"); };
  await assert.rejects(closeCrmAccountInOrder("qa-id", "synthetic-qa@example.invalid", operations), /remains/);
  assert.deepEqual(calls, ["identity", "revoke", "check-connection"]);
});

test("Auth deletion failure is surfaced after revocation", async () => {
  const { calls, operations } = harness();
  operations.deleteAuthUser = async () => { calls.push("delete-auth"); throw new Error("Auth deletion failed"); };
  await assert.rejects(closeCrmAccountInOrder("qa-id", "synthetic-qa@example.invalid", operations), /Auth deletion failed/);
  assert.deepEqual(calls, ["identity", "revoke", "check-connection", "delete-auth"]);
});
