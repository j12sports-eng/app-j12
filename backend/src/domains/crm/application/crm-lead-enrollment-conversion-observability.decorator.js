const {
  categorizeErrorCode,
  fingerprintIdempotencyKey,
} = require("./crm-lead-enrollment-conversion-audit.service.js");

const DEFAULT_OPERATION = "crm.lead.enrollment_conversion";

/** Instruments the use case without changing its input, output or errors. */
class CrmLeadEnrollmentConversionObservabilityDecorator {
  constructor({
    conversionService,
    auditService,
    logger = null,
    now = defaultMonotonicClock,
  } = {}) {
    this.conversionService = conversionService;
    this.auditService = auditService;
    this.logger = logger;
    this.now = typeof now === "function" ? now : defaultMonotonicClock;
  }

  async convertLeadToDraftEnrollment(input = {}, context = {}) {
    const startedAt = this.now();
    const metadata = buildMetadata(input, context);
    await this.safeAudit("recordStart", metadata);

    try {
      const result = await this.getConversionService().convertLeadToDraftEnrollment(input, context);
      await this.safeAudit("recordSuccess", {
        ...metadata,
        durationMs: elapsedMilliseconds(startedAt, this.now()),
        enrollmentId: result?.enrollmentId,
        enrollmentResolution: result?.resolutions?.enrollment,
        enrollmentReused: result?.reused?.enrollment,
        enrollmentStatus: result?.enrollmentStatus,
        personId: result?.personId,
        personProfileId: result?.personProfileId,
        personResolution: result?.resolutions?.person,
        personReused: result?.reused?.person,
        profileResolution: result?.resolutions?.profile,
        profileReused: result?.reused?.profile,
      });
      return result;
    } catch (error) {
      await this.safeAudit("recordFailure", {
        ...metadata,
        durationMs: elapsedMilliseconds(startedAt, this.now()),
        errorCategory: categorizeErrorCode(error?.code),
        errorCode: error?.code,
      });
      throw error;
    }
  }

  getConversionService() {
    if (typeof this.conversionService?.convertLeadToDraftEnrollment !== "function") {
      throw new TypeError("CRM conversion observability requires conversionService.");
    }
    return this.conversionService;
  }

  async safeAudit(method, input) {
    try {
      await this.auditService?.[method]?.(input);
    } catch (error) {
      try {
        this.logger?.warn?.("crm.audit.decorator_failed", {
          code: "CRM_AUDIT_ADAPTER_FAILED",
          operation: DEFAULT_OPERATION,
        });
      } catch {
        // The audit path is fail-open by design.
      }
    }
  }
}

function buildMetadata(input = {}, context = {}) {
  const leadId = text(input.leadId);
  return {
    correlationId: text(context.correlationId),
    idempotencyKeyFingerprint: fingerprintIdempotencyKey(input.idempotencyKey, leadId),
    leadId,
    unitId: text(context.unitId),
    userId: text(context.userId),
  };
}

function elapsedMilliseconds(startedAt, endedAt) {
  let duration;
  if (typeof startedAt === "bigint" && typeof endedAt === "bigint") {
    duration = Number(endedAt - startedAt) / 1_000_000;
  } else {
    duration = Number(endedAt) - Number(startedAt);
  }
  return Number.isFinite(duration) && duration >= 0 ? Math.trunc(duration) : 0;
}

function defaultMonotonicClock() {
  return process.hrtime.bigint();
}

function text(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

module.exports = {
  CrmLeadEnrollmentConversionObservabilityDecorator,
  buildMetadata,
  elapsedMilliseconds,
};
