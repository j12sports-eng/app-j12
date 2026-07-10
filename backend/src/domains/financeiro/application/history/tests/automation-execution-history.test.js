const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AutomationExecutionHistoryRecord,
  AutomationExecutionHistoryRepositoryContract,
  FinancialAutomationHistoryService,
  InMemoryAutomationExecutionHistoryRepository,
} = require("../index.js");

test("history record validates fields, normalizes dates and is deeply immutable", () => {
  const record = fixture();
  assert.equal(record.attempt, 1);
  assert.equal(record.startedAt, "2026-07-09T22:00:00.000Z");
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.metadata), true);
  assert.throws(() => fixture({ durationMs: -1 }), { code: "AUTOMATION_HISTORY_RECORD_INVALID" });
  assert.throws(() => fixture({ status: "UNKNOWN" }), {
    code: "AUTOMATION_HISTORY_RECORD_INVALID",
  });
  assert.throws(() => fixture({ executionId: null }), {
    code: "AUTOMATION_HISTORY_RECORD_INVALID",
  });
  assert.throws(() => fixture({ input: "unsafe" }), { code: "AUTOMATION_HISTORY_RECORD_INVALID" });
});

test("history record accepts nullable JSON and removes sensitive nested keys", () => {
  const record = fixture({
    input: {
      amount: 20,
      authorization: "Bearer secret",
      senha: "oculta",
      nested: { password: "hidden", safe: true },
      certificates: { private: "hidden" },
      payload: { financial: "hidden" },
    },
    output: null,
  });
  assert.deepEqual(record.input, { amount: 20, nested: { safe: true } });
  assert.equal(record.output, null);
});

test("in-memory history repository saves, clones, filters and paginates deterministically", async () => {
  const repository = new InMemoryAutomationExecutionHistoryRepository({
    records: [
      fixture({ id: "a", status: "STARTED", startedAt: "2026-07-09T20:00:00Z" }),
      fixture({
        id: "b",
        status: "FAILED",
        startedAt: "2026-07-09T21:00:00Z",
        workflowName: "workflow-b",
      }),
      fixture({ id: "c", correlationId: "corr-c", startedAt: "2026-07-09T22:00:00Z" }),
    ],
  });
  assert.equal((await repository.findById("a")).id, "a");
  assert.equal((await repository.findByExecutionId("exec-1")).id, "c");
  assert.deepEqual(
    (await repository.list()).map((record) => record.id),
    ["c", "b", "a"],
  );
  assert.deepEqual(
    (await repository.list({ limit: 1, offset: 1 })).map((record) => record.id),
    ["b"],
  );
  assert.equal((await repository.list({ status: "FAILED" })).length, 1);
  assert.equal((await repository.list({ automationName: "billing" })).length, 3);
  assert.equal((await repository.list({ workflowName: "workflow-b" })).length, 1);
  assert.equal((await repository.list({ correlationId: "corr-c" })).length, 1);
  assert.equal((await repository.list({ executionId: "exec-1" })).length, 3);
  assert.equal((await repository.list({ triggerType: "manual" })).length, 0);
  assert.equal(await repository.count({ automationName: "billing" }), 3);
  assert.equal(
    (
      await repository.list({
        startedFrom: "2026-07-09T20:30:00Z",
        startedTo: "2026-07-09T21:30:00Z",
      })
    ).length,
    1,
  );
  const saved = await repository.save(
    fixture({ id: "clone", metadata: { nested: { safe: true } } }),
  );
  assert.notEqual(saved, await repository.findById("clone"));
  await assert.rejects(repository.list({ limit: 1001 }), {
    code: "AUTOMATION_HISTORY_FILTER_INVALID",
  });
  assert.deepEqual(
    (await repository.list({ sortBy: "startedAt", sortDirection: "asc" })).map(
      (record) => record.id,
    ),
    ["a", "b", "clone", "c"],
  );
  await assert.rejects(repository.list({ sortBy: "unsafe" }), {
    code: "AUTOMATION_HISTORY_FILTER_INVALID",
  });
  await assert.rejects(repository.list({ sortDirection: "unsafe" }), {
    code: "AUTOMATION_HISTORY_FILTER_INVALID",
  });
  await assert.rejects(repository.list({ startedFrom: "invalid" }), {
    code: "AUTOMATION_HISTORY_FILTER_INVALID",
  });
});

test("history service records every append-only status and sanitizes failures", async () => {
  const repository = new InMemoryAutomationExecutionHistoryRepository();
  let id = 0;
  const service = new FinancialAutomationHistoryService({
    createId: () => `history-${++id}`,
    now: () => new Date("2026-07-09T22:00:01.000Z"),
    repository,
  });
  const base = {
    automationName: "billing",
    executionId: "exec-service",
    startedAt: "2026-07-09T22:00:00Z",
  };
  await service.recordStarted({ ...base, input: { token: "secret", safe: true } });
  await service.recordSucceeded({ ...base, output: { processed: 1 } });
  await service.recordWarning({ ...base, metadata: { warning: "mock" } });
  await service.recordTimedOut(base);
  await service.recordFailed({
    ...base,
    error: Object.assign(new Error("failure"), { code: "MOCK", stack: "sensitive" }),
  });
  const records = await service.listHistory({ executionId: "exec-service" });
  assert.equal(records.length, 5);
  assert.deepEqual(
    new Set(records.map((record) => record.status)),
    new Set(["STARTED", "SUCCEEDED", "WARNING", "TIMED_OUT", "FAILED"]),
  );
  const failed = records.find((record) => record.status === "FAILED");
  assert.equal(failed.error.code, "MOCK");
  assert.equal("stack" in failed.error, false);
  assert.equal(
    (await service.findByExecutionId("exec-service")) instanceof AutomationExecutionHistoryRecord,
    true,
  );
  assert.equal((await service.listByExecutionId("exec-service")).length, 5);
  assert.equal(await service.countHistory({ executionId: "exec-service" }), 5);
});

test("history service rejects incomplete data and contract remains abstract", async () => {
  const service = new FinancialAutomationHistoryService({
    repository: new InMemoryAutomationExecutionHistoryRepository(),
  });
  await assert.rejects(service.recordStarted({ executionId: "exec" }), {
    code: "AUTOMATION_HISTORY_RECORD_INVALID",
  });
  const contract = new AutomationExecutionHistoryRepositoryContract();
  await assert.rejects(contract.save(), { code: "AUTOMATION_HISTORY_REPOSITORY_NOT_IMPLEMENTED" });
});

function fixture(overrides = {}) {
  return new AutomationExecutionHistoryRecord({
    automationName: "billing",
    correlationId: "corr-1",
    createdAt: "2026-07-09T22:00:00Z",
    executionId: "exec-1",
    id: "history-1",
    metadata: { fixture: true },
    startedAt: "2026-07-09T22:00:00Z",
    status: "SUCCEEDED",
    workflowName: "workflow-a",
    ...overrides,
  });
}
