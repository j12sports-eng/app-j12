const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AutomationError,
  AutomationErrorCategory,
  AutomationExecutionContext,
  AutomationExecutionResult,
  DEFAULT_WORKFLOW_MAP,
  FinancialAutomationOrchestrator,
  FinancialAutomationRequestType,
} = require("../index.js");

test("FinancialAutomationOrchestrator selects the canonical workflow for every request type", () => {
  const orchestrator = createOrchestrator().orchestrator;

  for (const [requestType, workflow] of Object.entries(DEFAULT_WORKFLOW_MAP)) {
    assert.equal(orchestrator.selectWorkflow(requestType), workflow);
  }
});

test("FinancialAutomationOrchestrator builds payload and returns the standardized result", async () => {
  const fixture = createOrchestrator();

  const result = await fixture.orchestrator.execute({
    actor: { id: "operator-1", type: "USER" },
    correlationId: "corr-20-9",
    metadata: { mode: "MOCK", actorId: "cannot-override" },
    payload: { syntheticId: "item-1" },
    requestType: FinancialAutomationRequestType.REMINDER,
  });

  assert.equal(result instanceof AutomationExecutionResult, true);
  assert.equal(result.success, true);
  assert.equal(result.status, "STARTED");
  assert.equal(result.workflow, "financeiro-lembretes");
  assert.equal(result.executionId, "exec-mock-1");
  assert.deepEqual(result.errors, []);
  assert.equal(fixture.serviceCalls.length, 1);
  assert.deepEqual(fixture.serviceCalls[0], {
    correlationId: "corr-20-9",
    data: {
      payload: { syntheticId: "item-1" },
      requestType: FinancialAutomationRequestType.REMINDER,
    },
    metadata: { actorId: "operator-1", actorType: "USER", mode: "MOCK" },
    workflowKey: "financeiro-lembretes",
  });
});

test("FinancialAutomationOrchestrator converts integration failures to standardized errors", async () => {
  const cause = new Error("mock integration failed");
  cause.code = "FINANCIAL_N8N_OPERATION_FAILED";
  const fixture = createOrchestrator({ serviceError: cause });

  const result = await fixture.orchestrator.execute(validRequest());

  assert.equal(result.success, false);
  assert.equal(result.status, "FAILED");
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].category, AutomationErrorCategory.INTEGRATION);
  assert.equal(result.errors[0].code, "FINANCIAL_N8N_OPERATION_FAILED");
  assert.equal(fixture.auditEntries.at(-1).event, "financial.automation.failed");
});

test("FinancialAutomationOrchestrator classifies timeout and clears the execution", async () => {
  const fixture = createOrchestrator({ pending: true, timeoutMs: 5 });

  const result = await fixture.orchestrator.execute(validRequest());

  assert.equal(result.success, false);
  assert.equal(result.status, "TIMEOUT");
  assert.equal(result.errors[0].category, AutomationErrorCategory.TIMEOUT);
  assert.equal(result.errors[0].code, "ETIMEDOUT");
});

test("FinancialAutomationOrchestrator rejects unmapped requests without calling the service", async () => {
  const fixture = createOrchestrator();

  const result = await fixture.orchestrator.execute({
    ...validRequest(),
    requestType: "UNKNOWN_AUTOMATION",
  });

  assert.equal(result.success, false);
  assert.equal(result.errors[0].category, AutomationErrorCategory.VALIDATION);
  assert.equal(result.errors[0].code, "AUTOMATION_WORKFLOW_NOT_MAPPED");
  assert.equal(fixture.serviceCalls.length, 0);
});

test("FinancialAutomationOrchestrator audits request and successful start without payload", async () => {
  const fixture = createOrchestrator();

  await fixture.orchestrator.execute(validRequest());

  assert.deepEqual(
    fixture.auditEntries.map((entry) => entry.event),
    ["financial.automation.requested", "financial.automation.started"],
  );
  assert.equal(fixture.auditEntries[0].correlationId, "corr-generated");
  assert.equal(fixture.auditEntries[1].executionId, "exec-mock-1");
  assert.equal(JSON.stringify(fixture.auditEntries).includes("syntheticId"), false);
});

test("FinancialAutomationOrchestrator blocks service invocation when initial audit fails", async () => {
  const fixture = createOrchestrator({ auditError: new Error("mock audit unavailable") });

  const result = await fixture.orchestrator.execute(validRequest());

  assert.equal(result.success, false);
  assert.equal(result.errors[0].category, AutomationErrorCategory.INFRASTRUCTURE);
  assert.equal(result.errors[0].code, "AUTOMATION_AUDIT_WRITE_FAILED");
  assert.equal(fixture.serviceCalls.length, 0);
  assert.deepEqual(result.warnings, ["AUTOMATION_AUDIT_FAILURE_FAILED"]);
});

test("execution primitives are immutable and AutomationError serializes safely", () => {
  const context = new AutomationExecutionContext({
    actor: { id: "system" },
    correlationId: "corr-primitive",
    metadata: { mode: "MOCK" },
    timestamps: { requestedAt: "2026-07-09T12:00:00.000Z" },
    workflow: "financeiro-lembretes",
  });
  const error = new AutomationError("Invalid fixture.", {
    category: AutomationErrorCategory.BUSINESS,
    code: "MOCK_BUSINESS_ERROR",
    details: { field: "fixture", secret: "not-exported" },
  });
  const result = AutomationExecutionResult.failed({
    errors: [error],
    metadata: { correlationId: context.correlationId },
    workflow: context.workflow,
  });

  assert.equal(Object.isFrozen(context), true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.errors[0].category, AutomationErrorCategory.BUSINESS);
  assert.equal("secret" in result.errors[0].details, false);
});

function validRequest() {
  return {
    actor: { id: "system-test", type: "SYSTEM" },
    payload: { syntheticId: "item-1" },
    requestType: FinancialAutomationRequestType.DAILY_COLLECTION,
  };
}

function createOrchestrator(options = {}) {
  const auditEntries = [];
  const serviceCalls = [];
  const audit = {
    async record(entry) {
      if (options.auditError) throw options.auditError;
      auditEntries.push(entry);
    },
  };
  const financialAutomationService = {
    async startWorkflow(payload) {
      serviceCalls.push(payload);
      if (options.serviceError) throw options.serviceError;
      if (options.pending) return new Promise(() => {});
      return { executionId: "exec-mock-1", status: "STARTED" };
    },
  };
  const orchestrator = new FinancialAutomationOrchestrator({
    audit,
    createCorrelationId: () => "corr-generated",
    financialAutomationService,
    now: () => new Date("2026-07-09T12:00:00.000Z"),
    timeoutMs: options.timeoutMs || 100,
  });
  return { auditEntries, orchestrator, serviceCalls };
}
