const assert = require("node:assert/strict");
const test = require("node:test");

const { AutomationExecutionHistoryRecord } = require("../../../application/history/index.js");
const {
  INSERT_HISTORY_SQL,
  MySqlAutomationExecutionHistoryRepository,
  SELECT_BY_EXECUTION_ID_SQL,
  parseJsonColumn,
  toDomain,
} = require("../mysql-automation-execution-history.repository.js");

test("MySQL history save uses a parameterized insert and sanitized JSON", async () => {
  const calls = [];
  const repository = new MySqlAutomationExecutionHistoryRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [];
    },
  });
  const record = fixture({
    error: { code: "MOCK", message: "safe", stack: "hidden", token: "hidden" },
    input: { authorization: "hidden", safe: true },
    metadata: { password: "hidden", source: "test" },
    output: { processed: 1 },
  });

  await repository.save(record);

  assert.equal(calls[0].sql, INSERT_HISTORY_SQL);
  assert.equal(calls[0].params.length, 16);
  assert.equal(calls[0].params.includes(record.executionId), true);
  assert.equal(calls[0].params.join("|").includes("hidden"), false);
  assert.deepEqual(JSON.parse(calls[0].params[11]), { safe: true });
  assert.deepEqual(JSON.parse(calls[0].params[13]), { code: "MOCK", message: "safe" });
});

test("MySQL history findByExecutionId is parameterized and reconstructs the domain", async () => {
  const calls = [];
  const repository = new MySqlAutomationExecutionHistoryRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [[row()]];
    },
  });

  const result = await repository.findByExecutionId("exec-db-1' OR 1=1 --");

  assert.equal(result instanceof AutomationExecutionHistoryRecord, true);
  assert.equal(calls[0].sql, SELECT_BY_EXECUTION_ID_SQL);
  assert.deepEqual(calls[0].params, ["exec-db-1' OR 1=1 --"]);
  assert.equal(calls[0].sql.includes("OR 1=1"), false);
  assert.deepEqual(result.metadata, { fixture: true });
});

test("MySQL history lookups return null when no row exists", async () => {
  const repository = new MySqlAutomationExecutionHistoryRepository({
    queryRunner: async () => [[]],
  });
  assert.equal(await repository.findById("missing"), null);
  assert.equal(await repository.findByExecutionId("missing"), null);
});

test("MySQL history list builds dynamic parameterized filters and pagination", async () => {
  const calls = [];
  const repository = new MySqlAutomationExecutionHistoryRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [[]];
    },
  });
  const result = await repository.list({
    automationName: "billing",
    correlationId: "corr-db",
    limit: 25,
    offset: 10,
    startedFrom: "2026-07-01T00:00:00Z",
    status: "FAILED",
    triggerType: "manual",
    workflowName: "workflow-a",
    sortBy: "durationMs",
    sortDirection: "asc",
  });
  assert.deepEqual(result, []);
  assert.match(calls[0].sql, /ORDER BY duration_ms ASC, id DESC/);
  assert.match(calls[0].sql, /automation_name = \?/);
  assert.match(calls[0].sql, /LIMIT 25 OFFSET 10/);
  assert.deepEqual(calls[0].params, [
    "billing",
    "workflow-a",
    "FAILED",
    "corr-db",
    "manual",
    "2026-07-01T00:00:00.000Z",
  ]);
  await assert.rejects(repository.list({ limit: 0 }), {
    code: "AUTOMATION_HISTORY_FILTER_INVALID",
  });
});

test("MySQL history count reuses filters without LIMIT or loading records", async () => {
  const calls = [];
  const repository = new MySqlAutomationExecutionHistoryRepository({
    queryRunner: async (sql, params) => {
      calls.push({ sql, params });
      return [[{ total: 7 }]];
    },
  });
  assert.equal(await repository.count({ executionId: "exec-db-1", triggerType: "manual" }), 7);
  assert.match(calls[0].sql, /COUNT\(\*\) AS total/);
  assert.doesNotMatch(calls[0].sql, /LIMIT|OFFSET/);
  assert.deepEqual(calls[0].params, ["exec-db-1", "manual"]);
});

test("MySQL history reports corrupt JSON explicitly", () => {
  assert.throws(() => parseJsonColumn("{invalid", "metadata_json"), {
    code: "AUTOMATION_HISTORY_DATA_INVALID",
  });
  assert.throws(() => toDomain({ ...row(), metadata_json: "{invalid" }), {
    code: "AUTOMATION_HISTORY_DATA_INVALID",
  });
});

test("MySQL history propagates unexpected database errors", async () => {
  const databaseError = Object.assign(new Error("database unavailable"), { code: "ECONNREFUSED" });
  const repository = new MySqlAutomationExecutionHistoryRepository({
    queryRunner: async () => {
      throw databaseError;
    },
  });
  await assert.rejects(repository.save(fixture()), (error) => error === databaseError);
});

function fixture(overrides = {}) {
  return new AutomationExecutionHistoryRecord({
    automationName: "billing",
    correlationId: "corr-db",
    createdAt: "2026-07-09T22:00:01Z",
    executionId: "exec-db-1",
    finishedAt: "2026-07-09T22:00:01Z",
    id: "history-db-1",
    startedAt: "2026-07-09T22:00:00Z",
    status: "SUCCEEDED",
    workflowName: "workflow-a",
    ...overrides,
  });
}

function row() {
  return {
    attempt: 1,
    automation_name: "billing",
    correlation_id: "corr-db",
    created_at: "2026-07-09 22:00:01",
    duration_ms: 1000,
    error_json: null,
    execution_id: "exec-db-1",
    finished_at: "2026-07-09 22:00:01",
    id: "history-db-1",
    input_json: null,
    metadata_json: '{"fixture":true}',
    output_json: '{"processed":1}',
    started_at: "2026-07-09 22:00:00",
    status: "SUCCEEDED",
    trigger_type: "manual",
    workflow_name: "workflow-a",
  };
}
