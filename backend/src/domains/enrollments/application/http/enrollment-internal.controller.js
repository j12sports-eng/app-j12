const { EnrollmentFacade } = require("../facades/enrollment.facade.js");
const {
  readTrustedEnrollmentContext,
} = require("../security/trusted-enrollment-context.js");

/**
 * Internal HTTP controller prepared for future Enrollment routes.
 *
 * It is not mounted in Express in this sprint. Each handler delegates to
 * EnrollmentFacade and returns the same response envelope used by current APIs.
 */
class EnrollmentInternalController {
  /**
   * @param {Object} [options]
   * @param {EnrollmentFacade} [options.enrollmentFacade]
   * @param {EnrollmentFacade} [options.facade]
   */
  constructor(options = {}) {
    this.enrollmentFacade =
      options.enrollmentFacade || options.facade || new EnrollmentFacade(options);
  }

  /**
   * Future handler for GET /internal/enrollments/status.
   *
   * @param {Object} request
   * @returns {Promise<{ success: true, data: unknown }>}
   */
  async getStatus(request = {}) {
    const context = readTrustedEnrollmentContext(request);
    const data = await this.getFacade().getEnrollmentStatusSummary(readStudentScope(request, context));

    return successResponse(data);
  }

  /**
   * Future handler for GET /internal/enrollments/current-draft.
   *
   * @param {Object} request
   * @returns {Promise<{ success: true, data: unknown }>}
   */
  async getCurrentDraft(request = {}) {
    const context = readTrustedEnrollmentContext(request);
    const data = await this.getFacade().findCurrentDraftEnrollment(readStudentScope(request, context));

    return successResponse(data);
  }

  /**
   * Future handler for GET /internal/enrollments/current-active.
   *
   * @param {Object} request
   * @returns {Promise<{ success: true, data: unknown }>}
   */
  async getCurrentActive(request = {}) {
    const context = readTrustedEnrollmentContext(request);
    const data = await this.getFacade().findCurrentActiveEnrollment(readStudentScope(request, context));

    return successResponse(data);
  }

  /**
   * Future handler for POST /internal/enrollments/:id/confirm.
   *
   * @param {Object} request
   * @returns {Promise<{ success: true, data: unknown }>}
   */
  async confirm(request = {}) {
    const context = readTrustedEnrollmentContext(request);
    const data = await this.getFacade().confirmDraftEnrollment(readConfirmInput(request), context);

    return successResponse(data);
  }

  /**
   * @returns {EnrollmentFacade}
   */
  getFacade() {
    const facade = this.enrollmentFacade;

    if (!facade || typeof facade !== "object") {
      throw new TypeError("EnrollmentInternalController requires EnrollmentFacade.");
    }

    return facade;
  }
}

/**
 * @param {unknown} data
 * @returns {{ success: true, data: unknown }}
 */
function successResponse(data) {
  return {
    data,
    success: true,
  };
}

/**
 * @param {unknown} error
 * @returns {{ success: false, code: string, error: string }}
 */
function errorResponse(error) {
  return {
    code: nullableText(error?.code, 100) || "ENROLLMENT_INTERNAL_API_ERROR",
    error: error instanceof Error ? error.message : String(error ?? "Enrollment API error."),
    success: false,
  };
}

/**
 * @param {Object} request
 * @param {{ unitId: string }} context
 * @returns {{ studentPersonId: string|null, studentProfileId: string|null }}
 */
function readStudentScope(request = {}, context = readTrustedEnrollmentContext(request)) {
  const query = request.query
    ? readObject(request.query)
    : readObject(request);

  return {
    studentPersonId: nullableText(query.studentPersonId ?? query.student_person_id, 64),
    studentProfileId: nullableText(query.studentProfileId ?? query.student_profile_id, 64),
    unitId: context.unitId,
  };
}

/**
 * @param {Object} request
 * @returns {{ confirmedBy: string|null, enrollmentId: string|null }}
 */
function readConfirmInput(request = {}) {
  const params = readObject(request.params);
  const body = readObject(request.body);
  const direct = !request.params && !request.body ? readObject(request) : {};
  const user = request?.user || request?.auth || {};
  const confirmedBy =
    user.email ||
    user.username ||
    user.id ||
    body.confirmedBy ||
    body.confirmed_by ||
    direct.confirmedBy ||
    direct.confirmed_by;

  return {
    confirmedBy: nullableText(confirmedBy, 191),
    enrollmentId: nullableText(
      params.enrollmentId ?? params.enrollment_id ?? params.id ?? body.enrollmentId ?? direct.enrollmentId ?? direct.enrollment_id ?? direct.id,
      64,
    ),
  };
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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

module.exports = {
  EnrollmentInternalController,
  errorResponse,
  readConfirmInput,
  readStudentScope,
};
