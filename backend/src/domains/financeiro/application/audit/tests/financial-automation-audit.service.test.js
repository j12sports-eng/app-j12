const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AutomationAuditRecord,
  AutomationAuditRepositoryContract,
  FinancialAutomationAuditService,
  InMemoryAutomationAuditRepository,
} = require("../index.js");
const { AutomationExecutionContext } = require("../../orchestrators/AutomationExecutionContext.js");

test("FinancialAutomationAuditService records start, warning and successful completion", async () => {
  const repository = new InMemoryAutomationAuditRepository();
  const service = new FinancialAutomationAuditService({ repository });
  const context = executionContext();

  await service.startExecution({ context, mode: "dry_run" });
  await service.recordWarning({ correlationId: context.correlationId, warning: "MOCK_WARNING" });
  const result = await service.finishExecution({
    context: context.withExecution({
      completedAt: "2026-07-09T12:00:01.250Z",
      executionId: "exec-audit-1",
      startedAt: "2026-07-09T12:00:00.000Z",
    }),
    warnings: ["MOCK_WARNING"],
  });

  assert.equal(result instanceof AutomationAuditRecord, true);
  assert.equal(result.success, true);
  assert.equal(result.duration, 1250);
  assert.equal(result.executionId, "exec-audit-1");
  assert.deepEqual(result.warnings, ["MOCK_WARNING"]);
  assert.deepEqual(result.actor, { id: "operator-audit", type: "USER" });
  assert.equal(await repository.findByExecutionId("exec-audit-1"), result);
});

test("FinancialAutomationAuditService records failure with sanitized errors", async () => {
  const repository = new InMemoryAutomationAuditRepository();
  const service = new FinancialAutomationAuditService({ repository });
  const context = executionContext();
  await service.startExecution({ context, mode: "hml" });

  const result = await service.failExecution({
    context: context.withExecution({ completedAt: "2026-07-09T12:00:00.500Z" }),
    errors: [{ category: "Integration", code: "MOCK_FAILURE", message: "Mock failure" }],
  });

  assert.equal(result.success, false);
  assert.equal(result.mode, "hml");
  assert.equal(result.duration, 500);
  assert.deepEqual(result.errors, [
    { category: "Integration", code: "MOCK_FAILURE", message: "Mock failure" },
  ]);
});

test("InMemoryAutomationAuditRepository filters records without external persistence", async () => {
  const repository = new InMemoryAutomationAuditRepository({
    records: [
      record({ correlationId: "corr-1", success: true, workflow: "workflow-a" }),
      record({ correlationId: "corr-2", success: false, workflow: "workflow-b" }),
    ],
  });

  assert.equal((await repository.list({ success: false })).length, 1);
  assert.equal((await repository.list({ workflow: "workflow-a" }))[0].correlationId, "corr-1");
  repository.clear();
  assert.deepEqual(await repository.list(), []);
});

test("AutomationAuditRepositoryContract remains abstract", async () => {
  const contract = new AutomationAuditRepositoryContract();
  await assert.rejects(contract.save(), { code: "AUTOMATION_AUDIT_REPOSITORY_NOT_IMPLEMENTED" });
  await assert.rejects(contract.findByCorrelationId(), {
    code: "AUTOMATION_AUDIT_REPOSITORY_NOT_IMPLEMENTED",
  });
});

function executionContext() {
  return new AutomationExecutionContext({
    actor: { id: "operator-audit", type: "USER" },
    correlationId: "corr-audit-1",
    metadata: { fixture: "mock" },
    timestamps: { requestedAt: "2026-07-09T12:00:00.000Z" },
    workflow: "financeiro-lembretes",
  });
}

function record(overrides = {}) {
  return new AutomationAuditRecord({
    actor: { id: "system" },
    correlationId: "corr-default",
    finishedAt: "2026-07-09T12:00:01.000Z",
    mode: "disabled",
    startedAt: "2026-07-09T12:00:00.000Z",
    success: true,
    workflow: "workflow-default",
    ...overrides,
  });
}
