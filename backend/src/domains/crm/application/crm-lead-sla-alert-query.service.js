const { logger: defaultLogger } = require("../../../observability/structured-logger.js");
const {
  ALERT_PRIORITY,
  CRM_LEAD_SLA_ALERT_STATUS,
  CrmLeadSlaAlertClassifier,
} = require("../domain/crm-lead-sla-alert-classifier.js");
const { HISTORY_COVERAGE, KNOWN_STAGES, utcIso } = require("../domain/crm-lead-stage-timing.js");
const { SLA_STATUS } = require("../domain/crm-lead-stage-sla-policy.js");
const { decodeCursor: decodeLeadCursor } = require("./crm-lead-query.service.js");
const { CrmLeadSlaAlertMetrics, METRIC_NAMES } = require("./crm-lead-sla-alert-metrics.js");

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_CURSOR_LENGTH = 1024;
const CURSOR_VERSION = 1;
const SOURCE = "INTERNAL_CRM";
const ALLOWED_FILTERS = new Set(["cursor", "limit", "slaStatus", "stage", "unitId"]);
const ALERT_STATUSES = new Set(Object.values(CRM_LEAD_SLA_ALERT_STATUS));
const DEFAULT_VISIBLE_STATUSES = new Set([
  CRM_LEAD_SLA_ALERT_STATUS.OVERDUE,
  CRM_LEAD_SLA_ALERT_STATUS.WARNING,
  CRM_LEAD_SLA_ALERT_STATUS.UNAVAILABLE,
  CRM_LEAD_SLA_ALERT_STATUS.NOT_CONFIGURED,
]);

class CrmLeadSlaAlertQueryService {
  constructor({
    leadQueryService = null,
    classifier = null,
    logger = defaultLogger,
    metrics = null,
    monotonicClock = defaultMonotonicClock,
  } = {}) {
    this.leadQueryService = leadQueryService;
    this.classifier = classifier || new CrmLeadSlaAlertClassifier();
    this.logger = logger || defaultLogger;
    this.metrics = metrics || new CrmLeadSlaAlertMetrics();
    this.monotonicClock =
      typeof monotonicClock === "function" ? monotonicClock : defaultMonotonicClock;
  }

  async listSlaAlerts(filters = {}, context = {}) {
    const startedAt = this.monotonicClock();
    let normalized = null;
    this.safeMetric("increment", METRIC_NAMES.ATTEMPTS, {
      result: "ATTEMPTED",
      source: SOURCE,
    });

    try {
      normalized = normalizeFilters(filters);
      const cursor = normalized.cursor
        ? decodeAlertCursor(normalized.cursor, normalized)
        : Object.freeze({ sourceCursor: null });
      const sourcePage = await this.getLeadQueryService().listLeads({
        cursor: cursor.sourceCursor,
        limit: normalized.limit,
        stage: normalized.stage,
        unitId: normalized.unitId,
      });
      const sourceItems = Array.isArray(sourcePage?.items) ? sourcePage.items : [];
      const items = sourceItems
        .map((item) => toAlertItem(item, this.classifier))
        .filter((item) => matchesAlertFilter(item, normalized.slaStatus))
        .sort(compareAlerts);
      const hasMore = Boolean(sourcePage?.pageInfo?.hasNextPage);
      const sourceNextCursor = hasMore ? sourcePage?.pageInfo?.nextCursor : null;
      if (hasMore) validateSourceCursor(sourceNextCursor);
      const nextCursor = hasMore
        ? encodeAlertCursor({
            filters: normalized,
            sourceCursor: sourceNextCursor,
          })
        : null;
      const result = Object.freeze({
        appliedFilters: Object.freeze({
          limit: normalized.limit,
          slaStatus: normalized.slaStatus,
          stage: normalized.stage,
          unitId: normalized.unitId,
        }),
        hasMore,
        items: Object.freeze(items),
        nextCursor,
        summary: Object.freeze({ pageCounts: countPage(items) }),
      });
      const durationMs = elapsedMilliseconds(startedAt, this.monotonicClock());
      this.recordSuccess(result, normalized, context, durationMs);
      return result;
    } catch (error) {
      const publicError = isInputError(error) ? error : slaAlertQueryError();
      const durationMs = elapsedMilliseconds(startedAt, this.monotonicClock());
      this.recordFailure(publicError, normalized, context, durationMs);
      throw publicError;
    }
  }

  getLeadQueryService() {
    if (typeof this.leadQueryService?.listLeads !== "function") {
      throw new TypeError("CRM SLA alert query requires leadQueryService.");
    }
    return this.leadQueryService;
  }

  recordSuccess(result, filters, context, durationMs) {
    this.safeLog("info", "CRM_SLA_ALERT_QUERY_SUCCEEDED", {
      correlationId: safeContextId(context?.correlationId, 128),
      durationMs,
      filtersAppliedCount: filtersAppliedCount(filters),
      itemCount: result.items.length,
      result: "SUCCEEDED",
      source: SOURCE,
      userId: safeContextId(context?.userId, 64),
    });
    this.safeMetric("increment", METRIC_NAMES.SUCCESS, {
      result: "SUCCEEDED",
      source: SOURCE,
    });
    this.safeMetric(
      "observe",
      METRIC_NAMES.DURATION,
      { result: "SUCCEEDED", source: SOURCE },
      durationMs,
    );
    const groups = new Map();
    for (const item of result.items) {
      const key = `${item.alertStatus}:${item.stage}`;
      groups.set(key, { item, count: (groups.get(key)?.count || 0) + 1 });
    }
    for (const { item, count } of groups.values()) {
      this.safeMetric(
        "increment",
        METRIC_NAMES.ITEMS,
        { alertStatus: item.alertStatus, source: SOURCE, stage: item.stage },
        count,
      );
    }
  }

  recordFailure(error, filters, context, durationMs) {
    this.safeLog("warn", "CRM_SLA_ALERT_QUERY_FAILED", {
      correlationId: safeContextId(context?.correlationId, 128),
      durationMs,
      errorCode: error?.code || "CRM_SLA_ALERT_QUERY_FAILED",
      filtersAppliedCount: filters ? filtersAppliedCount(filters) : 0,
      itemCount: 0,
      result: "FAILED",
      source: SOURCE,
      userId: safeContextId(context?.userId, 64),
    });
    this.safeMetric("increment", METRIC_NAMES.FAILURE, {
      result: "FAILED",
      source: SOURCE,
    });
    this.safeMetric(
      "observe",
      METRIC_NAMES.DURATION,
      { result: "FAILED", source: SOURCE },
      durationMs,
    );
  }

  safeLog(level, event, fields) {
    try {
      this.logger?.[level]?.(event, Object.freeze({ event, ...fields }));
    } catch {
      // Query observability is fail-open.
    }
  }

  safeMetric(method, name, labels, value = undefined) {
    try {
      if (method === "increment") this.metrics?.increment?.(name, labels, value ?? 1);
      else this.metrics?.observe?.(name, value, labels);
    } catch {
      // Metrics are fail-open and never alter the read model.
    }
  }
}

function normalizeFilters(filters = {}) {
  assertPlainObject(filters);
  const unknown = Object.keys(filters).filter((key) => !ALLOWED_FILTERS.has(key));
  if (unknown.length) throw inputError(unknown[0]);
  return Object.freeze({
    cursor: filters.cursor == null ? null : parseCursor(filters.cursor),
    limit: parseLimit(filters.limit),
    slaStatus: optionalEnum(filters.slaStatus, ALERT_STATUSES, "slaStatus"),
    stage: optionalEnum(filters.stage, KNOWN_STAGES, "stage"),
    unitId: filters.unitId == null ? null : requiredId(filters.unitId, "unitId"),
  });
}

function parseLimit(value) {
  if (value == null) return DEFAULT_LIMIT;
  if (Array.isArray(value) || !/^\d+$/.test(String(value))) throw inputError("limit");
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw inputError("limit");
  return limit;
}

function parseCursor(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > MAX_CURSOR_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw cursorError();
  }
  return value;
}

function encodeAlertCursor({ sourceCursor, filters }) {
  validateSourceCursor(sourceCursor);
  return Buffer.from(
    JSON.stringify({
      filters: {
        slaStatus: filters.slaStatus,
        stage: filters.stage,
        unitId: filters.unitId,
      },
      sourceCursor,
      v: CURSOR_VERSION,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeAlertCursor(value, filters) {
  const encoded = parseCursor(value);
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw cursorError();
  }
  if (!isExactObject(decoded, ["filters", "sourceCursor", "v"]) || decoded.v !== CURSOR_VERSION) {
    throw cursorError();
  }
  if (!isExactObject(decoded.filters, ["slaStatus", "stage", "unitId"])) throw cursorError();
  const cursorFilters = decoded.filters;
  if (
    cursorFilters.stage !== filters.stage ||
    cursorFilters.slaStatus !== filters.slaStatus ||
    cursorFilters.unitId !== filters.unitId
  ) {
    throw cursorError();
  }
  validateSourceCursor(decoded.sourceCursor);
  return Object.freeze({ sourceCursor: decoded.sourceCursor });
}

function validateSourceCursor(value) {
  if (typeof value !== "string" || !value) throw cursorError();
  try {
    decodeLeadCursor(value);
  } catch {
    throw cursorError();
  }
  return value;
}

function toAlertItem(item, classifier) {
  if (!item || typeof item !== "object" || Array.isArray(item))
    throw new TypeError("Invalid Lead.");
  const timing = item.stageTiming;
  const sla = timing?.sla;
  const alertStatus = classifier?.classify?.(sla?.status);
  if (!alertStatus || !ALERT_STATUSES.has(alertStatus)) {
    throw new TypeError("CRM SLA classification is unavailable.");
  }
  const leadId = requiredInternalId(item.id);
  const unitId = requiredInternalId(item.unitId);
  if (!KNOWN_STAGES.has(item.stage)) throw new TypeError("CRM Lead stage is invalid.");
  if (!Object.values(HISTORY_COVERAGE).includes(timing?.historyCoverage)) {
    throw new TypeError("CRM timing coverage is invalid.");
  }
  if (!Object.values(SLA_STATUS).includes(sla.status))
    throw new TypeError("CRM SLA status is invalid.");
  return Object.freeze({
    alertStatus,
    currentStageElapsedMs: optionalNonNegativeNumber(timing.currentStageElapsedMs),
    currentStageEntryAt: optionalIso(timing.currentStageEntryAt),
    historyCoverage: timing.historyCoverage,
    leadId,
    measuredAt: requiredIso(timing.measuredAt),
    sla: Object.freeze({
      consumedPercentage: optionalBoundedPercentage(sla.consumedPercentage),
      elapsedMs: optionalNonNegativeNumber(sla.elapsedMs),
      limitMs: optionalNonNegativeNumber(sla.limitMs),
      overdueMs: optionalNonNegativeNumber(sla.overdueMs),
      remainingMs: optionalNonNegativeNumber(sla.remainingMs),
      status: sla.status,
    }),
    stage: item.stage,
    status: safeText(item.status, 32),
    unitId,
    updatedAt: optionalIso(item.updatedAt),
  });
}

function matchesAlertFilter(item, slaStatus) {
  return slaStatus
    ? item.alertStatus === slaStatus
    : DEFAULT_VISIBLE_STATUSES.has(item.alertStatus);
}

function compareAlerts(left, right) {
  const priority = ALERT_PRIORITY[left.alertStatus] - ALERT_PRIORITY[right.alertStatus];
  if (priority) return priority;
  if (left.alertStatus === CRM_LEAD_SLA_ALERT_STATUS.OVERDUE) {
    const overdue = (right.sla.overdueMs ?? 0) - (left.sla.overdueMs ?? 0);
    if (overdue) return overdue;
  }
  if (left.alertStatus === CRM_LEAD_SLA_ALERT_STATUS.WARNING) {
    const remaining =
      (left.sla.remainingMs ?? Number.MAX_SAFE_INTEGER) -
      (right.sla.remainingMs ?? Number.MAX_SAFE_INTEGER);
    if (remaining) return remaining;
  }
  const entry = compareNullableIso(left.currentStageEntryAt, right.currentStageEntryAt);
  return entry || left.leadId.localeCompare(right.leadId);
}

function countPage(items) {
  const counts = {
    completed: 0,
    normal: 0,
    notConfigured: 0,
    overdue: 0,
    unavailable: 0,
    warning: 0,
  };
  const fields = {
    COMPLETED: "completed",
    NORMAL: "normal",
    NOT_CONFIGURED: "notConfigured",
    OVERDUE: "overdue",
    UNAVAILABLE: "unavailable",
    WARNING: "warning",
  };
  for (const item of items) counts[fields[item.alertStatus]] += 1;
  return Object.freeze(counts);
}

function filtersAppliedCount(filters) {
  return (
    [filters.cursor, filters.slaStatus, filters.stage, filters.unitId].filter(Boolean).length +
    (filters.limit !== DEFAULT_LIMIT ? 1 : 0)
  );
}

function assertPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw inputError("query");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw inputError("query");
}

function isExactObject(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return (
    actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
  );
}

function optionalEnum(value, allowed, field) {
  if (value == null) return null;
  if (Array.isArray(value) || typeof value !== "string" || !allowed.has(value)) {
    throw inputError(field);
  }
  return value;
}

function requiredId(value, field) {
  if (Array.isArray(value) || !isSafeId(value)) throw inputError(field);
  return value.trim();
}

function requiredInternalId(value) {
  if (!isSafeId(value)) throw new TypeError("CRM Lead projection id is invalid.");
  return value.trim();
}

function isSafeId(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value.trim());
}

function requiredIso(value) {
  const result = utcIso(value);
  if (!result) throw new TypeError("CRM Lead projection date is invalid.");
  return result;
}

function optionalIso(value) {
  return value == null ? null : requiredIso(value);
}

function optionalNonNegativeNumber(value) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError("CRM SLA number is invalid.");
  return number;
}

function optionalBoundedPercentage(value) {
  const number = optionalNonNegativeNumber(value);
  if (number != null && number > 100) throw new TypeError("CRM SLA percentage is invalid.");
  return number;
}

function safeText(value, maxLength) {
  const text = String(value ?? "").trim();
  if (!text) throw new TypeError("CRM Lead projection text is invalid.");
  return text.slice(0, maxLength);
}

function compareNullableIso(left, right) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return left.localeCompare(right);
}

function safeContextId(value, maxLength) {
  const text = String(value ?? "").trim();
  return text && /^[A-Za-z0-9._:-]+$/.test(text) ? text.slice(0, maxLength) : null;
}

function elapsedMilliseconds(startedAt, endedAt) {
  const duration =
    typeof startedAt === "bigint" && typeof endedAt === "bigint"
      ? Number(endedAt - startedAt) / 1_000_000
      : Number(endedAt) - Number(startedAt);
  return Number.isFinite(duration) && duration >= 0 ? Math.trunc(duration) : 0;
}

function defaultMonotonicClock() {
  return process.hrtime.bigint();
}

function isInputError(error) {
  return error?.code === "CRM_INPUT_INVALID" || error?.code === "CRM_CURSOR_INVALID";
}

function inputError(field) {
  return Object.assign(new TypeError("CRM SLA alert input is invalid."), {
    code: "CRM_INPUT_INVALID",
    details: { field },
    expose: true,
    statusCode: 400,
  });
}

function cursorError() {
  return Object.assign(new TypeError("CRM SLA alert cursor is invalid."), {
    code: "CRM_CURSOR_INVALID",
    details: null,
    expose: true,
    statusCode: 400,
  });
}

function slaAlertQueryError() {
  return Object.assign(new Error("CRM SLA alert query failed."), {
    code: "CRM_SLA_ALERT_QUERY_FAILED",
    details: null,
    expose: false,
    statusCode: 500,
  });
}

module.exports = {
  ALLOWED_FILTERS,
  CURSOR_VERSION,
  CrmLeadSlaAlertQueryService,
  DEFAULT_LIMIT,
  DEFAULT_VISIBLE_STATUSES,
  MAX_CURSOR_LENGTH,
  MAX_LIMIT,
  compareAlerts,
  countPage,
  decodeAlertCursor,
  encodeAlertCursor,
  normalizeFilters,
  toAlertItem,
};
