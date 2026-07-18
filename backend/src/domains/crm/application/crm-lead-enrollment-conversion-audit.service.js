const { createHash } = require("node:crypto");

const { logger: defaultLogger } = require("../../../observability/structured-logger.js");
const {
  CrmLeadEnrollmentConversionMetrics,
  METRIC_NAMES,
} = require("./crm-lead-enrollment-conversion-metrics.js");

const SOURCE = "INTERNAL_CRM";
const OPERATION_NAME = "crm.lead.enrollment_conversion";
const ROUTE = "/internal/crm/leads/:leadId/draft-enrollment";
const EVENTS = Object.freeze({
  STARTED: "CRM_LEAD_ENROLLMENT_CONVERSION_STARTED",
  SUCCEEDED: "CRM_LEAD_ENROLLMENT_CONVERSION_SUCCEEDED",
  FAILED: "CRM_LEAD_ENROLLMENT_CONVERSION_FAILED",
});
const EVENT_SET = new Set(Object.values(EVENTS));
const RESOLUTIONS = new Set(["CREATED", "FOUND"]);
const ERROR_CODES = new Set([
  "CRM_ACCESS_DENIED",
  "CRM_CONVERSION_DATA_INCOMPLETE",
  "CRM_INPUT_INVALID",
  "CRM_LEAD_ENROLLMENT_CONFLICT",
  "CRM_LEAD_ENROLLMENT_CONVERSION_FAILED",
  "CRM_LEAD_NOT_CONVERTIBLE",
  "CRM_LEAD_NOT_FOUND",
  "CRM_LEAD_UNIT_CONTEXT_FAILED",
  "DATABASE_UNAVAILABLE",
  "DATABASE_ERROR",
  "ENROLLMENT_ACTIVE_EXISTS",
  "ENROLLMENT_DATA_INCOMPLETE",
  "ENROLLMENT_DRAFT_CREATION_FAILED",
  "ENROLLMENT_RESOLUTION_FAILED",
  "ENROLLMENT_STATE_CONFLICT",
  "PERSON_IDENTITY_CONFLICT",
  "STUDENT_DATA_INCOMPLETE",
  "STUDENT_PROFILE_CONFLICT",
]);
const VALID_CATEGORIES = new Set([
  "VALIDATION",
  "AUTHORIZATION",
  "BUSINESS",
  "INFRASTRUCTURE",
  "UNKNOWN",
]);
const AUDIT_FIELDS = new Set([
  "eventType",
  "source",
  "operationName",
  "route",
  "leadId",
  "unitId",
  "userId",
  "personId",
  "personProfileId",
  "enrollmentId",
  "enrollmentStatus",
  "correlationId",
  "idempotencyKeyFingerprint",
  "personResolution",
  "profileResolution",
  "enrollmentResolution",
  "personReused",
  "profileReused",
  "enrollmentReused",
  "durationMs",
  "errorCode",
  "errorCategory",
  "createdAt",
  "version",
]);

class CrmLeadEnrollmentConversionAuditService {
  constructor({
    adapter = null,
    repository = null,
    logger = defaultLogger,
    metrics = null,
    now = () => new Date(),
  } = {}) {
    this.adapter = adapter || repository;
    this.logger = logger || defaultLogger;
    this.metrics = metrics || new CrmLeadEnrollmentConversionMetrics();
    this.now = typeof now === "function" ? now : () => new Date();
  }

  async recordStart(input = {}) {
    return this.record({ ...commonFields(input), eventType: EVENTS.STARTED });
  }

  async recordSuccess(input = {}) {
    return this.record({
      ...commonFields(input),
      enrollmentId: input.enrollmentId,
      enrollmentResolution: input.enrollmentResolution,
      enrollmentReused: input.enrollmentReused,
      enrollmentStatus: input.enrollmentStatus,
      eventType: EVENTS.SUCCEEDED,
      personId: input.personId,
      personProfileId: input.personProfileId,
      personResolution: input.personResolution,
      personReused: input.personReused,
      profileResolution: input.profileResolution,
      profileReused: input.profileReused,
    });
  }

  async recordFailure(input = {}) {
    const errorCode = sanitizeErrorCode(input.errorCode);
    return this.record({
      ...commonFields(input),
      errorCategory: sanitizeCategory(input.errorCategory || categorizeErrorCode(errorCode)),
      errorCode,
      eventType: EVENTS.FAILED,
    });
  }

  async record(event = {}) {
    let normalized;
    try {
      normalized = normalizeAuditEvent({
        ...event,
        createdAt: event.createdAt || timestamp(this.now()),
      });
    } catch (error) {
      this.secondaryWarning("crm.audit.rejected", error);
      return null;
    }

    this.observeMetrics(normalized);
    try {
      if (this.adapter) {
        if (typeof this.adapter.record === "function") await this.adapter.record(normalized);
        else if (typeof this.adapter.save === "function") await this.adapter.save(normalized);
        else throw new TypeError("CRM audit adapter requires record() or save().");
      } else {
        this.logEvent(normalized);
      }
    } catch (error) {
      this.secondaryWarning("crm.audit.adapter_failed", error);
    }
    return normalized;
  }

  logEvent(record) {
    const method = record.eventType === EVENTS.FAILED ? "warn" : "info";
    this.logger?.[method]?.(record.eventType, record);
  }

  observeMetrics(record) {
    try {
      const labels = { source: record.source };
      if (record.eventType === EVENTS.STARTED) {
        this.metrics?.increment(METRIC_NAMES.ATTEMPTS, labels);
      } else if (record.eventType === EVENTS.SUCCEEDED) {
        this.metrics?.increment(METRIC_NAMES.SUCCESS, {
          ...labels,
          result: "success",
        });
        this.metrics?.observe(METRIC_NAMES.DURATION, record.durationMs, labels);
        if (record.enrollmentReused || record.personReused || record.profileReused) {
          this.metrics?.increment(METRIC_NAMES.REUSED, {
            ...labels,
            enrollmentResolution: record.enrollmentResolution,
          });
        }
      } else if (record.eventType === EVENTS.FAILED) {
        this.metrics?.increment(METRIC_NAMES.FAILURE, {
          ...labels,
          errorCode: record.errorCode,
        });
        this.metrics?.observe(METRIC_NAMES.DURATION, record.durationMs, labels);
      }
    } catch (error) {
      this.secondaryWarning("crm.metrics.adapter_failed", error);
    }
  }

  secondaryWarning(event, error) {
    try {
      this.logger?.warn?.(event, { code: "CRM_AUDIT_ADAPTER_FAILED" });
    } catch {
      // Observability is deliberately fail-open.
    }
  }
}

function commonFields(input = {}) {
  return {
    correlationId: input.correlationId,
    createdAt: input.createdAt,
    durationMs: input.durationMs,
    idempotencyKeyFingerprint: input.idempotencyKeyFingerprint,
    leadId: input.leadId,
    operationName: OPERATION_NAME,
    route: ROUTE,
    unitId: input.unitId,
    userId: input.userId,
    version: "1",
  };
}

function normalizeAuditEvent(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const unknownFields = Object.keys(source).filter((key) => !AUDIT_FIELDS.has(key));
  if (unknownFields.length) {
    throw Object.assign(new TypeError("CRM audit field is not allowed."), {
      code: "CRM_AUDIT_FIELD_NOT_ALLOWED",
    });
  }
  const eventType = String(source.eventType || "").trim();
  if (!EVENT_SET.has(eventType)) throw new TypeError("CRM audit event is not allowed.");

  const result = {
    eventType,
    source: SOURCE,
    operationName: OPERATION_NAME,
    route: ROUTE,
    version: "1",
  };
  for (const key of [
    "leadId",
    "unitId",
    "userId",
    "personId",
    "personProfileId",
    "enrollmentId",
    "correlationId",
    "idempotencyKeyFingerprint",
    "createdAt",
  ]) {
    const value = normalizeText(source[key], key === "correlationId" ? 128 : 191);
    if (value) result[key] = value;
  }
  if (source.enrollmentStatus === "DRAFT") result.enrollmentStatus = "DRAFT";
  for (const [key, value] of [
    ["personResolution", source.personResolution],
    ["profileResolution", source.profileResolution],
    ["enrollmentResolution", source.enrollmentResolution],
  ]) {
    if (RESOLUTIONS.has(value)) result[key] = value;
  }
  for (const key of ["personReused", "profileReused", "enrollmentReused"]) {
    if (typeof source[key] === "boolean") result[key] = source[key];
  }
  if (source.durationMs !== undefined) result.durationMs = normalizeDuration(source.durationMs);
  if (eventType === EVENTS.FAILED) {
    result.errorCode = sanitizeErrorCode(source.errorCode);
    result.errorCategory = sanitizeCategory(source.errorCategory);
  }
  return Object.freeze(result);
}

function timestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeText(value, maxLength) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizeDuration(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function sanitizeErrorCode(value) {
  const code = String(value || "")
    .trim()
    .toUpperCase();
  return ERROR_CODES.has(code) ? code : "UNKNOWN";
}

function sanitizeCategory(value) {
  const category = String(value || "")
    .trim()
    .toUpperCase();
  return VALID_CATEGORIES.has(category) ? category : "UNKNOWN";
}

function categorizeErrorCode(code) {
  if (code === "CRM_ACCESS_DENIED") return "AUTHORIZATION";
  if (code === "DATABASE_UNAVAILABLE" || code.includes("DATABASE") || code.includes("FAILED")) {
    return "INFRASTRUCTURE";
  }
  if (code.includes("INPUT") || code.includes("INCOMPLETE")) return "VALIDATION";
  if (code === "UNKNOWN") return "UNKNOWN";
  return "BUSINESS";
}

function fingerprintIdempotencyKey(value, leadId = "") {
  const key = String(value ?? "").trim();
  if (!key) return null;
  return createHash("sha256")
    .update(`${String(leadId)}:${key}`)
    .digest("hex");
}

module.exports = {
  AUDIT_FIELDS,
  CrmLeadEnrollmentConversionAuditService,
  EVENTS,
  OPERATION_NAME,
  ROUTE,
  categorizeErrorCode,
  fingerprintIdempotencyKey,
  normalizeAuditEvent,
  sanitizeCategory,
  sanitizeErrorCode,
};
