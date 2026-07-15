const assert = require("node:assert/strict");
const test = require("node:test");

const { executeMonthlyBillingAutomation } = require("../financeiro-automation-history.service.js");

test("monthly billing automation appends STARTED and SUCCEEDED with one execution id", async () => {
  const records = [];
  let generateInput;
  const result = await executeMonthlyBillingAutomation({
    competencia: "2026-07",
    correlationId: "request-e2e",
    executionId: "billing-e2e-success",
    generate: async (input) => {
      generateInput = input;
      return { competencia: "2026-07", created: 2, skipped: 1 };
    },
    historyService: {
      async recordStarted(value) {
        records.push({ ...value, status: "STARTED" });
      },
      async recordSucceeded(value) {
        records.push({ ...value, status: "SUCCEEDED" });
      },
    },
    requestedBy: "admin@j12.com",
  });

  assert.equal(result.executionId, "billing-e2e-success");
  assert.equal(result.summary.criadas, 2);
  assert.equal(result.summary.ignoradas, 1);
  assert.equal(result.summary.existentes, 1);
  assert.deepEqual(result.summary.erros, []);
  assert.equal(result.summary.total_alunos, 3);
  assert.equal(result.summary.createdCount, 2);
  assert.deepEqual(generateInput, {
    competencia: "2026-07",
    requestedBy: "admin@j12.com",
  });
  assert.deepEqual(
    records.map((record) => record.status),
    ["STARTED", "SUCCEEDED"],
  );
  assert.ok(records.every((record) => record.executionId === "billing-e2e-success"));
  assert.equal(records[1].output.competencia, "2026-07");
});

test("completion history failure never records a false FAILED event", async () => {
  const events = [];
  const historyFailure = Object.assign(new Error("history unavailable"), {
    code: "E2E_HISTORY_UNAVAILABLE",
  });

  await assert.rejects(
    executeMonthlyBillingAutomation({
      executionId: "billing-history-failed",
      generate: async () => ({ competencia: "2026-07", created: 1, skipped: 0 }),
      historyService: {
        async recordStarted() {
          events.push("STARTED");
        },
        async recordSucceeded() {
          events.push("SUCCEEDED");
          throw historyFailure;
        },
        async recordFailed() {
          events.push("FAILED");
        },
      },
    }),
    historyFailure,
  );

  assert.deepEqual(events, ["STARTED", "SUCCEEDED"]);
});

test("monthly billing automation appends FAILED and rethrows the business error", async () => {
  const records = [];
  const failure = Object.assign(new Error("synthetic monthly failure"), {
    code: "E2E_MONTHLY_FAILURE",
  });

  await assert.rejects(
    executeMonthlyBillingAutomation({
      executionId: "billing-e2e-failed",
      generate: async () => {
        throw failure;
      },
      historyService: {
        async recordStarted(value) {
          records.push({ ...value, status: "STARTED" });
        },
        async recordFailed(value) {
          records.push({ ...value, status: "FAILED" });
        },
      },
    }),
    failure,
  );

  assert.deepEqual(
    records.map((record) => record.status),
    ["STARTED", "FAILED"],
  );
  assert.equal(records[1].error.code, "E2E_MONTHLY_FAILURE");
});
