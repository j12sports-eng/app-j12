class ScenarioExecutionReport {
  constructor(input = {}) {
    this.total = toCount(input.total);
    this.success = toCount(input.success);
    this.failed = toCount(input.failed);
    this.duration = toDuration(input.duration);
    this.scenarios = Object.freeze(cloneArray(input.scenarios));
    this.warnings = Object.freeze(normalizeMessages(input.warnings));
    this.errors = Object.freeze(normalizeErrors(input.errors));
    Object.freeze(this);
  }

  toJSON() {
    return {
      duration: this.duration,
      errors: this.errors,
      failed: this.failed,
      scenarios: this.scenarios,
      success: this.success,
      total: this.total,
      warnings: this.warnings,
    };
  }

  static fromScenarios(scenarios, duration = 0, reportMessages = {}) {
    const entries = cloneArray(scenarios);
    return new ScenarioExecutionReport({
      duration,
      errors: [...entries.flatMap((item) => item.errors || []), ...(reportMessages.errors || [])],
      failed: entries.filter((item) => item.success !== true).length,
      scenarios: entries,
      success: entries.filter((item) => item.success === true).length,
      total: entries.length,
      warnings: [
        ...entries.flatMap((item) => item.warnings || []),
        ...(reportMessages.warnings || []),
      ],
    });
  }
}

function toCount(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function toDuration(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function cloneArray(value) {
  if (!Array.isArray(value)) return [];
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return [];
  }
}

function normalizeMessages(values) {
  return (Array.isArray(values) ? values : []).map(String).map((item) => item.trim()).filter(Boolean);
}

function normalizeErrors(values) {
  return (Array.isArray(values) ? values : []).map((error) => {
    if (typeof error === "string") return { code: "SCENARIO_ERROR", message: error };
    return error && typeof error === "object" ? error : { code: "SCENARIO_ERROR", message: String(error) };
  });
}

module.exports = { ScenarioExecutionReport };
