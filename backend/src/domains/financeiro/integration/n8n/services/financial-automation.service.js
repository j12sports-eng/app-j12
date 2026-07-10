const { randomUUID } = require("node:crypto");

const FINANCIAL_N8N_INTEGRATION_INVALID_CODE = "FINANCIAL_N8N_INTEGRATION_INVALID";
const FINANCIAL_N8N_OPERATION_FAILED_CODE = "FINANCIAL_N8N_OPERATION_FAILED";

class FinancialAutomationService {
  constructor(options = {}) {
    this.integration = options.integration || options.n8nIntegration || null;
    this.logger = normalizeLogger(options.logger);
    this.createCorrelationId =
      typeof options.createCorrelationId === "function"
        ? options.createCorrelationId
        : () => `fauto-${randomUUID()}`;
  }

  preparePayload(input = {}) {
    const correlationId = nullableText(input.correlationId, 191) || this.createCorrelationId();
    const workflowKey = nullableText(input.workflowKey, 120);
    const validatePayload = this.getIntegrationMethod("validatePayload");
    const validated = validatePayload({
      correlationId,
      data: input.data === undefined ? {} : input.data,
      metadata: input.metadata === undefined ? {} : input.metadata,
      workflowKey,
    });

    return validatePayload({
      ...validated,
      metadata: {
        ...validated.metadata,
        source: "financial-automation-service",
      },
    });
  }

  async startWorkflow(input = {}) {
    const payload = this.preparePayload(input);
    this.log("info", "financial.n8n.start.requested", payload);

    try {
      const result = await this.getIntegrationMethod("startWorkflow")(payload);
      this.log("info", "financial.n8n.start.completed", payload, result);
      return result;
    } catch (error) {
      this.log("error", "financial.n8n.start.failed", payload, null, error);
      throw operationError("startWorkflow", error, payload.correlationId);
    }
  }

  async getExecutionStatus(input = {}) {
    const executionId = nullableText(input.executionId, 191);
    const correlationId = nullableText(input.correlationId, 191) || null;
    this.log("info", "financial.n8n.status.requested", { correlationId }, { executionId });

    try {
      const result = await this.getIntegrationMethod("getExecutionStatus")({ executionId });
      this.log("info", "financial.n8n.status.completed", { correlationId }, result);
      return result;
    } catch (error) {
      this.log("error", "financial.n8n.status.failed", { correlationId }, null, error);
      throw operationError("getExecutionStatus", error, correlationId);
    }
  }

  async cancelExecution(input = {}) {
    const executionId = nullableText(input.executionId, 191);
    const reason = nullableText(input.reason, 500);
    const correlationId = nullableText(input.correlationId, 191) || null;
    this.log("info", "financial.n8n.cancel.requested", { correlationId }, { executionId });

    try {
      const result = await this.getIntegrationMethod("cancelExecution")({ executionId, reason });
      this.log("info", "financial.n8n.cancel.completed", { correlationId }, result);
      return result;
    } catch (error) {
      this.log("error", "financial.n8n.cancel.failed", { correlationId }, null, error);
      throw operationError("cancelExecution", error, correlationId);
    }
  }

  getIntegrationMethod(method) {
    const implementation = this.integration?.[method];
    if (typeof implementation !== "function") {
      const error = new TypeError(`FinancialAutomationService requires integration.${method}.`);
      error.code = FINANCIAL_N8N_INTEGRATION_INVALID_CODE;
      error.details = { method };
      throw error;
    }
    return implementation.bind(this.integration);
  }

  log(level, event, payload = {}, result = null, error = null) {
    this.logger[level]({
      correlationId: payload.correlationId || null,
      errorCode: error?.code || null,
      event,
      executionId: nullableText(result?.executionId, 191),
      workflowKey: payload.workflowKey || null,
    });
  }
}

function operationError(operation, cause, correlationId) {
  const error = new Error(`Controlled n8n integration operation failed: ${operation}.`);
  error.code = FINANCIAL_N8N_OPERATION_FAILED_CODE;
  error.cause = cause;
  error.details = {
    correlationId: correlationId || null,
    integrationCode: cause?.code || null,
    operation,
  };
  return error;
}

function normalizeLogger(logger) {
  const source = logger && typeof logger === "object" ? logger : {};
  return {
    error: typeof source.error === "function" ? source.error.bind(source) : () => {},
    info: typeof source.info === "function" ? source.info.bind(source) : () => {},
  };
}

function nullableText(value, maxLength) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

module.exports = {
  FINANCIAL_N8N_INTEGRATION_INVALID_CODE,
  FINANCIAL_N8N_OPERATION_FAILED_CODE,
  FinancialAutomationService,
};
