const { EnrollmentFacade } = require("../../application/facades/enrollment.facade.js");

const ENROLLMENT_ADMIN_INPUT_REQUIRED_CODE = "ENROLLMENT_ADMIN_INPUT_REQUIRED";
const ENROLLMENT_ADMIN_ALREADY_ACTIVE_CODE = "ENROLLMENT_ADMIN_ALREADY_ACTIVE";
const ENROLLMENT_ADMIN_ERROR_CODE = "ENROLLMENT_ADMIN_ERROR";
const ENROLLMENT_ADMIN_SEARCH_QUERY_REQUIRED_CODE = "ENROLLMENT_ADMIN_SEARCH_QUERY_REQUIRED";

const CONTROLLED_ERROR_STATUS_BY_CODE = Object.freeze({
  ACTIVE_ENROLLMENT_ALREADY_EXISTS: 409,
  CONFIRM_DRAFT_ENROLLMENT_ID_REQUIRED: 400,
  CONFIRM_DRAFT_ENROLLMENT_INVALID_STATUS: 409,
  CONFIRM_DRAFT_ENROLLMENT_NOT_FOUND: 404,
  ENROLLMENT_ADMIN_ALREADY_ACTIVE: 409,
  ENROLLMENT_ADMIN_INPUT_REQUIRED: 400,
  ENROLLMENT_ADMIN_SEARCH_QUERY_REQUIRED: 400,
  ENROLLMENT_PROCEED_BLOCKED: 409,
  ENROLLMENT_PROCEED_CONFLICT: 409,
  ENROLLMENT_PROCEED_GUARD_INPUT_REQUIRED: 400,
});

/**
 * Express controller for administrative Enrollment endpoints.
 *
 * This boundary calls only EnrollmentFacade. It does not access repositories,
 * SQL, infrastructure services, Financeiro, Turmas or legacy modules.
 */
class EnrollmentAdminController {
  /**
   * @param {Object} [options]
   * @param {EnrollmentFacade} [options.enrollmentFacade]
   * @param {EnrollmentFacade} [options.facade]
   */
  constructor(options = {}) {
    this.enrollmentFacade =
      options.enrollmentFacade || options.facade || new EnrollmentFacade(options);

    this.getStatus = this.getStatus.bind(this);
    this.searchStudentScopes = this.searchStudentScopes.bind(this);
    this.getCurrentDraft = this.getCurrentDraft.bind(this);
    this.getCurrentActive = this.getCurrentActive.bind(this);
    this.confirmDraft = this.confirmDraft.bind(this);
  }

  /**
   * GET /admin/enrollments/students/search
   *
   * @param {Object} req
   * @param {Object} res
   * @param {(error?: unknown) => void} next
   * @returns {Promise<unknown>}
   */
  async searchStudentScopes(req, res, next) {
    try {
      const input = readStudentScopeSearch(req);
      const validation = validateStudentScopeSearch(input);

      if (!validation.valid) {
        return sendBadRequest(res, validation);
      }

      const data = await this.getFacade().searchStudentScopes(input);

      return sendSuccess(res, data);
    } catch (error) {
      return handleAdminError(error, res, next);
    }
  }

  /**
   * GET /admin/enrollments/status
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
      return handleAdminError(error, res, next);
    }
  }

  /**
   * GET /admin/enrollments/current-draft
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
      return handleAdminError(error, res, next);
    }
  }

  /**
   * GET /admin/enrollments/current-active
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
      return handleAdminError(error, res, next);
    }
  }

  /**
   * POST /admin/enrollments/:enrollmentId/confirm
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

      if (data?.alreadyConfirmed) {
        return sendControlledError(res, {
          code: ENROLLMENT_ADMIN_ALREADY_ACTIVE_CODE,
          message: "Enrollment is already ACTIVE.",
          statusCode: 409,
        });
      }

      return sendSuccess(res, data);
    } catch (error) {
      return handleAdminError(error, res, next);
    }
  }

  /**
   * @returns {EnrollmentFacade}
   */
  getFacade() {
    const facade = this.enrollmentFacade;

    if (!facade || typeof facade !== "object") {
      throw new TypeError("EnrollmentAdminController requires EnrollmentFacade.");
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
  const code = nullableText(error.code, 100) || ENROLLMENT_ADMIN_ERROR_CODE;
  const statusCode =
    Number(error.statusCode || error.status) ||
    CONTROLLED_ERROR_STATUS_BY_CODE[code] ||
    400;

  return res.status(statusCode).json({
    code,
    error: nullableText(error.message, 500) || "Enrollment admin operation failed.",
    success: false,
  });
}

/**
 * @param {unknown} error
 * @param {Object} res
 * @param {(error?: unknown) => void} next
 * @returns {unknown}
 */
function handleAdminError(error, res, next) {
  const code = nullableText(error?.code, 100);

  if (code && CONTROLLED_ERROR_STATUS_BY_CODE[code]) {
    return sendControlledError(res, {
      code,
      message: error instanceof Error ? error.message : String(error ?? "Enrollment error."),
      statusCode: CONTROLLED_ERROR_STATUS_BY_CODE[code],
    });
  }

  return next(error);
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
 * @returns {{ limit: number, query: string|null }}
 */
function readStudentScopeSearch(req = {}) {
  const query = req?.query && typeof req.query === "object" ? req.query : {};

  return {
    limit: normalizeLimit(query.limit),
    query: nullableText(query.q ?? query.query ?? query.search, 100),
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
    user.login ||
    user.username ||
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
    code: ENROLLMENT_ADMIN_INPUT_REQUIRED_CODE,
    message: "studentPersonId and studentProfileId are required.",
    missingFields,
    valid: missingFields.length === 0,
  };
}

/**
 * @param {{ query: string|null }} input
 * @returns {{ code: string, message: string, missingFields: string[], valid: boolean }}
 */
function validateStudentScopeSearch(input = {}) {
  const query = nullableText(input.query, 100);

  if (!query || query.length < 2) {
    return {
      code: ENROLLMENT_ADMIN_SEARCH_QUERY_REQUIRED_CODE,
      message: "Informe ao menos 2 caracteres para buscar aluno.",
      missingFields: ["query"],
      valid: false,
    };
  }

  return {
    code: ENROLLMENT_ADMIN_SEARCH_QUERY_REQUIRED_CODE,
    message: "",
    missingFields: [],
    valid: true,
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
    code: ENROLLMENT_ADMIN_INPUT_REQUIRED_CODE,
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

/**
 * @param {unknown} value
 * @returns {number}
 */
function normalizeLimit(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10;
  }

  return Math.min(Math.trunc(parsed), 25);
}

module.exports = {
  CONTROLLED_ERROR_STATUS_BY_CODE,
  ENROLLMENT_ADMIN_ALREADY_ACTIVE_CODE,
  ENROLLMENT_ADMIN_ERROR_CODE,
  ENROLLMENT_ADMIN_INPUT_REQUIRED_CODE,
  ENROLLMENT_ADMIN_SEARCH_QUERY_REQUIRED_CODE,
  EnrollmentAdminController,
  handleAdminError,
  nullableText,
  normalizeLimit,
  readConfirmInput,
  readStudentScope,
  readStudentScopeSearch,
  successEnvelope,
  validateConfirmInput,
  validateStudentScope,
  validateStudentScopeSearch,
};
