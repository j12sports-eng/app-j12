const AUTOMATION_AUDIT_RECORD_INVALID = "AUTOMATION_AUDIT_RECORD_INVALID";

class AutomationAuditRecord {
  constructor(input = {}) {
    this.executionId = nullableText(input.executionId, 191);
    this.correlationId = requiredText(input.correlationId, "correlationId", 191);
    this.workflow = requiredText(input.workflow, "workflow", 120);
    this.actor = Object.freeze(normalizeActor(input.actor));
    this.mode = normalizeMode(input.mode);
    this.startedAt = requiredTimestamp(input.startedAt, "startedAt");
    this.finishedAt = nullableTimestamp(input.finishedAt, "finishedAt");
    this.duration = normalizeDuration(input.duration, this.startedAt, this.finishedAt);
    this.success = typeof input.success === "boolean" ? input.success : null;
    this.warnings = Object.freeze(normalizeMessages(input.warnings));
    this.errors = Object.freeze(normalizeErrors(input.errors));
    this.metadata = Object.freeze(cloneJsonObject(input.metadata));
    Object.freeze(this);
  }

  finish(input = {}) {
    return new AutomationAuditRecord({
      ...this.toJSON(),
      errors: input.errors ?? this.errors,
      executionId: input.executionId ?? this.executionId,
      finishedAt: input.finishedAt,
      metadata: { ...this.metadata, ...cloneJsonObject(input.metadata) },
      success: input.success,
      warnings: input.warnings ?? this.warnings,
    });
  }

  addWarning(warning, metadata = {}) {
    return new AutomationAuditRecord({
      ...this.toJSON(),
      metadata: { ...this.metadata, ...cloneJsonObject(metadata) },
      warnings: [...this.warnings, requiredText(warning, "warning", 500)],
    });
  }

  toJSON() {
    return {
      actor: this.actor,
      correlationId: this.correlationId,
      duration: this.duration,
      errors: this.errors,
      executionId: this.executionId,
      finishedAt: this.finishedAt,
      metadata: this.metadata,
      mode: this.mode,
      startedAt: this.startedAt,
      success: this.success,
      warnings: this.warnings,
      workflow: this.workflow,
    };
  }
}

function normalizeActor(value) {
  const actor = cloneJsonObject(value);
  return {
    id: requiredText(actor.id, "actor.id", 191),
    type: nullableText(actor.type, 80) || "SYSTEM",
  };
}

function normalizeMode(value) {
  const mode = nullableText(value, 30)?.toLowerCase() || "disabled";
  if (!["disabled", "dry_run", "hml"].includes(mode)) {
    throw invalid("Automation audit mode is invalid.", "mode");
  }
  return mode;
}

function normalizeDuration(value, startedAt, finishedAt) {
  if (!finishedAt) return null;
  const calculated = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const parsed = value === undefined || value === null ? calculated : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function normalizeMessages(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => nullableText(value, 500))
    .filter(Boolean);
}

function normalizeErrors(values) {
  return (Array.isArray(values) ? values : []).map((error) => {
    if (error && typeof error.toJSON === "function") return cloneJsonObject(error.toJSON());
    if (!error || typeof error !== "object") {
      return { category: "Unexpected", code: "AUTOMATION_AUDIT_ERROR", message: String(error) };
    }
    return {
      category: nullableText(error.category, 80) || "Unexpected",
      code: nullableText(error.code, 120) || "AUTOMATION_AUDIT_ERROR",
      message: nullableText(error.message, 500) || "Automation execution failed.",
    };
  });
}

function requiredTimestamp(value, field) {
  const result = nullableTimestamp(value, field);
  if (!result) throw invalid(`Automation audit requires ${field}.`, field);
  return result;
}

function nullableTimestamp(value, field) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw invalid(`Automation audit ${field} is invalid.`, field);
  return parsed.toISOString();
}

function cloneJsonObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return {};
  }
}

function requiredText(value, field, max) {
  const text = nullableText(value, max);
  if (!text) throw invalid(`Automation audit requires ${field}.`, field);
  return text;
}

function nullableText(value, max) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
}

function invalid(message, field) {
  const error = new TypeError(message);
  error.code = AUTOMATION_AUDIT_RECORD_INVALID;
  error.details = { field };
  return error;
}

module.exports = { AUTOMATION_AUDIT_RECORD_INVALID, AutomationAuditRecord };
