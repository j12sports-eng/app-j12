const assert = require("node:assert/strict");
const test = require("node:test");

const {
  FINANCIAL_N8N_OPERATION_FAILED_CODE,
  FinancialAutomationService,
} = require("../services/financial-automation.service.js");
const { validateN8nPayload } = require("../contracts/n8n-integration.contract.js");

test("FinancialAutomationService prepares payload and starts through the integration", async () => {
  const calls = [];
  const logs = [];
  const integration = createMockIntegration(calls);
  const service = new FinancialAutomationService({
    createCorrelationId: () => "corr-generated",
    integration,
    logger: {
      error(entry) {
        logs.push(entry);
      },
      info(entry) {
        logs.push(entry);
      },
    },
  });

  const result = await service.startWorkflow({
    data: { synthetic: true },
    metadata: { mode: "MOCK" },
    workflowKey: "financeiro-lembretes",
  });

  assert.equal(result.executionId, "exec-mock-1");
  assert.equal(calls[0][0], "start");
  assert.equal(calls[0][1].correlationId, "corr-generated");
  assert.equal(calls[0][1].metadata.source, "financial-automation-service");
  assert.deepEqual(
    logs.map((entry) => entry.event),
    ["financial.n8n.start.requested", "financial.n8n.start.completed"],
  );
  assert.equal("data" in logs[0], false);
});

test("FinancialAutomationService delegates status and cancellation", async () => {
  const calls = [];
  const service = new FinancialAutomationService({ integration: createMockIntegration(calls) });

  const status = await service.getExecutionStatus({ executionId: "exec-mock-1" });
  const cancelled = await service.cancelExecution({
    executionId: "exec-mock-1",
    reason: "operator requested mock cancellation",
  });

  assert.equal(status.status, "RUNNING");
  assert.equal(cancelled.status, "CANCELLED");
  assert.deepEqual(
    calls.map(([operation]) => operation),
    ["status", "cancel"],
  );
});

test("FinancialAutomationService wraps integration errors without logging payload data", async () => {
  const logs = [];
  const integration = createMockIntegration([]);
  integration.startWorkflow = async () => {
    const error = new Error("mock transport unavailable");
    error.code = "MOCK_UNAVAILABLE";
    throw error;
  };
  const service = new FinancialAutomationService({
    integration,
    logger: { error: (entry) => logs.push(entry), info: (entry) => logs.push(entry) },
  });

  await assert.rejects(
    service.startWorkflow({
      correlationId: "corr-failure",
      data: { privatePayload: "must-not-be-logged" },
      workflowKey: "financeiro-lembretes",
    }),
    {
      code: FINANCIAL_N8N_OPERATION_FAILED_CODE,
    },
  );

  assert.equal(logs.at(-1).errorCode, "MOCK_UNAVAILABLE");
  assert.equal(JSON.stringify(logs).includes("must-not-be-logged"), false);
});

function createMockIntegration(calls) {
  return {
    async cancelExecution(input) {
      calls.push(["cancel", input]);
      return { executionId: input.executionId, status: "CANCELLED" };
    },
    async getExecutionStatus(input) {
      calls.push(["status", input]);
      return { executionId: input.executionId, status: "RUNNING" };
    },
    async startWorkflow(input) {
      calls.push(["start", input]);
      return { executionId: "exec-mock-1", status: "STARTED" };
    },
    validatePayload: validateN8nPayload,
  };
}
