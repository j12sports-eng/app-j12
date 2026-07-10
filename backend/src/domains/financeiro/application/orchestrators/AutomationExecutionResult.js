class AutomationExecutionResult {
  constructor(input = {}) {
    this.success = input.success === true;
    this.status = normalizeText(input.status, 80) || (this.success ? "COMPLETED" : "FAILED");
    this.workflow = normalizeText(input.workflow, 120);
    this.executionId = normalizeText(input.executionId, 191);
    this.warnings = Object.freeze(normalizeMessages(input.warnings));
    this.errors = Object.freeze(normalizeErrors(input.errors));
    this.metadata = Object.freeze(cloneMetadata(input.metadata));
    Object.freeze(this);
  }

  static succeeded(input = {}) {
    return new AutomationExecutionResult({ ...input, success: true });
  }

  static failed(input = {}) {
    return new AutomationExecutionResult({ ...input, success: false });
  }

  toJSON() {
    return {
      errors: this.errors,
      executionId: this.executionId,
      metadata: this.metadata,
      status: this.status,
      success: this.success,
      warnings: this.warnings,
      workflow: this.workflow,
    };
  }
}

function normalizeMessages(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeText(value, 500))
    .filter(Boolean);
}

function normalizeErrors(values) {
  return (Array.isArray(values) ? values : [])
    .map((error) => {
      if (error && typeof error.toJSON === "function") return error.toJSON();
      if (!error || typeof error !== "object") return null;
      return {
        category: normalizeText(error.category, 80) || "Unexpected",
        code: normalizeText(error.code, 120) || "AUTOMATION_UNEXPECTED_ERROR",
        details: cloneMetadata(error.details),
        message: normalizeText(error.message, 500) || "Automation orchestration failed.",
      };
    })
    .filter(Boolean);
}

function cloneMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return {};
  }
}

function normalizeText(value, maxLength) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

module.exports = { AutomationExecutionResult };
