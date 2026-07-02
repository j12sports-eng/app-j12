const ENROLLMENT_MOBILE_SUMMARY_CONTRACT_VERSION = "sprint-9.56";
const ENROLLMENT_MOBILE_SUMMARY_INPUT_REQUIRED_CODE = "ENROLLMENT_MOBILE_SUMMARY_INPUT_REQUIRED";
const EnrollmentMobileSummaryStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  CONFLICT: "CONFLICT",
  DRAFT: "DRAFT",
  NONE: "NONE",
});
const ENROLLMENT_MOBILE_SUMMARY_STATUS_VALUES = Object.freeze(
  Object.values(EnrollmentMobileSummaryStatus),
);

/**
 * Validates the scoped identifiers that a future authenticated student/mobile
 * boundary must resolve before reading Enrollment data.
 *
 * @param {Object} input
 * @param {string|null} [input.studentPersonId]
 * @param {string|null} [input.studentProfileId]
 * @returns {{ studentPersonId: string, studentProfileId: string }}
 */
function assertStudentEnrollmentMobileScope(input = {}) {
  const scope = normalizeStudentEnrollmentMobileScope(input);

  if (!scope.studentPersonId || !scope.studentProfileId) {
    throw controlledError(
      "getStudentEnrollmentMobileSummary requires studentPersonId and studentProfileId.",
      ENROLLMENT_MOBILE_SUMMARY_INPUT_REQUIRED_CODE,
      {
        hasStudentPersonId: Boolean(scope.studentPersonId),
        hasStudentProfileId: Boolean(scope.studentProfileId),
      },
    );
  }

  return scope;
}

/**
 * Builds the student/mobile-safe Enrollment DTO.
 *
 * This DTO intentionally omits audit fields, technical logs, warnings,
 * persistence metadata, student/person identifiers and data from related
 * modules that are not safely linked yet.
 *
 * @param {Object} input
 * @param {Object|null} [input.statusSummary]
 * @returns {Record<string, unknown>}
 */
function prepareStudentEnrollmentMobileSummary(input = {}) {
  const statusSummary = normalizeStatusSummary(input.statusSummary ?? input);
  const status =
    normalizeMobileSummaryStatus(statusSummary?.status) || EnrollmentMobileSummaryStatus.NONE;
  const draftEnrollment = sanitizeEnrollmentForMobile(statusSummary?.draftEnrollment);
  const activeEnrollment = sanitizeEnrollmentForMobile(statusSummary?.activeEnrollment);
  const currentEnrollment = selectCurrentEnrollmentSummary({
    activeEnrollment,
    draftEnrollment,
    status,
  });

  return {
    activeEnrollmentSummary: activeEnrollment,
    availableActions: {
      canConfirmEnrollment: false,
      canCreateAgenda: false,
      canGenerateFinancialCharge: false,
      canLinkClass: false,
    },
    classSummary: null,
    contractVersion: ENROLLMENT_MOBILE_SUMMARY_CONTRACT_VERSION,
    currentEnrollmentSummary: currentEnrollment,
    enrollmentId: currentEnrollment?.enrollmentId ?? null,
    financialSummary: null,
    historySummary: buildMobileHistorySummary({
      activeEnrollment,
      draftEnrollment,
    }),
    mobileSafe: true,
    scheduleSummary: null,
    status,
  };
}

/**
 * @param {Object} input
 * @returns {{ studentPersonId: string|null, studentProfileId: string|null }}
 */
function normalizeStudentEnrollmentMobileScope(input = {}) {
  return {
    studentPersonId: nullableText(input.studentPersonId ?? input.student_person_id, 64),
    studentProfileId: nullableText(input.studentProfileId ?? input.student_profile_id, 64),
  };
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>|null}
 */
function normalizeStatusSummary(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeMobileSummaryStatus(value) {
  const normalized = nullableText(value, 32)?.toUpperCase() ?? null;

  return ENROLLMENT_MOBILE_SUMMARY_STATUS_VALUES.includes(normalized) ? normalized : null;
}

/**
 * @param {unknown} enrollment
 * @returns {{ enrollmentId: string, endDate: string|null, startDate: string|null, status: string|null }|null}
 */
function sanitizeEnrollmentForMobile(enrollment) {
  if (!enrollment || typeof enrollment !== "object" || Array.isArray(enrollment)) {
    return null;
  }

  const enrollmentId = nullableText(readProperty(enrollment, "id"), 64);

  if (!enrollmentId) {
    return null;
  }

  return {
    endDate: nullableText(
      readProperty(enrollment, "endDate") ?? readProperty(enrollment, "end_date"),
      10,
    ),
    enrollmentId,
    startDate: nullableText(
      readProperty(enrollment, "startDate") ?? readProperty(enrollment, "start_date"),
      10,
    ),
    status: nullableText(readProperty(enrollment, "status"), 32)?.toUpperCase() ?? null,
  };
}

/**
 * @param {{ activeEnrollment: Record<string, unknown>|null, draftEnrollment: Record<string, unknown>|null, status: string }} input
 * @returns {Record<string, unknown>|null}
 */
function selectCurrentEnrollmentSummary({ activeEnrollment, draftEnrollment, status }) {
  if (status === EnrollmentMobileSummaryStatus.ACTIVE) {
    return activeEnrollment;
  }

  if (status === EnrollmentMobileSummaryStatus.DRAFT) {
    return draftEnrollment;
  }

  return null;
}

/**
 * @param {{ activeEnrollment: Record<string, unknown>|null, draftEnrollment: Record<string, unknown>|null }} input
 * @returns {Record<string, unknown>[]}
 */
function buildMobileHistorySummary({ activeEnrollment, draftEnrollment }) {
  const items = [activeEnrollment, draftEnrollment].filter(Boolean);
  const seen = new Set();

  return items.filter((item) => {
    const key = item.enrollmentId;

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/**
 * @param {Record<string, unknown>} value
 * @param {string} property
 * @returns {unknown}
 */
function readProperty(value, property) {
  return value && typeof value === "object" ? (value[property] ?? null) : null;
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
  ENROLLMENT_MOBILE_SUMMARY_CONTRACT_VERSION,
  ENROLLMENT_MOBILE_SUMMARY_INPUT_REQUIRED_CODE,
  ENROLLMENT_MOBILE_SUMMARY_STATUS_VALUES,
  EnrollmentMobileSummaryStatus,
  assertStudentEnrollmentMobileScope,
  prepareStudentEnrollmentMobileSummary,
};
