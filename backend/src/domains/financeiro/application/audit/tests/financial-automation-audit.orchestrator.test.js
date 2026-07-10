const assert = require("node:assert/strict");
const test = require("node:test");

const { FinancialAutomationAuditService, InMemoryAutomationAuditRepository } = require("../index.js");
const {
  FinancialAutomationOrchestrator,
} = require("../../orchestrators/FinancialAutomationOrchestrator.js");

test("orchestrator audit captures success, warnings, duration, actor and correlation", async () => {
  const fixture = createFixture({ warnings: ["MOCK_DEGRADED"] });
  const result = await fixture.orchestrator.execute(request());
  const audit = await fixture.repository.findByCorrelationId("corr-audit-orchestrator");

  assert.equal(result.success, true);
  assert.deepEqual(result.warnings, ["MOCK_DEGRADED"]);
  assert.equal(audit.success, true);
  assert.equal(audit.executionId, "exec-mock-audit");
  assert.equal(audit.correlationId, "corr-audit-orchestrator");
  assert.equal(audit.workflow, "financeiro-lembretes");
  assert.deepEqual(audit.actor, { id: "audit-user", type: "USER" });
  assert.equal(audit.mode, "dry_run");
  assert.ok(audit.duration >= 0);
  assert.deepEqual(audit.warnings, ["MOCK_DEGRADED"]);
});

test("orchestrator audit captures integration error", async () => {
  const error = new Error("Mock integration unavailable");
  error.code = "FINANCIAL_N8N_OPERATION_FAILED";
  const fixture = createFixture({ error });
  const result = await fixture.orchestrator.execute(request());
  const audit = await fixture.repository.findByCorrelationId("corr-audit-orchestrator");

  assert.equal(result.success, false);
  assert.equal(audit.success, false);
  assert.equal(audit.errors[0].category, "Integration");
  assert.equal(audit.errors[0].code, "FINANCIAL_N8N_OPERATION_FAILED");
});

test("orchestrator audit captures timeout", async () => {
  const fixture = createFixture({ pending: true, timeoutMs: 5 });
  const result = await fixture.orchestrator.execute(request());
  const audit = await fixture.repository.findByCorrelationId("corr-audit-orchestrator");

  assert.equal(result.status, "TIMEOUT");
  assert.equal(audit.success, false);
  assert.equal(audit.errors[0].category, "Timeout");
  assert.equal(audit.errors[0].code, "ETIMEDOUT");
});

function createFixture(options = {}) {
  const repository = new InMemoryAutomationAuditRepository();
  const auditService = new FinancialAutomationAuditService({ repository });
  let tick = 0;
  const orchestrator = new FinancialAutomationOrchestrator({
    auditService,
    createCorrelationId: () => "corr-audit-orchestrator",
    financialAutomationService: {
      async startWorkflow() {
        if (options.error) throw options.error;
        if (options.pending) return new Promise(() => {});
        return {
          executionId: "exec-mock-audit",
          status: "STARTED",
          warnings: options.warnings || [],
        };
      },
    },
    now: () => new Date(1_752_062_400_000 + tick++ * 250),
    timeoutMs: options.timeoutMs || 100,
  });
  return { orchestrator, repository };
}

function request() {
  return {
    actor: { id: "audit-user", type: "USER" },
    mode: "dry_run",
    payload: { synthetic: true },
    requestType: "REMINDER",
  };
}
