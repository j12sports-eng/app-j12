const AUTOMATION_HISTORY_RECORD_INVALID = "AUTOMATION_HISTORY_RECORD_INVALID";

const AutomationExecutionHistoryStatus = Object.freeze({
  CANCELLED: "CANCELLED",
  FAILED: "FAILED",
  STARTED: "STARTED",
  SUCCEEDED: "SUCCEEDED",
  TIMED_OUT: "TIMED_OUT",
  WARNING: "WARNING",
});

const SENSITIVE_KEY =
  /^(api[_-]?key|authorization|client[_-]?secret|cookie|credential|credentials|headers?|password|payload|private[_-]?key|secret|token|access[_-]?token|refresh[_-]?token)$/i;

class AutomationExecutionHistoryRecord {
  constructor(input = {}) {
    this.id = requiredText(input.id, "id", 64);
    this.executionId = requiredText(input.executionId, "executionId", 191);
    this.automationName = requiredText(input.automationName, "automationName", 120);
    this.workflowName = nullableText(input.workflowName, 120);
    this.triggerType = nullableText(input.triggerType, 80);
    this.status = normalizeStatus(input.status);
    this.startedAt = requiredTimestamp(input.startedAt, "startedAt");
    this.finishedAt = nullableTimestamp(input.finishedAt, "finishedAt");
    this.durationMs = normalizeDuration(input.durationMs);
    this.attempt = normalizeAttempt(input.attempt);
    this.correlationId = nullableText(input.correlationId, 191);
    this.input = freezeNullableObject(normalizeJsonField(input.input, "input"));
    this.output = freezeNullableObject(normalizeJsonField(input.output, "output"));
    this.error = freezeNullableObject(sanitizeError(input.error));
    this.metadata = freezeNullableObject(normalizeJsonField(input.metadata, "metadata"));
    this.createdAt = requiredTimestamp(input.createdAt, "createdAt");
    Object.freeze(this);
  }

  toJSON() {
    return {
      attempt: this.attempt,
      automationName: this.automationName,
      correlationId: this.correlationId,
      createdAt: this.createdAt,
      durationMs: this.durationMs,
      error: this.error,
      executionId: this.executionId,
      finishedAt: this.finishedAt,
      id: this.id,
      input: this.input,
      metadata: this.metadata,
      output: this.output,
      startedAt: this.startedAt,
      status: this.status,
      triggerType: this.triggerType,
      workflowName: this.workflowName,
    };
  }
}

function sanitizeError(value) {
  if (!value) return null;
  const source =
    value instanceof Error
      ? { category: value.category, code: value.code, message: value.message, name: value.name }
      : value;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { message: String(source).slice(0, 500), name: "Error" };
  }
  const safe = {};
  for (const key of ["name", "message", "code", "category"]) {
    const text = nullableText(source[key], key === "message" ? 500 : 120);
    if (text) safe[key] = text;
  }
  if (source.details && typeof source.details === "object") {
    const details = sanitizeJson(source.details);
    if (details) safe.details = details;
  }
  return Object.keys(safe).length ? safe : null;
}

function sanitizeJson(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return null;
  if (depth > 8) return "[TRUNCATED]";
  if (["string", "number", "boolean"].includes(typeof value)) return value;
  if (typeof value !== "object" || value instanceof Error) return null;
  if (seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value))
    return value.slice(0, 100).map((item) => sanitizeJson(item, depth + 1, seen));
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) continue;
    const safe = sanitizeJson(item, depth + 1, seen);
    if (safe !== undefined) output[key] = safe;
  }
  return output;
}

function normalizeJsonField(value, field) {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof Error) {
    throw invalid(`Automation history ${field} must be an object or null.`, field);
  }
  return sanitizeJson(value);
}

function freezeNullableObject(value) {
  if (value === null) return null;
  const cloned = JSON.parse(JSON.stringify(value));
  return deepFreeze(cloned);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function normalizeStatus(value) {
  const status = nullableText(value, 32)?.toUpperCase();
  if (!Object.values(AutomationExecutionHistoryStatus).includes(status)) {
    throw invalid("Automation history status is invalid.", "status");
  }
  return status;
}

function normalizeAttempt(value) {
  const parsed = value === undefined || value === null ? 1 : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw invalid("Automation history attempt is invalid.", "attempt");
  return parsed;
}

function normalizeDuration(value) {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0)
    throw invalid("Automation history durationMs is invalid.", "durationMs");
  return parsed;
}

function requiredTimestamp(value, field) {
  const timestamp = nullableTimestamp(value, field);
  if (!timestamp) throw invalid(`Automation history requires ${field}.`, field);
  return timestamp;
}

function nullableTimestamp(value, field) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw invalid(`Automation history ${field} is invalid.`, field);
  return parsed.toISOString();
}

function requiredText(value, field, max) {
  const text = nullableText(value, max);
  if (!text) throw invalid(`Automation history requires ${field}.`, field);
  return text;
}

function nullableText(value, max) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
}

function invalid(message, field) {
  const error = new TypeError(message);
  error.code = AUTOMATION_HISTORY_RECORD_INVALID;
  error.details = { field };
  return error;
}

module.exports = {
  AUTOMATION_HISTORY_RECORD_INVALID,
  AutomationExecutionHistoryRecord,
  AutomationExecutionHistoryStatus,
  sanitizeAutomationHistoryError: sanitizeError,
  sanitizeAutomationHistoryJson: sanitizeJson,
};
