const { AutomationError, AutomationErrorCategory } = require("./AutomationError.js");

class AutomationExecutionContext {
  constructor(input = {}) {
    this.correlationId = requiredText(input.correlationId, "correlationId", 191);
    this.executionId = nullableText(input.executionId, 191);
    this.workflow = requiredText(input.workflow, "workflow", 120);
    this.timestamps = Object.freeze(normalizeTimestamps(input.timestamps));
    this.actor = Object.freeze(normalizeActor(input.actor));
    this.metadata = Object.freeze(cloneJsonObject(input.metadata, "metadata"));
    Object.freeze(this);
  }

  withExecution(input = {}) {
    return new AutomationExecutionContext({
      actor: this.actor,
      correlationId: this.correlationId,
      executionId: input.executionId ?? this.executionId,
      metadata: this.metadata,
      timestamps: {
        ...this.timestamps,
        completedAt: input.completedAt ?? this.timestamps.completedAt,
        startedAt: input.startedAt ?? this.timestamps.startedAt,
      },
      workflow: this.workflow,
    });
  }

  toJSON() {
    return {
      actor: this.actor,
      correlationId: this.correlationId,
      executionId: this.executionId,
      metadata: this.metadata,
      timestamps: this.timestamps,
      workflow: this.workflow,
    };
  }
}

function normalizeActor(value) {
  const actor = cloneJsonObject(value, "actor");
  const id = requiredText(actor.id, "actor.id", 191);
  return {
    id,
    type: nullableText(actor.type, 80) || "SYSTEM",
  };
}

function normalizeTimestamps(value) {
  const timestamps = value && typeof value === "object" ? value : {};
  return {
    completedAt: nullableIsoTimestamp(timestamps.completedAt, "completedAt"),
    requestedAt: requiredIsoTimestamp(timestamps.requestedAt, "requestedAt"),
    startedAt: nullableIsoTimestamp(timestamps.startedAt, "startedAt"),
  };
}

function requiredIsoTimestamp(value, field) {
  const normalized = nullableIsoTimestamp(value, field);
  if (!normalized) throw validationError(`Automation context requires ${field}.`, field);
  return normalized;
}

function nullableIsoTimestamp(value, field) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw validationError(`Automation context requires a valid ${field}.`, field);
  }
  return new Date(value).toISOString();
}

function cloneJsonObject(value, field) {
  const source = value === undefined ? {} : value;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw validationError(`Automation context requires ${field} as an object.`, field);
  }
  try {
    return JSON.parse(JSON.stringify(source));
  } catch {
    throw validationError(`Automation context requires JSON-safe ${field}.`, field);
  }
}

function requiredText(value, field, maxLength) {
  const normalized = nullableText(value, maxLength);
  if (!normalized) throw validationError(`Automation context requires ${field}.`, field);
  return normalized;
}

function nullableText(value, maxLength) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function validationError(message, field) {
  return new AutomationError(message, {
    category: AutomationErrorCategory.VALIDATION,
    code: "AUTOMATION_CONTEXT_INVALID",
    details: { field },
  });
}

module.exports = { AutomationExecutionContext };
