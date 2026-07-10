const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AUTOMATION_HISTORY_PERSISTENCE_FAILED,
  FinancialAutomationOrchestrator,
  FinancialAutomationRequestType,
} = require("../index.js");
const {
  FinancialAutomationHistoryService,
  InMemoryAutomationExecutionHistoryRepository,
} = require("../../history/index.js");

test("orchestrator appends STARTED and SUCCEEDED with duration and correlation", async () => {
  const fixture = createFixture({
    serviceResult: { executionId: "external-1", status: "STARTED" },
  });

  const result = await fixture.orchestrator.execute(validInput());
  const records = await fixture.repository.list({ limit: 10 });

  assert.equal(result.success, true);
  assert.deepEqual(
    records.map((record) => record.status),
    ["SUCCEEDED", "STARTED"],
  );
  assert.equal(records[0].durationMs, 1250);
  assert.equal(records[0].correlationId, "corr-history-1");
  assert.equal(records[1].executionId, "corr-history-1");
  assert.equal(records[0].executionId, records[1].executionId);
  assert.equal(records[0].metadata.externalExecutionId, "external-1");
  assert.equal(records[0].automationName, "financial-automation");
  assert.equal(records[0].workflowName, "financeiro-lembretes");
  assert.equal(records[0].triggerType, FinancialAutomationRequestType.REMINDER);
  assert.equal(records[0].attempt, 2);
  assert.deepEqual(records[1].input, { mode: "hml", requestType: "REMINDER" });
  assert.equal(JSON.stringify(records).includes("very-secret"), false);
});

test("orchestrator appends FAILED and TIMED_OUT without masking the main error", async () => {
  const failure = new Error("synthetic integration failure");
  failure.code = "FINANCIAL_N8N_OPERATION_FAILED";
  const failedFixture = createFixture({ serviceError: failure });
  const timeoutFixture = createFixture({ pending: true, timeoutMs: 5 });

  const failedResult = await failedFixture.orchestrator.execute(validInput());
  const timeoutResult = await timeoutFixture.orchestrator.execute(validInput());
  const failedRecords = await failedFixture.repository.list({ limit: 10 });
  const timeoutRecords = await timeoutFixture.repository.list({ limit: 10 });

  assert.equal(failedResult.success, false);
  assert.equal(failedRecords[0].status, "FAILED");
  assert.equal(failedRecords[0].error.code, "FINANCIAL_N8N_OPERATION_FAILED");
  assert.equal("stack" in failedRecords[0].error, false);
  assert.equal(timeoutResult.status, "TIMEOUT");
  assert.equal(timeoutRecords[0].status, "TIMED_OUT");
  assert.equal(timeoutRecords[0].error.category, "Timeout");
  assert.deepEqual(
    timeoutRecords.map((record) => record.status),
    ["TIMED_OUT", "STARTED"],
  );
});

test("orchestrator appends WARNING and CANCELLED transitions", async () => {
  const warningFixture = createFixture({
    serviceResult: {
      executionId: "external-warning",
      status: "STARTED",
      warnings: ["MOCK_WARNING"],
    },
  });
  const cancelledFixture = createFixture({
    serviceResult: { executionId: "external-cancelled", status: "CANCELLED" },
  });

  const warningResult = await warningFixture.orchestrator.execute(validInput());
  const cancelledResult = await cancelledFixture.orchestrator.execute(validInput());
  const warningRecords = await warningFixture.repository.list({ limit: 10 });
  const cancelledRecords = await cancelledFixture.repository.list({ limit: 10 });

  assert.deepEqual(warningResult.warnings, ["MOCK_WARNING"]);
  assert.deepEqual(
    warningRecords.map((record) => record.status),
    ["WARNING", "SUCCEEDED", "STARTED"],
  );
  assert.deepEqual(warningRecords[0].output, { warning: "MOCK_WARNING" });
  assert.equal(cancelledResult.success, true);
  assert.equal(cancelledResult.status, "CANCELLED");
  assert.deepEqual(
    cancelledRecords.map((record) => record.status),
    ["CANCELLED", "STARTED"],
  );
});

test("history repository failure only adds an internal warning and controlled log", async () => {
  const logs = [];
  const historyService = new FinancialAutomationHistoryService({
    repository: {
      async save() {
        const error = new Error("database message must not be logged");
        error.code = "ER_MOCK_HISTORY";
        throw error;
      },
    },
  });
  const fixture = createFixture({ historyService, logger: { warn: (entry) => logs.push(entry) } });

  const result = await fixture.orchestrator.execute(validInput());

  assert.equal(result.success, true);
  assert.deepEqual(result.warnings, [AUTOMATION_HISTORY_PERSISTENCE_FAILED]);
  assert.equal(logs.length, 2);
  assert.deepEqual(logs[0], {
    code: "ER_MOCK_HISTORY",
    event: "financial.automation.history.started.failed",
  });
  assert.equal(JSON.stringify(logs).includes("database message"), false);
});

function createFixture(options = {}) {
  const repository = options.repository || new InMemoryAutomationExecutionHistoryRepository();
  let historyId = 0;
  const historyService =
    options.historyService ||
    new FinancialAutomationHistoryService({
      createId: () => `history-event-${++historyId}`,
      now: () => new Date("2026-07-09T12:00:02.000Z"),
      repository,
    });
  const timestamps = [
    "2026-07-09T12:00:00.000Z",
    "2026-07-09T12:00:00.100Z",
    "2026-07-09T12:00:00.250Z",
    "2026-07-09T12:00:01.500Z",
  ];
  let clockIndex = 0;
  const orchestrator = new FinancialAutomationOrchestrator({
    audit: { async record() {} },
    financialAutomationService: {
      async startWorkflow() {
        if (options.serviceError) throw options.serviceError;
        if (options.pending) return new Promise(() => {});
        return options.serviceResult || { executionId: "external-default", status: "STARTED" };
      },
    },
    historyService,
    logger: options.logger,
    now: () => new Date(timestamps[Math.min(clockIndex++, timestamps.length - 1)]),
    timeoutMs: options.timeoutMs || 100,
  });
  return { orchestrator, repository };
}

function validInput() {
  return {
    actor: { id: "operator-history", type: "USER" },
    attempt: 2,
    correlationId: "corr-history-1",
    metadata: { apiKey: "very-secret", fixture: "safe" },
    mode: "hml",
    payload: { password: "very-secret", syntheticId: "item-1" },
    requestType: FinancialAutomationRequestType.REMINDER,
  };
}
