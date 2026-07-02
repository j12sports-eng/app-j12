const { EnrollmentFacade } = require("../../application/facades/enrollment.facade.js");

const ENROLLMENT_INTERNAL_INPUT_REQUIRED_CODE = "ENROLLMENT_INTERNAL_INPUT_REQUIRED";

/**
 * Express controller for internal Enrollment API endpoints.
 *
 * The controller is deliberately thin and delegates every domain operation to
 * EnrollmentFacade. It does not access repositories, SQL, infrastructure
 * services, Financeiro, Turmas or legacy modules.
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

    this.getStatus = this.getStatus.bind(this);
    this.getCurrentDraft = this.getCurrentDraft.bind(this);
    this.getCurrentActive = this.getCurrentActive.bind(this);
    this.confirmDraft = this.confirmDraft.bind(this);
  }

  /**
   * GET /internal/enrollments/status
   *
   * @param {Object} req
   * @param {Object} res
   * @param {(error?: unknown) => void} next
   * @returns {Promise<unknown>}
   */
  async getStatus(req, res, next) {
    try {
      const input = readStudentScope(req);
      const validation = validateStudentScope(input);

      if (!validation.valid) {
        return sendBadRequest(res, validation);
      }

      const data = await this.getFacade().getEnrollmentStatusSummary(input);

      return sendSuccess(res, data);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /internal/enrollments/current-draft
   *
   * @param {Object} req
   * @param {Object} res
   * @param {(error?: unknown) => void} next
   * @returns {Promise<unknown>}
   */
  async getCurrentDraft(req, res, next) {
    try {
      const input = readStudentScope(req);
      const validation = validateStudentScope(input);

      if (!validation.valid) {
        return sendBadRequest(res, validation);
      }

      const data = await this.getFacade().findCurrentDraftEnrollment(input);

      return sendSuccess(res, data);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /internal/enrollments/current-active
   *
   * @param {Object} req
   * @param {Object} res
   * @param {(error?: unknown) => void} next
   * @returns {Promise<unknown>}
   */
  async getCurrentActive(req, res, next) {
    try {
      const input = readStudentScope(req);
      const validation = validateStudentScope(input);

      if (!validation.valid) {
        return sendBadRequest(res, validation);
      }

      const data = await this.getFacade().findCurrentActiveEnrollment(input);

      return sendSuccess(res, data);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /internal/enrollments/:enrollmentId/confirm
   *
   * @param {Object} req
   * @param {Object} res
   * @param {(error?: unknown) => void} next
   * @returns {Promise<unknown>}
   */
  async confirmDraft(req, res, next) {
    try {
      const input = readConfirmInput(req);
      const validation = validateConfirmInput(input);

      if (!validation.valid) {
        return sendBadRequest(res, validation);
      }

      const data = await this.getFacade().confirmDraftEnrollment(input);

      return sendSuccess(res, data);
    } catch (error) {
      return next(error);
    }
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
 * @returns {{ data: unknown, success: true }}
 */
function successEnvelope(data) {
  return {
    data,
    success: true,
  };
}

/**
 * @param {Object} res
 * @param {unknown} data
 * @returns {unknown}
 */
function sendSuccess(res, data) {
  return res.json(successEnvelope(data));
}

/**
 * @param {Object} res
 * @param {{ code: string, message: string, missingFields?: string[] }} validation
 * @returns {unknown}
 */
function sendBadRequest(res, validation) {
  return res.status(400).json({
    code: validation.code,
    error: validation.message,
    missingFields: validation.missingFields || [],
    success: false,
  });
}

/**
 * @param {Object} req
 * @returns {{ studentPersonId: string|null, studentProfileId: string|null }}
 */
function readStudentScope(req = {}) {
  const query = req?.query && typeof req.query === "object" ? req.query : {};

  return {
    studentPersonId: nullableText(query.studentPersonId ?? query.student_person_id, 64),
    studentProfileId: nullableText(query.studentProfileId ?? query.student_profile_id, 64),
  };
}

/**
 * @param {Object} req
 * @returns {{ confirmedBy: string|null, enrollmentId: string|null }}
 */
function readConfirmInput(req = {}) {
  const params = req?.params && typeof req.params === "object" ? req.params : {};
  const body = req?.body && typeof req.body === "object" ? req.body : {};
  const user = req?.auth || req?.user || {};
  const confirmedBy =
    body.confirmedBy ||
    body.confirmed_by ||
    user.email ||
    user.username ||
    user.login ||
    user.id;

  return {
    confirmedBy: nullableText(confirmedBy, 191),
    enrollmentId: nullableText(params.enrollmentId ?? params.id ?? body.enrollmentId, 64),
  };
}

/**
 * @param {{ studentPersonId: string|null, studentProfileId: string|null }} input
 * @returns {{ code: string, message: string, missingFields: string[], valid: boolean }}
 */
function validateStudentScope(input = {}) {
  const missingFields = [];

  if (!input.studentPersonId) {
    missingFields.push("studentPersonId");
  }

  if (!input.studentProfileId) {
    missingFields.push("studentProfileId");
  }

  return {
    code: ENROLLMENT_INTERNAL_INPUT_REQUIRED_CODE,
    message: "studentPersonId and studentProfileId are required.",
    missingFields,
    valid: missingFields.length === 0,
  };
}

/**
 * @param {{ confirmedBy: string|null, enrollmentId: string|null }} input
 * @returns {{ code: string, message: string, missingFields: string[], valid: boolean }}
 */
function validateConfirmInput(input = {}) {
  const missingFields = [];

  if (!input.enrollmentId) {
    missingFields.push("enrollmentId");
  }

  return {
    code: ENROLLMENT_INTERNAL_INPUT_REQUIRED_CODE,
    message: "enrollmentId is required.",
    missingFields,
    valid: missingFields.length === 0,
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
  ENROLLMENT_INTERNAL_INPUT_REQUIRED_CODE,
  EnrollmentInternalController,
  nullableText,
  readConfirmInput,
  readStudentScope,
  successEnvelope,
  validateConfirmInput,
  validateStudentScope,
};
