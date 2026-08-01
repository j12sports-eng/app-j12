const {
  ENROLLMENT_PUBLIC_NOT_AVAILABLE_CODE,
  EnrollmentPublicApplicationService,
} = require("../../application/services/enrollment-public-application.service.js");

const ENROLLMENT_PUBLIC_ERROR_MESSAGE = "Convite de matricula digital indisponivel.";

/** Thin HTTP boundary; all token and Enrollment rules stay in application. */
class EnrollmentDigitalPublicController {
  constructor({
    enrollmentPublicApplicationService = null,
    formService = null,
    logger = null,
  } = {}) {
    this.enrollmentPublicApplicationService =
      enrollmentPublicApplicationService || new EnrollmentPublicApplicationService();
    this.formService = formService;
    this.logger = logger;
    this.getByToken = this.getByToken.bind(this);
    this.patchByToken = this.patchByToken.bind(this);
  }

  async getByToken(req, res) {
    try {
      const data = await this.getService().resolveDigitalEnrollmentByToken({
        token: readTokenParam(req),
      });
      return res.json(data);
    } catch (error) {
      this.logRejected(error);
      return sendPublicNotAvailable(res);
    }
  }

  async patchByToken(req, res) {
    try {
      const data = await this.getFormService().updateSection(
        readTokenParam(req),
        readSectionCommand(req),
      );
      return res.json({ data, success: true });
    } catch (error) {
      this.logRejected(error, "patch");
      return sendPublicPersistenceError(res, error);
    }
  }

  getService() {
    if (
      !this.enrollmentPublicApplicationService ||
      typeof this.enrollmentPublicApplicationService.resolveDigitalEnrollmentByToken !== "function"
    ) {
      throw new TypeError(
        "EnrollmentDigitalPublicController requires EnrollmentPublicApplicationService.",
      );
    }
    return this.enrollmentPublicApplicationService;
  }

  getFormService() {
    if (!this.formService || typeof this.formService.updateSection !== "function") {
      throw new TypeError(
        "EnrollmentDigitalPublicController requires DigitalEnrollmentFormApplicationService.",
      );
    }
    return this.formService;
  }

  logRejected(error, operation = "get") {
    const writer =
      typeof this.logger?.warn === "function" ? this.logger.warn.bind(this.logger) : null;
    writer?.("[enrollments] digital public controller rejected request", {
      code: nullableText(error?.code, 96) || ENROLLMENT_PUBLIC_NOT_AVAILABLE_CODE,
      operation,
      result: "not_available",
    });
  }
}

function readSectionCommand(req = {}) {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  return { fields: body.fields, revision: body.revision, section: body.section };
}

function applyEnrollmentPublicSecurityHeaders(_req, res, next) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  next();
}

function readTokenParam(req = {}) {
  const params = req.params && typeof req.params === "object" ? req.params : {};
  return nullableText(params.token, 256);
}

function sendPublicNotAvailable(res) {
  return res.status(404).json({
    code: ENROLLMENT_PUBLIC_NOT_AVAILABLE_CODE,
    error: ENROLLMENT_PUBLIC_ERROR_MESSAGE,
    success: false,
  });
}

function sendPublicPersistenceError(res, error) {
  if (error?.statusCode === 400) {
    return res.status(400).json({
      code: "DIGITAL_ENROLLMENT_INVALID_COMMAND",
      error: "Dados do formulario invalidos.",
      success: false,
    });
  }
  if (error?.statusCode === 409) {
    return res.status(409).json({
      code: "DIGITAL_ENROLLMENT_PROGRESS_CONFLICT",
      error: "O formulario foi atualizado em outra sessao.",
      success: false,
    });
  }
  return sendPublicNotAvailable(res);
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

module.exports = {
  ENROLLMENT_PUBLIC_ERROR_MESSAGE,
  EnrollmentDigitalPublicController,
  applyEnrollmentPublicSecurityHeaders,
  readSectionCommand,
  readTokenParam,
  sendPublicPersistenceError,
  sendPublicNotAvailable,
};
