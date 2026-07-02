const { EnrollmentFacade } = require("../facades/enrollment.facade.js");

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
    const data = await this.getFacade().getEnrollmentStatusSummary(readStudentScope(request));

    return successResponse(data);
  }

  /**
   * Future handler for GET /internal/enrollments/current-draft.
   *
   * @param {Object} request
   * @returns {Promise<{ success: true, data: unknown }>}
   */
  async getCurrentDraft(request = {}) {
    const data = await this.getFacade().findCurrentDraftEnrollment(readStudentScope(request));

    return successResponse(data);
  }

  /**
   * Future handler for GET /internal/enrollments/current-active.
   *
   * @param {Object} request
   * @returns {Promise<{ success: true, data: unknown }>}
   */
  async getCurrentActive(request = {}) {
    const data = await this.getFacade().findCurrentActiveEnrollment(readStudentScope(request));

    return successResponse(data);
  }

  /**
   * Future handler for POST /internal/enrollments/:id/confirm.
   *
   * @param {Object} request
   * @returns {Promise<{ success: true, data: unknown }>}
   */
  async confirm(request = {}) {
    const data = await this.getFacade().confirmDraftEnrollment(readConfirmInput(request));

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
 * @returns {{ studentPersonId: string|null, studentProfileId: string|null }}
 */
function readStudentScope(request = {}) {
  const source = readRequestSource(request);

  return {
    studentPersonId: nullableText(source.studentPersonId ?? source.student_person_id, 64),
    studentProfileId: nullableText(source.studentProfileId ?? source.student_profile_id, 64),
  };
}

/**
 * @param {Object} request
 * @returns {{ confirmedBy: string|null, enrollmentId: string|null }}
 */
function readConfirmInput(request = {}) {
  const source = readRequestSource(request);
  const user = request?.user || request?.auth || {};
  const confirmedBy =
    source.confirmedBy ||
    source.confirmed_by ||
    user.email ||
    user.username ||
    user.id ||
    source.requestedBy ||
    source.requested_by;

  return {
    confirmedBy: nullableText(confirmedBy, 191),
    enrollmentId: nullableText(source.enrollmentId ?? source.enrollment_id ?? source.id, 64),
  };
}

/**
 * @param {Object} request
 * @returns {Record<string, unknown>}
 */
function readRequestSource(request = {}) {
  return {
    ...(request?.query && typeof request.query === "object" ? request.query : {}),
    ...(request?.params && typeof request.params === "object" ? request.params : {}),
    ...(request?.body && typeof request.body === "object" ? request.body : {}),
    ...(request && typeof request === "object" && !request.query && !request.params && !request.body
      ? request
      : {}),
  };
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
