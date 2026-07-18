const { STAGE_EVENTS } = require("./crm-lead-enrollment-conversion-audit.service.js");

class CrmLeadStageTransitionObservabilityDecorator {
  constructor({
    stageTransitionService,
    auditService,
    logger = null,
    now = () => Date.now(),
  } = {}) {
    this.stageTransitionService = stageTransitionService;
    this.auditService = auditService;
    this.logger = logger;
    this.now = typeof now === "function" ? now : () => Date.now();
  }

  async moveLeadToStage(input = {}, context = {}) {
    const startedAt = this.now();
    const base = {
      correlationId: context.correlationId,
      leadId: input.leadId,
      unitId: context.unitId,
      userId: context.userId,
      previousStage: input.expectedStage,
      previousStatus: input.expectedStatus,
      nextStage: input.nextStage,
      reasonProvided: Boolean(input.reason),
    };
    await this.safeAudit("recordStageStart", base);
    try {
      const result = await this.stageTransitionService.moveLeadToStage(input, context);
      await this.safeAudit("recordStageSuccess", {
        ...base,
        previousStage: result.previousStage,
        previousStatus: result.previousStatus,
        nextStage: result.nextStage || result.stage,
        nextStatus: result.nextStatus || result.status,
        durationMs: elapsed(this.now(), startedAt),
      });
      return result;
    } catch (error) {
      await this.safeAudit("recordStageFailure", {
        ...base,
        durationMs: elapsed(this.now(), startedAt),
        errorCode: error?.code,
        errorCategory: categorize(error?.code),
      });
      throw error;
    }
  }

  async safeAudit(method, payload) {
    try {
      if (typeof this.auditService?.[method] === "function") {
        await this.auditService[method](payload);
      }
    } catch (error) {
      this.logger?.warn?.("crm.stage_transition.audit_failed", {
        code: "CRM_AUDIT_ADAPTER_FAILED",
      });
    }
  }
}

function elapsed(now, startedAt) {
  const value = Number(now) - Number(startedAt);
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

function categorize(code) {
  if (code === "CRM_ACCESS_DENIED") return "AUTHORIZATION";
  if (code === "CRM_INPUT_INVALID" || code === "CRM_LOST_REASON_REQUIRED") return "VALIDATION";
  if (typeof code === "string" && code.includes("DATABASE")) return "INFRASTRUCTURE";
  return code ? "BUSINESS" : "UNKNOWN";
}

module.exports = { CrmLeadStageTransitionObservabilityDecorator, STAGE_EVENTS };
