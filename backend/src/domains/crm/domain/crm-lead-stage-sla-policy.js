const { HISTORY_COVERAGE, KNOWN_STAGES, TERMINAL_STAGES } = require("./crm-lead-stage-timing.js");

const SLA_STATUS = Object.freeze({
  COMPLETED: "COMPLETED",
  DUE_SOON: "DUE_SOON",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  ON_TRACK: "ON_TRACK",
  OVERDUE: "OVERDUE",
  UNAVAILABLE: "UNAVAILABLE",
});
const DEFAULT_DUE_SOON_RATIO = 0.8;

class CrmLeadStageSlaPolicy {
  constructor({ limitsMs = {}, dueSoonRatio = DEFAULT_DUE_SOON_RATIO } = {}) {
    if (!Number.isFinite(dueSoonRatio) || dueSoonRatio <= 0 || dueSoonRatio >= 1) {
      throw configurationError("dueSoonRatio");
    }
    this.dueSoonRatio = dueSoonRatio;
    this.limitsMs = Object.freeze(validateLimits(limitsMs));
  }

  getLimitMs(stage) {
    return this.limitsMs[stage] ?? null;
  }

  evaluate({ stage, elapsedMs, historyCoverage } = {}) {
    const elapsed = finiteNonNegative(elapsedMs);
    if (!KNOWN_STAGES.has(stage)) return result(SLA_STATUS.UNAVAILABLE, null, elapsed);
    if (TERMINAL_STAGES.has(stage)) return result(SLA_STATUS.COMPLETED, null, elapsed);
    if (historyCoverage === HISTORY_COVERAGE.UNAVAILABLE || elapsed == null) {
      return result(SLA_STATUS.UNAVAILABLE, this.getLimitMs(stage), null);
    }

    const limit = this.getLimitMs(stage);
    if (limit == null) return result(SLA_STATUS.NOT_CONFIGURED, null, elapsed);
    const overdueMs = Math.max(0, elapsed - limit);
    const remainingMs = Math.max(0, limit - elapsed);
    const consumedPercentage = Math.min(100, Math.max(0, (elapsed / limit) * 100));
    const status =
      elapsed > limit
        ? SLA_STATUS.OVERDUE
        : elapsed >= limit * this.dueSoonRatio
          ? SLA_STATUS.DUE_SOON
          : SLA_STATUS.ON_TRACK;
    return Object.freeze({
      consumedPercentage,
      elapsedMs: elapsed,
      limitMs: limit,
      overdueMs,
      remainingMs,
      status,
    });
  }
}

function validateLimits(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw configurationError("limitsMs");
  }
  const limits = {};
  for (const [stage, value] of Object.entries(source)) {
    if (!KNOWN_STAGES.has(stage) || !Number.isSafeInteger(value) || value <= 0) {
      throw configurationError(stage);
    }
    limits[stage] = value;
  }
  return limits;
}

function result(status, limitMs, elapsedMs) {
  return Object.freeze({
    consumedPercentage: null,
    elapsedMs,
    limitMs,
    overdueMs: 0,
    remainingMs: limitMs,
    status,
  });
}

function finiteNonNegative(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.max(0, Number(value));
}

function configurationError(field) {
  return Object.assign(new TypeError("CRM SLA configuration is invalid."), {
    code: "CRM_SLA_CONFIGURATION_INVALID",
    details: { field },
  });
}

module.exports = {
  CrmLeadStageSlaPolicy,
  DEFAULT_DUE_SOON_RATIO,
  SLA_STATUS,
};
