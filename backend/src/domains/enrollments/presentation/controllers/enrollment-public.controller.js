const { EnrollmentFacade } = require("../../application/facades/enrollment.facade.js");
const {
  ENROLLMENT_TRUSTED_UNIT_CONTEXT_REQUIRED_CODE,
  readTrustedEnrollmentContext,
} = require("../../application/security/trusted-enrollment-context.js");

const ENROLLMENT_PUBLIC_INPUT_REQUIRED_CODE = "ENROLLMENT_PUBLIC_INPUT_REQUIRED";
const ENROLLMENT_PUBLIC_ALREADY_ACTIVE_CODE = "ENROLLMENT_PUBLIC_ALREADY_ACTIVE";
const ENROLLMENT_PUBLIC_ERROR_CODE = "ENROLLMENT_PUBLIC_ERROR";

const PUBLIC_CONTROLLED_ERROR_STATUS_BY_CODE = Object.freeze({
  ACTIVE_ENROLLMENT_ALREADY_EXISTS: 409,
  CONFIRM_DRAFT_ENROLLMENT_ID_REQUIRED: 400,
  CONFIRM_DRAFT_ENROLLMENT_INVALID_STATUS: 409,
  CONFIRM_DRAFT_ENROLLMENT_NOT_FOUND: 404,
  CONFIRM_DRAFT_ENROLLMENT_UNIT_CONTEXT_REQUIRED: 403,
  [ENROLLMENT_TRUSTED_UNIT_CONTEXT_REQUIRED_CODE]: 403,
  ENROLLMENT_PROCEED_BLOCKED: 409,
  ENROLLMENT_PROCEED_CONFLICT: 409,
  ENROLLMENT_PROCEED_GUARD_INPUT_REQUIRED: 400,
  ENROLLMENT_PUBLIC_ALREADY_ACTIVE: 409,
  ENROLLMENT_PUBLIC_INPUT_REQUIRED: 400,
});

/**
 * Express controller for the secured public Enrollment API.
 *
 * This boundary calls only EnrollmentFacade. It does not access repositories,
 * SQL, infrastructure services, Financeiro, Turmas, Agenda, Notificacoes or
 * legacy modules.
 */
class EnrollmentPublicController {
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
   * GET /enrollments/status
   *
   * @param {Object} req
   * @param {Object} res
   * @param {(error?: unknown) => void} next
   * @returns {Promise<unknown>}
   */
  async getStatus(req, res, next) {
    try {
      const context = readTrustedEnrollmentContext(req);
      const input = readStudentScope(req, context);
      const validation = validateStudentScope(input);

      if (!validation.valid) {
        return sendBadRequest(res, validation);
      }

      const data = await this.getFacade().getEnrollmentStatusSummary(input);

      return sendSuccess(res, data);
    } catch (error) {
      return handlePublicError(error, res, next);
    }
  }

  /**
   * GET /enrollments/current-draft
   *
   * @param {Object} req
   * @param {Object} res
   * @param {(error?: unknown) => void} next
   * @returns {Promise<unknown>}
   */
  async getCurrentDraft(req, res, next) {
    try {
      const context = readTrustedEnrollmentContext(req);
      const input = readStudentScope(req, context);
      const validation = validateStudentScope(input);

      if (!validation.valid) {
        return sendBadRequest(res, validation);
      }

      const data = await this.getFacade().findCurrentDraftEnrollment(input);

      return sendSuccess(res, data);
    } catch (error) {
      return handlePublicError(error, res, next);
    }
  }

  /**
   * GET /enrollments/current-active
   *
   * @param {Object} req
   * @param {Object} res
   * @param {(error?: unknown) => void} next
   * @returns {Promise<unknown>}
   */
  async getCurrentActive(req, res, next) {
    try {
      const context = readTrustedEnrollmentContext(req);
      const input = readStudentScope(req, context);
      const validation = validateStudentScope(input);

      if (!validation.valid) {
        return sendBadRequest(res, validation);
      }

      const data = await this.getFacade().findCurrentActiveEnrollment(input);

      return sendSuccess(res, data);
    } catch (error) {
      return handlePublicError(error, res, next);
    }
  }

  /**
   * POST /enrollments/:enrollmentId/confirm
   *
   * @param {Object} req
   * @param {Object} res
   * @param {(error?: unknown) => void} next
   * @returns {Promise<unknown>}
   */
  async confirmDraft(req, res, next) {
    try {
      const context = readTrustedEnrollmentContext(req);
      const input = readConfirmInput(req);
      const validation = validateConfirmInput(input);

      if (!validation.valid) {
        return sendBadRequest(res, validation);
      }

      const data = await this.getFacade().confirmDraftEnrollment(input, context);

      if (data?.alreadyConfirmed) {
        return sendControlledError(res, {
          code: ENROLLMENT_PUBLIC_ALREADY_ACTIVE_CODE,
          message: "Enrollment is already ACTIVE.",
          statusCode: 409,
        });
      }

      return sendSuccess(res, data);
    } catch (error) {
      return handlePublicError(error, res, next);
    }
  }

  /**
   * @returns {EnrollmentFacade}
   */
  getFacade() {
    const facade = this.enrollmentFacade;

    if (!facade || typeof facade !== "object") {
      throw new TypeError("EnrollmentPublicController requires EnrollmentFacade.");
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
 * @param {Object} res
 * @param {{ code?: string, message?: string, statusCode?: number }} error
 * @returns {unknown}
 */
function sendControlledError(res, error = {}) {
  const code = nullableText(error.code, 100) || ENROLLMENT_PUBLIC_ERROR_CODE;
  const statusCode =
    Number(error.statusCode || error.status) ||
    PUBLIC_CONTROLLED_ERROR_STATUS_BY_CODE[code] ||
    400;

  return res.status(statusCode).json({
    code,
    error: nullableText(error.message, 500) || "Enrollment public operation failed.",
    success: false,
  });
}

/**
 * @param {unknown} error
 * @param {Object} res
 * @param {(error?: unknown) => void} next
 * @returns {unknown}
 */
function handlePublicError(error, res, next) {
  const code = nullableText(error?.code, 100);

  if (code && PUBLIC_CONTROLLED_ERROR_STATUS_BY_CODE[code]) {
    return sendControlledError(res, {
      code,
      message: error instanceof Error ? error.message : String(error ?? "Enrollment error."),
      statusCode: PUBLIC_CONTROLLED_ERROR_STATUS_BY_CODE[code],
    });
  }

  return next(error);
}

/**
 * @param {Object} req
 * @param {{ unitId: string }} context
 * @returns {{ studentPersonId: string|null, studentProfileId: string|null }}
 */
function readStudentScope(req = {}, context = readTrustedEnrollmentContext(req)) {
  const query = req?.query && typeof req.query === "object" ? req.query : {};

  return {
    studentPersonId: nullableText(query.studentPersonId ?? query.student_person_id, 64),
    studentProfileId: nullableText(query.studentProfileId ?? query.student_profile_id, 64),
    unitId: context.unitId,
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
    user.email ||
    user.login ||
    user.username ||
    user.id ||
    body.confirmedBy ||
    body.confirmed_by;

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
    code: ENROLLMENT_PUBLIC_INPUT_REQUIRED_CODE,
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

  if (!input.confirmedBy) {
    missingFields.push("confirmedBy");
  }

  return {
    code: ENROLLMENT_PUBLIC_INPUT_REQUIRED_CODE,
    message: "enrollmentId and confirmedBy are required.",
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
  ENROLLMENT_PUBLIC_ALREADY_ACTIVE_CODE,
  ENROLLMENT_PUBLIC_ERROR_CODE,
  ENROLLMENT_PUBLIC_INPUT_REQUIRED_CODE,
  EnrollmentPublicController,
  PUBLIC_CONTROLLED_ERROR_STATUS_BY_CODE,
  handlePublicError,
  nullableText,
  readConfirmInput,
  readStudentScope,
  successEnvelope,
  validateConfirmInput,
  validateStudentScope,
};
