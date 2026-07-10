const { randomUUID } = require("node:crypto");

const { AutomationError, AutomationErrorCategory } = require("./AutomationError.js");
const { AutomationExecutionContext } = require("./AutomationExecutionContext.js");
const { AutomationExecutionResult } = require("./AutomationExecutionResult.js");

const FinancialAutomationRequestType = Object.freeze({
  DAILY_COLLECTION: "DAILY_COLLECTION",
  DUE_DATE_COLLECTION: "DUE_DATE_COLLECTION",
  PAYMENT_SETTLEMENT: "PAYMENT_SETTLEMENT",
  REMINDER: "REMINDER",
  REPROCESS_FAILURES: "REPROCESS_FAILURES",
});

const DEFAULT_WORKFLOW_MAP = Object.freeze({
  [FinancialAutomationRequestType.DAILY_COLLECTION]: "financeiro-cobranca-diaria",
  [FinancialAutomationRequestType.DUE_DATE_COLLECTION]: "financeiro-cobranca-vencimento",
  [FinancialAutomationRequestType.PAYMENT_SETTLEMENT]: "financeiro-baixa-pagamento",
  [FinancialAutomationRequestType.REMINDER]: "financeiro-lembretes",
  [FinancialAutomationRequestType.REPROCESS_FAILURES]: "financeiro-reprocessar-falhas",
});

class FinancialAutomationOrchestrator {
  constructor(options = {}) {
    this.financialAutomationService = options.financialAutomationService || null;
    this.auditService = options.auditService || null;
    this.audit = options.audit || null;
    this.workflowMap = Object.freeze({ ...DEFAULT_WORKFLOW_MAP, ...(options.workflowMap || {}) });
    this.now = typeof options.now === "function" ? options.now : () => new Date();
    this.createCorrelationId =
      typeof options.createCorrelationId === "function"
        ? options.createCorrelationId
        : () => `forch-${randomUUID()}`;
    this.timeoutMs = normalizeTimeout(options.timeoutMs);
  }

  selectWorkflow(requestType) {
    const normalized = normalizeRequestType(requestType);
    const workflow = this.workflowMap[normalized];
    if (!workflow) {
      throw new AutomationError("Financial automation request type is not mapped.", {
        category: AutomationErrorCategory.VALIDATION,
        code: "AUTOMATION_WORKFLOW_NOT_MAPPED",
        details: { requestType: normalized || String(requestType || "") },
      });
    }
    return workflow;
  }

  buildPayload(input, context, requestType) {
    const payload = input.payload === undefined ? {} : input.payload;
    if (!isPlainObject(payload)) {
      throw new AutomationError("Financial automation payload must be an object.", {
        category: AutomationErrorCategory.VALIDATION,
        code: "AUTOMATION_PAYLOAD_INVALID",
        details: { requestType },
      });
    }

    return {
      correlationId: context.correlationId,
      data: {
        payload,
        requestType,
      },
      metadata: {
        ...context.metadata,
        actorId: context.actor.id,
        actorType: context.actor.type,
      },
      workflowKey: context.workflow,
    };
  }

  async execute(input = {}) {
    let context = null;
    let requestType = null;
    let workflow = null;
    const warnings = [];

    try {
      requestType = normalizeRequestType(input.requestType);
      workflow = this.selectWorkflow(requestType);
      const requestedAt = this.timestamp();
      context = new AutomationExecutionContext({
        actor: input.actor,
        correlationId: normalizeText(input.correlationId, 191) || this.createCorrelationId(),
        metadata: input.metadata,
        timestamps: { requestedAt },
        workflow,
      });
      const payload = this.buildPayload(input, context, requestType);

      await this.startAudit({
        context,
        mode: resolveMode(input),
        requestType,
      });

      context = context.withExecution({ startedAt: this.timestamp() });
      const serviceResult = await withTimeout(
        this.getServiceMethod("startWorkflow")(payload),
        this.timeoutMs,
      );
      context = context.withExecution({
        completedAt: this.timestamp(),
        executionId: normalizeText(serviceResult?.executionId, 191),
      });
      warnings.push(...normalizeWarnings(serviceResult?.warnings));

      const audited = await this.tryFinishAudit({
        context,
        mode: resolveMode(input),
        requestType,
        status: serviceResult?.status || "STARTED",
        warnings,
      });
      if (!audited) warnings.push("AUTOMATION_AUDIT_COMPLETION_FAILED");

      return AutomationExecutionResult.succeeded({
        executionId: context.executionId,
        metadata: resultMetadata(context, requestType),
        status: normalizeText(serviceResult?.status, 80) || "STARTED",
        warnings,
        workflow,
      });
    } catch (cause) {
      const error = AutomationError.from(cause, {
        details: { requestType, workflow },
      });
      if (context) {
        const audited = await this.tryFailAudit({
          context: context.withExecution({ completedAt: this.timestamp() }),
          error,
          mode: resolveMode(input),
          requestType,
          status: "FAILED",
          warnings,
        });
        if (!audited) warnings.push("AUTOMATION_AUDIT_FAILURE_FAILED");
      }

      return AutomationExecutionResult.failed({
        errors: [error],
        executionId: context?.executionId || null,
        metadata: context ? resultMetadata(context, requestType) : { requestType },
        status: error.category === AutomationErrorCategory.TIMEOUT ? "TIMEOUT" : "FAILED",
        warnings,
        workflow,
      });
    }
  }

  async startAudit(entry) {
    const startExecution = this.auditService?.startExecution;
    if (typeof startExecution === "function") {
      try {
        return await startExecution.call(this.auditService, {
          context: entry.context,
          metadata: { requestType: entry.requestType },
          mode: entry.mode,
        });
      } catch (cause) {
        throw auditWriteError(cause);
      }
    }
    return this.requireAudit({
      context: entry.context,
      event: "financial.automation.requested",
      requestType: entry.requestType,
      status: "REQUESTED",
    });
  }

  async tryFinishAudit(entry) {
    const finishExecution = this.auditService?.finishExecution;
    if (typeof finishExecution === "function") {
      try {
        await finishExecution.call(this.auditService, {
          context: entry.context,
          metadata: { requestType: entry.requestType, status: entry.status },
          warnings: entry.warnings,
        });
        return true;
      } catch {
        return false;
      }
    }
    return this.tryAudit({
      context: entry.context,
      event: "financial.automation.started",
      requestType: entry.requestType,
      status: entry.status,
    });
  }

  async tryFailAudit(entry) {
    const failExecution = this.auditService?.failExecution;
    if (typeof failExecution === "function") {
      try {
        await failExecution.call(this.auditService, {
          context: entry.context,
          errors: [entry.error],
          metadata: { requestType: entry.requestType, status: entry.status },
          warnings: entry.warnings,
        });
        return true;
      } catch {
        return false;
      }
    }
    return this.tryAudit({
      context: entry.context,
      error: entry.error,
      event: "financial.automation.failed",
      requestType: entry.requestType,
      status: entry.status,
    });
  }

  getServiceMethod(method) {
    const implementation = this.financialAutomationService?.[method];
    if (typeof implementation !== "function") {
      throw new AutomationError(`Financial automation service must implement ${method}.`, {
        category: AutomationErrorCategory.INFRASTRUCTURE,
        code: "AUTOMATION_SERVICE_INVALID",
        details: { operation: method },
      });
    }
    return implementation.bind(this.financialAutomationService);
  }

  async requireAudit(entry) {
    const record = this.audit?.record;
    if (typeof record !== "function") {
      throw new AutomationError("Financial automation audit must implement record.", {
        category: AutomationErrorCategory.INFRASTRUCTURE,
        code: "AUTOMATION_AUDIT_INVALID",
      });
    }
    try {
      await record.call(this.audit, auditEntry(entry, this.timestamp()));
    } catch (cause) {
      throw new AutomationError("Financial automation request audit failed.", {
        category: AutomationErrorCategory.INFRASTRUCTURE,
        cause,
        code: "AUTOMATION_AUDIT_WRITE_FAILED",
      });
    }
  }

  async tryAudit(entry) {
    try {
      await this.requireAudit(entry);
      return true;
    } catch {
      return false;
    }
  }

  timestamp() {
    const value = this.now();
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new AutomationError("Financial automation clock returned an invalid timestamp.", {
        category: AutomationErrorCategory.INFRASTRUCTURE,
        code: "AUTOMATION_CLOCK_INVALID",
      });
    }
    return date.toISOString();
  }
}

function auditWriteError(cause) {
  return new AutomationError("Financial automation request audit failed.", {
    category: AutomationErrorCategory.INFRASTRUCTURE,
    cause,
    code: "AUTOMATION_AUDIT_WRITE_FAILED",
  });
}

function auditEntry(input, timestamp) {
  return {
    actor: input.context.actor,
    correlationId: input.context.correlationId,
    errorCategory: input.error?.category || null,
    errorCode: input.error?.code || null,
    event: input.event,
    executionId: input.context.executionId,
    requestType: input.requestType,
    status: input.status,
    timestamp,
    workflow: input.context.workflow,
  };
}

function resultMetadata(context, requestType) {
  return {
    actor: context.actor,
    correlationId: context.correlationId,
    requestType,
    timestamps: context.timestamps,
  };
}

function resolveMode(input = {}) {
  const mode = normalizeText(input.mode ?? input.metadata?.mode, 30)?.toLowerCase();
  return ["disabled", "dry_run", "hml"].includes(mode) ? mode : "disabled";
}

function normalizeWarnings(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeText(value, 500))
    .filter(Boolean);
}

function withTimeout(promise, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error("Financial automation orchestration timed out.");
      error.code = "ETIMEDOUT";
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timeoutId));
}

function normalizeRequestType(value) {
  return normalizeText(value, 80)?.toUpperCase() || null;
}

function normalizeTimeout(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 120000 ? parsed : 10000;
}

function normalizeText(value, maxLength) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

module.exports = {
  DEFAULT_WORKFLOW_MAP,
  FinancialAutomationOrchestrator,
  FinancialAutomationRequestType,
};
