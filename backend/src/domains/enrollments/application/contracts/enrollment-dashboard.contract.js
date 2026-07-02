const { ENROLLMENT_STATUS_VALUES } = require("../../domain/enums/enrollment-status.enum.js");

const ENROLLMENT_DASHBOARD_CONTRACT_VERSION = "sprint-9.57";
const ENROLLMENT_DASHBOARD_PREPARED_STATUS = "PREPARED_ONLY";
const ENROLLMENT_DASHBOARD_BLOCKED_BY_DATA_OR_PATTERN_GAP_CODE =
  "DASHBOARD_QUERY_BLOCKED_BY_DATA_OR_PATTERN_GAP";
const ENROLLMENT_DASHBOARD_INVALID_DATE_CODE = "ENROLLMENT_DASHBOARD_INVALID_DATE";
const ENROLLMENT_DASHBOARD_INVALID_DATE_RANGE_CODE =
  "ENROLLMENT_DASHBOARD_INVALID_DATE_RANGE";

const DASHBOARD_METRIC_KEYS = Object.freeze([
  "totalDraft",
  "totalActive",
  "totalConflict",
  "totalConfirmedInPeriod",
  "conversionRate",
  "pendingDrafts",
]);

/**
 * Preparation-only contract for a future operational Enrollment dashboard.
 *
 * It maps the safe metric contract and known schema gaps without executing an
 * aggregate query. No personal data, list payload, route or side effect is
 * created by this function.
 *
 * @param {Object} input
 * @param {string|null} [input.startDate]
 * @param {string|null} [input.endDate]
 * @param {string|null} [input.unitId]
 * @param {string|null} [input.generatedAt]
 * @returns {Record<string, unknown>}
 */
function prepareEnrollmentOperationalDashboard(input = {}) {
  const startDate = normalizeDate(input.startDate, "startDate");
  const endDate = normalizeDate(input.endDate, "endDate");
  const unitId = nullableText(input.unitId ?? input.unidadeId ?? input.tenantId, 64);

  if (startDate && endDate && startDate > endDate) {
    throw controlledError(
      "prepareEnrollmentOperationalDashboard requires startDate to be before or equal to endDate.",
      ENROLLMENT_DASHBOARD_INVALID_DATE_RANGE_CODE,
      {
        endDate,
        startDate,
      },
    );
  }

  const metrics = buildPreparedMetrics();

  return {
    ...metrics,
    blocked: true,
    blockedByDataOrPatternGap: true,
    blockerCode: ENROLLMENT_DASHBOARD_BLOCKED_BY_DATA_OR_PATTERN_GAP_CODE,
    contractDocumented: true,
    contractVersion: ENROLLMENT_DASHBOARD_CONTRACT_VERSION,
    dashboardQueryCreated: false,
    dataGaps: [
      "enrollments has no unit_id, tenant_id or branch column for safe unit scoping.",
      "conflict is currently derived by read guards, not materialized as a persisted status.",
      "confirmed_at exists through a manual migration, but no dedicated index is defined for dashboard periods.",
      "there is no dedicated dashboard route or cache policy for operational aggregates.",
    ],
    filters: {
      endDate,
      startDate,
      unitId,
      unitScopeRequiredBeforeQuery: true,
      unitScopeSupported: false,
    },
    futureQueryRequirements: [
      "resolve unit or tenant scope before returning operational totals in multi-unit contexts",
      "keep the query read-only and aggregate-only",
      "filter confirmed metrics by confirmed_at when the column is present and indexed or otherwise performance-approved",
      "derive conflict with a grouped aggregate by student profile instead of N+1 status summary reads",
      "return only counts, rates and generatedAt",
    ],
    generatedAt: normalizeGeneratedAt(input.generatedAt),
    listsLoaded: false,
    mappedEnrollmentSchema: {
      dateColumns: ["created_at", "updated_at", "confirmed_at"],
      indexesObserved: [
        "PRIMARY(id)",
        "idx_enrollments_student_person_id(student_person_id)",
        "idx_enrollments_student_profile_id(student_profile_id)",
        "idx_enrollments_status(status)",
        "idx_enrollments_deleted_at(deleted_at)",
        "idx_enrollments_student_status(student_person_id,status)",
        "ux_enrollments_active_draft_student_profile(student_profile_id,status,deleted_at)",
      ],
      relationshipColumns: ["student_person_id", "student_profile_id"],
      statusValues: [...ENROLLMENT_STATUS_VALUES],
      table: "enrollments",
      unitColumns: [],
    },
    metricDefinitions: buildMetricDefinitions(),
    metrics,
    noDashboardQueryCreated: true,
    noPersonalDataExposed: true,
    noSideEffects: {
      agendaCreated: false,
      classLinked: false,
      financialGenerated: false,
      migrationCreated: false,
      notificationSent: false,
      publicFlowChanged: false,
      schemaChanged: false,
    },
    personalDataExposed: false,
    prepared: true,
    queryEnabled: false,
    readOnly: true,
    status: ENROLLMENT_DASHBOARD_PREPARED_STATUS,
  };
}

/**
 * @returns {Record<string, null>}
 */
function buildPreparedMetrics() {
  return DASHBOARD_METRIC_KEYS.reduce((metrics, key) => {
    metrics[key] = null;
    return metrics;
  }, {});
}

/**
 * @returns {Record<string, Record<string, unknown>>}
 */
function buildMetricDefinitions() {
  return {
    conversionRate: {
      blocked: true,
      formula: "totalConfirmedInPeriod / totalDraftCreatedInComparableScope",
      reason: "requires an approved period denominator before exposing a real percentage",
    },
    pendingDrafts: {
      blocked: true,
      source: "enrollments.status = DRAFT and deleted_at IS NULL",
    },
    totalActive: {
      blocked: true,
      source: "enrollments.status = ACTIVE and deleted_at IS NULL",
    },
    totalConfirmedInPeriod: {
      blocked: true,
      dateColumn: "confirmed_at",
      source: "enrollments.status = ACTIVE and confirmed_at between startDate and endDate",
    },
    totalConflict: {
      blocked: true,
      source: "future grouped aggregate for profiles with both DRAFT and ACTIVE enrollments",
    },
    totalDraft: {
      blocked: true,
      source: "enrollments.status = DRAFT and deleted_at IS NULL",
    },
  };
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string|null}
 */
function normalizeDate(value, field) {
  const normalized = nullableText(value, 32);

  if (!normalized) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);

  if (!match) {
    throw controlledError(
      `prepareEnrollmentOperationalDashboard received an invalid ${field}.`,
      ENROLLMENT_DASHBOARD_INVALID_DATE_CODE,
      {
        field,
        value: normalized,
      },
    );
  }

  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    throw controlledError(
      `prepareEnrollmentOperationalDashboard received an invalid ${field}.`,
      ENROLLMENT_DASHBOARD_INVALID_DATE_CODE,
      {
        field,
        value: normalized,
      },
    );
  }

  return `${year}-${month}-${day}`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeGeneratedAt(value) {
  const normalized = nullableText(value, 32);

  if (!normalized) {
    return new Date().toISOString();
  }

  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? normalized : date.toISOString();
}

/**
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string|null}
 */
function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

/**
 * @param {string} message
 * @param {string} code
 * @param {Record<string, unknown>} [details]
 * @returns {Error}
 */
function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;

  for (const [key, value] of Object.entries(details)) {
    error[key] = value;
  }

  return error;
}

module.exports = {
  DASHBOARD_METRIC_KEYS,
  ENROLLMENT_DASHBOARD_BLOCKED_BY_DATA_OR_PATTERN_GAP_CODE,
  ENROLLMENT_DASHBOARD_CONTRACT_VERSION,
  ENROLLMENT_DASHBOARD_INVALID_DATE_CODE,
  ENROLLMENT_DASHBOARD_INVALID_DATE_RANGE_CODE,
  ENROLLMENT_DASHBOARD_PREPARED_STATUS,
  prepareEnrollmentOperationalDashboard,
};
