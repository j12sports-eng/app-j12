const { reconstructLeadStageTiming } = require("../domain/crm-lead-stage-timing.js");
const { CrmLeadStageSlaPolicy } = require("../domain/crm-lead-stage-sla-policy.js");
const DEFAULT_HISTORY_LIMIT = 500;

class CrmLeadStageTimingQueryService {
  constructor({ repository = null, clock = null, slaPolicy = null, logger = null } = {}) {
    this.repository = repository;
    this.clock = clock || Object.freeze({ now: () => new Date() });
    this.slaPolicy = slaPolicy || new CrmLeadStageSlaPolicy();
    this.logger = logger || console;
  }

  async getLeadStageTiming({ leadId, unitId = null } = {}) {
    const normalizedLeadId = requiredId(leadId, "leadId");
    const normalizedUnitId = unitId == null ? null : requiredId(unitId, "unitId");
    let lead;
    let historyResult;
    try {
      lead = await this.getRepository().findLeadForStageTiming({
        leadId: normalizedLeadId,
        unitId: normalizedUnitId,
      });
      if (!lead) throw timingError("CRM Lead not found.", "CRM_LEAD_NOT_FOUND", 404);
      const unit = lead.unit_id ?? lead.unitId;
      historyResult = await this.getRepository().findStageHistoryByLeadId({
        leadId: normalizedLeadId,
        limit: DEFAULT_HISTORY_LIMIT,
        unitId: unit,
      });
    } catch (error) {
      if (error?.code === "CRM_LEAD_NOT_FOUND") throw error;
      this.log("warn", "CRM_STAGE_TIMING_QUERY_FAILED", { errorCode: "CRM_STAGE_TIMING_FAILED" });
      throw timingError("CRM stage timing query failed.", "CRM_STAGE_TIMING_FAILED", 500);
    }

    const history = Array.isArray(historyResult) ? historyResult : historyResult?.items;
    const timing = reconstructLeadStageTiming({
      currentStage: lead.stage,
      history,
      now: this.getClock().now(),
      truncated: Boolean(historyResult?.truncated),
    });
    const sla = this.slaPolicy.evaluate({
      elapsedMs: timing.currentStageElapsedMs,
      historyCoverage: timing.historyCoverage,
      stage: lead.stage,
    });
    const result = Object.freeze({
      currentStage: lead.stage,
      currentStageElapsedMs: timing.currentStageElapsedMs,
      currentStageEntryAt: timing.currentStageEntryAt,
      currentStatus: lead.status,
      historyCoverage: timing.historyCoverage,
      leadId: lead.id,
      measuredAt: timing.measuredAt,
      sla,
      stages: timing.stages,
      timeline: timing.timeline,
    });
    this.log("info", "CRM_STAGE_TIMING_QUERY_SUCCEEDED", {
      historyCoverage: result.historyCoverage,
      slaStatus: result.sla.status,
      stage: result.currentStage,
    });
    return result;
  }

  getRepository() {
    if (
      typeof this.repository?.findLeadForStageTiming !== "function" ||
      typeof this.repository?.findStageHistoryByLeadId !== "function"
    ) {
      throw new TypeError("CRM stage timing repository is required.");
    }
    return this.repository;
  }

  getClock() {
    if (typeof this.clock?.now !== "function") throw new TypeError("CRM timing clock is required.");
    return this.clock;
  }

  log(level, event, fields) {
    try {
      this.logger?.[level]?.(event, Object.freeze({ event, ...fields }));
    } catch {
      // Observability is fail-open and must never alter the read model.
    }
  }
}

function requiredId(value, field) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value.trim())) {
    throw inputError(field);
  }
  return value.trim();
}

function inputError(field) {
  return Object.assign(new TypeError("CRM stage timing input is invalid."), {
    code: "CRM_INPUT_INVALID",
    details: { field },
    expose: true,
    statusCode: 400,
  });
}

function timingError(message, code, statusCode) {
  return Object.assign(new Error(message), {
    code,
    details: null,
    expose: statusCode < 500,
    statusCode,
  });
}

module.exports = { CrmLeadStageTimingQueryService, requiredId };
