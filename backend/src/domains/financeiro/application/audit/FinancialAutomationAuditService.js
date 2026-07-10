const { AutomationAuditRecord } = require("./AutomationAuditRecord.js");

class FinancialAutomationAuditService {
  constructor(options = {}) {
    this.repository = options.repository || options.auditRepository || null;
    this.now = typeof options.now === "function" ? options.now : () => new Date();
  }

  async startExecution(input = {}) {
    const context = readContext(input.context);
    const record = new AutomationAuditRecord({
      actor: context.actor,
      correlationId: context.correlationId,
      executionId: context.executionId,
      metadata: input.metadata ?? context.metadata,
      mode: input.mode,
      startedAt: input.startedAt ?? context.timestamps?.startedAt ?? context.timestamps?.requestedAt ?? this.timestamp(),
      workflow: context.workflow,
    });
    return this.getRepositoryMethod("save")(record);
  }

  async finishExecution(input = {}) {
    return this.finish(input, true);
  }

  async failExecution(input = {}) {
    return this.finish(input, false);
  }

  async recordWarning(input = {}) {
    const record = await this.requireRecord(input);
    return this.getRepositoryMethod("save")(record.addWarning(input.warning, input.metadata));
  }

  async getByCorrelationId(correlationId) {
    return this.getRepositoryMethod("findByCorrelationId")(correlationId);
  }

  async finish(input, success) {
    const context = readContext(input.context);
    const record = await this.requireRecord({ correlationId: context.correlationId });
    const finished = record.finish({
      errors: input.errors,
      executionId: input.executionId ?? context.executionId,
      finishedAt: input.finishedAt ?? context.timestamps?.completedAt ?? this.timestamp(),
      metadata: input.metadata,
      success,
      warnings: input.warnings,
    });
    return this.getRepositoryMethod("save")(finished);
  }

  async requireRecord(input = {}) {
    const correlationId = input.correlationId || input.context?.correlationId;
    const record = await this.getRepositoryMethod("findByCorrelationId")(correlationId);
    if (!record) {
      const error = new Error("Automation audit record was not started.");
      error.code = "AUTOMATION_AUDIT_RECORD_NOT_FOUND";
      error.details = { correlationId: correlationId || null };
      throw error;
    }
    return record;
  }

  getRepositoryMethod(method) {
    const implementation = this.repository?.[method];
    if (typeof implementation !== "function") {
      const error = new TypeError(`FinancialAutomationAuditService requires repository.${method}.`);
      error.code = "AUTOMATION_AUDIT_REPOSITORY_INVALID";
      error.details = { method };
      throw error;
    }
    return implementation.bind(this.repository);
  }

  timestamp() {
    const value = this.now();
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      const error = new TypeError("Automation audit clock returned an invalid timestamp.");
      error.code = "AUTOMATION_AUDIT_CLOCK_INVALID";
      throw error;
    }
    return parsed.toISOString();
  }
}

function readContext(value) {
  if (!value || typeof value !== "object") {
    const error = new TypeError("FinancialAutomationAuditService requires execution context.");
    error.code = "AUTOMATION_AUDIT_CONTEXT_REQUIRED";
    throw error;
  }
  return value;
}

module.exports = { FinancialAutomationAuditService };
