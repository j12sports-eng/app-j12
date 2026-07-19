const { AppError } = require("../../../../errors/app-error.js");

const PRE_ENROLLMENT_HTTP_ERROR_CODES = Object.freeze({
  INPUT_INVALID: "PRE_ENROLLMENT_HTTP_INPUT_INVALID",
  UNIT_SCOPE_REQUIRED: "PRE_ENROLLMENT_UNIT_SCOPE_REQUIRED",
});
const ALLOWED_BODY_FIELDS = new Set(["enrollment", "responsible", "student"]);

class PreEnrollmentController {
  constructor({
    contextResolver = resolveAuthenticatedPreEnrollmentContext,
    preEnrollmentService = null,
  } = {}) {
    this.contextResolver = contextResolver;
    this.preEnrollmentService = preEnrollmentService;
    this.start = this.start.bind(this);
  }

  async start(req, res, next) {
    try {
      const input = readPreEnrollmentInput(req);
      const context = await this.getContextResolver()(req);
      const data = await this.getService().startPreEnrollment(input, context);
      return res.status(data.status === "DRAFT_CREATED" ? 201 : 200).json({ data, success: true });
    } catch (error) {
      return next(error);
    }
  }

  getContextResolver() {
    if (typeof this.contextResolver !== "function") {
      throw new TypeError("PreEnrollmentController requires a contextResolver function.");
    }
    return this.contextResolver;
  }

  getService() {
    if (typeof this.preEnrollmentService?.startPreEnrollment !== "function") {
      throw new TypeError("PreEnrollmentController requires PreEnrollmentApplicationService.");
    }
    return this.preEnrollmentService;
  }
}

function readPreEnrollmentInput(req = {}) {
  const body = object(req.body);
  const fields = Object.keys(body).filter((field) => !ALLOWED_BODY_FIELDS.has(field));
  if (fields.length) {
    throw new AppError("Pre-enrollment HTTP input is invalid.", {
      code: PRE_ENROLLMENT_HTTP_ERROR_CODES.INPUT_INVALID,
      details: Object.freeze({ fields }),
      expose: true,
      statusCode: 422,
    });
  }
  return {
    enrollment: body.enrollment,
    responsible: body.responsible,
    student: body.student,
  };
}

function resolveAuthenticatedPreEnrollmentContext(req = {}) {
  const user = req.auth || req.user || {};
  const userId = nullableText(user.id ?? user.userId ?? user.sub, 191);
  const unitId = nullableText(user.unitId ?? user.unit_id, 64);
  if (!userId || !unitId) {
    throw new AppError("Authenticated unit scope is required for pre-enrollment.", {
      code: PRE_ENROLLMENT_HTTP_ERROR_CODES.UNIT_SCOPE_REQUIRED,
      expose: true,
      statusCode: 403,
    });
  }
  return Object.freeze({
    authorization: req.preEnrollmentAuthorization || null,
    correlationId: nullableText(req.correlationId ?? req.id, 100),
    unitId,
    userId,
  });
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function nullableText(value, max) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

module.exports = Object.freeze({
  ALLOWED_BODY_FIELDS,
  PRE_ENROLLMENT_HTTP_ERROR_CODES,
  PreEnrollmentController,
  readPreEnrollmentInput,
  resolveAuthenticatedPreEnrollmentContext,
});
