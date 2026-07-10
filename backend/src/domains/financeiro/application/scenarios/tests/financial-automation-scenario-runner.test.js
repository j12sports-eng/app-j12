const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_FINANCIAL_AUTOMATION_SCENARIOS,
  FinancialAutomationScenarioRunner,
  ScenarioDefinition,
  ScenarioExecutionReport,
} = require("../index.js");

test("ScenarioDefinition validates and freezes the standardized contract", () => {
  const definition = validScenario();

  assert.equal(definition instanceof ScenarioDefinition, true);
  assert.equal(Object.isFrozen(definition), true);
  assert.equal(Object.isFrozen(definition.payload), true);
  assert.throws(() => new ScenarioDefinition({ ...definition.toJSON(), mode: "production" }), /mode/);
  assert.throws(() => new ScenarioDefinition({ ...definition.toJSON(), payload: [] }), /payload/);
});

test("runner executes an individual scenario through the injected executor", async () => {
  const calls = [];
  const runner = new FinancialAutomationScenarioRunner({
    executor: async (input) => {
      calls.push(input);
      return { status: "COMPLETED", success: true, warnings: ["MOCK_WARNING"] };
    },
  });

  const result = await runner.runScenario(validScenario());

  assert.equal(result.success, true);
  assert.equal(result.attempts, 1);
  assert.deepEqual(result.warnings, ["MOCK_WARNING"]);
  assert.deepEqual(calls[0], {
    attempt: 1,
    mode: "hml",
    payload: { synthetic: true },
    scenarioId: "scenario-success",
    workflow: "financeiro-cobranca-diaria",
  });
});

test("runner executes a batch and consolidates the final report", async () => {
  const runner = new FinancialAutomationScenarioRunner({
    executor: async ({ scenarioId }) => ({
      errors: scenarioId === "failure" ? [{ code: "EXPECTED_FAILURE", message: "mock" }] : [],
      success: scenarioId !== "failure",
    }),
  });
  const scenarios = [
    validScenario(),
    new ScenarioDefinition({
      ...validScenario().toJSON(),
      expectedResult: { success: true },
      id: "failure",
      name: "Failure",
    }),
  ];

  const report = await runner.run(scenarios);

  assert.equal(report instanceof ScenarioExecutionReport, true);
  assert.equal(report.total, 2);
  assert.equal(report.success, 1);
  assert.equal(report.failed, 1);
  assert.equal(report.scenarios.length, 2);
  assert.equal(report.errors.some((error) => error.code === "SCENARIO_EXPECTATION_MISMATCH"), true);
});

test("runner converts timeout into a deterministic result without external calls", async () => {
  const runner = new FinancialAutomationScenarioRunner({
    executor: () => new Promise(() => {}),
    timeoutMs: 5,
  });
  const scenario = new ScenarioDefinition({
    ...validScenario().toJSON(),
    expectedResult: { errorCode: "SCENARIO_TIMEOUT", success: false },
    id: "timeout",
    name: "Timeout",
  });

  const result = await runner.executeScenario(scenario);

  assert.equal(result.success, true);
  assert.equal(result.actualResult.status, "TIMEOUT");
  assert.equal(result.actualResult.errors[0].code, "SCENARIO_TIMEOUT");
});

test("runner retries a failed attempt up to the scenario expectation", async () => {
  let calls = 0;
  const runner = new FinancialAutomationScenarioRunner({
    executor: async () => ({ success: ++calls === 2 }),
    maxAttempts: 3,
  });
  const scenario = new ScenarioDefinition({
    ...validScenario().toJSON(),
    expectedResult: { attempts: 2, success: true },
    id: "retry",
    name: "Retry",
  });

  const result = await runner.executeScenario(scenario);

  assert.equal(result.success, true);
  assert.equal(result.attempts, 2);
  assert.deepEqual(result.warnings, ["SCENARIO_RETRY_ATTEMPT_1"]);
});

test("runner validates workflow and payload outcomes returned by the HML mock", async () => {
  const runner = new FinancialAutomationScenarioRunner({ executor: hmlMockExecutor });
  const workflow = DEFAULT_FINANCIAL_AUTOMATION_SCENARIOS.find((item) => item.id === "workflow-not-found");
  const payload = DEFAULT_FINANCIAL_AUTOMATION_SCENARIOS.find((item) => item.id === "invalid-payload");

  const [workflowResult, payloadResult] = await Promise.all([
    runner.executeScenario(workflow),
    runner.executeScenario(payload),
  ]);

  assert.equal(workflowResult.success, true);
  assert.equal(payloadResult.success, true);
  assert.equal(workflowResult.actualResult.errors[0].code, "AUTOMATION_WORKFLOW_NOT_MAPPED");
  assert.equal(payloadResult.actualResult.errors[0].code, "AUTOMATION_PAYLOAD_INVALID");
});

test("default scenarios cover all seven required behaviors and produce a report", async () => {
  const runner = new FinancialAutomationScenarioRunner({
    executor: hmlMockExecutor,
    timeoutMs: 5,
  });

  const report = await runner.execute(DEFAULT_FINANCIAL_AUTOMATION_SCENARIOS);

  assert.deepEqual(DEFAULT_FINANCIAL_AUTOMATION_SCENARIOS.map((item) => item.id), [
    "success",
    "workflow-not-found",
    "invalid-payload",
    "timeout",
    "retry",
    "integration-error",
    "unexpected-error",
  ]);
  assert.equal(report.total, 7);
  assert.equal(report.success, 7);
  assert.equal(report.failed, 0);
  assert.equal(report.duration >= 0, true);
});

function validScenario() {
  return new ScenarioDefinition({
    description: "Synthetic success.",
    expectedResult: { success: true },
    id: "scenario-success",
    mode: "hml",
    name: "Success",
    payload: { synthetic: true },
    workflow: "financeiro-cobranca-diaria",
  });
}

async function hmlMockExecutor({ attempt, payload }) {
  switch (payload.simulation) {
    case "workflow_not_found":
      return failed("AUTOMATION_WORKFLOW_NOT_MAPPED");
    case "invalid_payload":
      return failed("AUTOMATION_PAYLOAD_INVALID");
    case "timeout":
      return new Promise(() => {});
    case "retry":
      return attempt === 1 ? failed("SCENARIO_RETRYABLE_ERROR") : { success: true };
    case "integration_error":
      return failed("AUTOMATION_INTEGRATION_ERROR");
    case "unexpected_error": {
      const error = new Error("synthetic unexpected failure");
      error.code = "SCENARIO_UNEXPECTED_ERROR";
      throw error;
    }
    default:
      return { status: "COMPLETED", success: true };
  }
}

function failed(code) {
  return { errors: [{ code, message: "Synthetic HML failure." }], status: "FAILED", success: false };
}
