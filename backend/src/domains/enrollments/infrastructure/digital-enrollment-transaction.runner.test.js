const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createDigitalEnrollmentTransactionRunner,
} = require("./digital-enrollment-transaction.runner.js");

test("transaction runner commits and releases one shared connection", async () => {
  const calls = [];
  const connection = fakeConnection(calls);
  const runner = createDigitalEnrollmentTransactionRunner({
    connectionProvider: async () => connection,
    repositoryFactory({ queryRunner }) {
      return { repository: { queryRunner } };
    },
  });
  const result = await runner(async ({ connection: received, repository }) => {
    assert.equal(received, connection);
    await repository.queryRunner("SELECT ?", [1]);
    return "ok";
  });
  assert.equal(result, "ok");
  assert.deepEqual(
    calls.map((call) => call[0]),
    ["beginTransaction", "execute", "commit", "release"],
  );
});

test("transaction runner rolls back callback failures and always releases", async () => {
  const calls = [];
  const domainError = Object.assign(new Error("controlled"), { code: "CONTROLLED" });
  const runner = createDigitalEnrollmentTransactionRunner({
    connectionProvider: async () => fakeConnection(calls),
    repositoryFactory: () => ({}),
  });
  await assert.rejects(() => runner(async () => Promise.reject(domainError)), {
    code: "CONTROLLED",
  });
  assert.deepEqual(
    calls.map((call) => call[0]),
    ["beginTransaction", "rollback", "release"],
  );
});

function fakeConnection(calls) {
  return {
    async beginTransaction() {
      calls.push(["beginTransaction"]);
    },
    async commit() {
      calls.push(["commit"]);
    },
    async execute(sql, params) {
      calls.push(["execute", sql, params]);
      return [[], []];
    },
    async release() {
      calls.push(["release"]);
    },
    async rollback() {
      calls.push(["rollback"]);
    },
  };
}
