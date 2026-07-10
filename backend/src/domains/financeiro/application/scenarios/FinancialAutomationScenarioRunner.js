const { performance } = require("node:perf_hooks");

const { ScenarioDefinition } = require("./ScenarioDefinition.js");
const { ScenarioExecutionReport } = require("./ScenarioExecutionReport.js");

class FinancialAutomationScenarioRunner {
  constructor(options = {}) {
    this.executor = options.executor || options.hmlExecutor || null;
    this.timeoutMs = positiveInteger(options.timeoutMs, 5000);
    this.maxAttempts = positiveInteger(options.maxAttempts, 2);
    this.clock = typeof options.clock === "function" ? options.clock : () => performance.now();
  }

  async executeScenario(input) {
    const startedAt = this.clock();
    let scenario;
    try {
      scenario = ScenarioDefinition.from(input);
    } catch (error) {
      return failedDefinition(error, elapsed(this.clock, startedAt));
    }

    const warnings = [];
    let actualResult = null;
    let attempts = 0;
    const allowedAttempts = Math.min(
      positiveInteger(scenario.expectedResult.attempts, 1),
      this.maxAttempts,
    );

    while (attempts < allowedAttempts) {
      attempts += 1;
      try {
        actualResult = normalizeResult(await withTimeout(this.invoke(scenario, attempts), this.timeoutMs));
        if (actualResult.success || attempts >= allowedAttempts) break;
        warnings.push(`SCENARIO_RETRY_ATTEMPT_${attempts}`);
      } catch (error) {
        actualResult = failureFromError(error);
        if (!isRetryable(error) || attempts >= allowedAttempts) break;
        warnings.push(`SCENARIO_RETRY_ATTEMPT_${attempts}`);
      }
    }

    const mismatches = compareExpected(scenario.expectedResult, actualResult, attempts);
    const errors = [...normalizeErrors(actualResult?.errors)];
    if (mismatches.length) {
      errors.push({
        code: "SCENARIO_EXPECTATION_MISMATCH",
        details: { mismatches },
        message: "Scenario result did not match its expected result.",
      });
    }

    return {
      actualResult,
      attempts,
      duration: elapsed(this.clock, startedAt),
      errors,
      expectedResult: scenario.expectedResult,
      id: scenario.id,
      mode: scenario.mode,
      name: scenario.name,
      success: mismatches.length === 0,
      warnings: [...warnings, ...normalizeWarnings(actualResult?.warnings)],
      workflow: scenario.workflow,
    };
  }

  async execute(scenarios = []) {
    if (!Array.isArray(scenarios)) throw new TypeError("Scenarios must be an array.");
    const startedAt = this.clock();
    const results = [];
    for (const scenario of scenarios) results.push(await this.executeScenario(scenario));
    return ScenarioExecutionReport.fromScenarios(results, elapsed(this.clock, startedAt));
  }

  async run(scenarios = []) {
    return this.execute(scenarios);
  }

  async runScenario(scenario) {
    return this.executeScenario(scenario);
  }

  invoke(scenario, attempt) {
    const execute = typeof this.executor === "function" ? this.executor : this.executor?.execute;
    if (typeof execute !== "function") {
      const error = new Error("Scenario runner requires an injected mock or HML executor.");
      error.code = "SCENARIO_EXECUTOR_INVALID";
      throw error;
    }
    return execute.call(this.executor, {
      attempt,
      mode: scenario.mode,
      payload: scenario.payload,
      scenarioId: scenario.id,
      workflow: scenario.workflow,
    });
  }
}

function compareExpected(expected, actual, attempts) {
  const mismatches = [];
  if (Object.hasOwn(expected, "success") && expected.success !== actual?.success) mismatches.push("success");
  if (expected.status !== undefined && expected.status !== actual?.status) mismatches.push("status");
  if (expected.attempts !== undefined && expected.attempts !== attempts) mismatches.push("attempts");
  if (expected.errorCode !== undefined && !normalizeErrors(actual?.errors).some((error) => error.code === expected.errorCode)) mismatches.push("errorCode");
  return mismatches;
}

function normalizeResult(value) {
  if (!value || typeof value !== "object") return { errors: [], status: "COMPLETED", success: true, warnings: [] };
  const serialized = typeof value.toJSON === "function" ? value.toJSON() : value;
  return { ...serialized, errors: normalizeErrors(serialized.errors), success: serialized.success === true, warnings: normalizeWarnings(serialized.warnings) };
}

function failureFromError(error) {
  return { errors: [{ code: String(error?.code || "SCENARIO_UNEXPECTED_ERROR"), message: safeMessage(error) }], status: error?.code === "SCENARIO_TIMEOUT" ? "TIMEOUT" : "FAILED", success: false, warnings: [] };
}

function withTimeout(value, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error("Scenario execution timed out.");
      error.code = "SCENARIO_TIMEOUT";
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([Promise.resolve(value), timeout]).finally(() => clearTimeout(timeoutId));
}

function isRetryable(error) {
  return error?.retryable === true || ["ETIMEDOUT", "ECONNRESET", "SCENARIO_RETRYABLE_ERROR"].includes(error?.code);
}

function normalizeErrors(values) {
  return (Array.isArray(values) ? values : []).map((error) => typeof error === "string" ? { code: "SCENARIO_ERROR", message: error } : error).filter(Boolean);
}

function normalizeWarnings(values) {
  return (Array.isArray(values) ? values : []).map(String).filter(Boolean);
}

function failedDefinition(error, duration) {
  return { actualResult: null, attempts: 0, duration, errors: [{ code: "SCENARIO_DEFINITION_INVALID", message: safeMessage(error) }], expectedResult: {}, id: null, mode: null, name: null, success: false, warnings: [], workflow: null };
}

function safeMessage(error) {
  return typeof error?.message === "string" ? error.message.slice(0, 500) : "Scenario execution failed.";
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function elapsed(clock, startedAt) {
  return Math.max(0, Number((clock() - startedAt).toFixed(3)));
}

module.exports = { FinancialAutomationScenarioRunner };
