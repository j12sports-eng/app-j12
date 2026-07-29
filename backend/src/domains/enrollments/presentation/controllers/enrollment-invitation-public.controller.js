const {
  RESOLVE_ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
  ResolveEnrollmentInvitationApplicationService,
} = require("../../application/services/resolve-enrollment-invitation-application.service.js");

const ENROLLMENT_INVITATION_PUBLIC_ERROR_MESSAGE = "Convite de matricula indisponivel.";

class EnrollmentInvitationPublicController {
  constructor({ resolveEnrollmentInvitationService = null, logger = null } = {}) {
    this.resolveEnrollmentInvitationService =
      resolveEnrollmentInvitationService || new ResolveEnrollmentInvitationApplicationService();
    this.logger = logger;
    this.getByToken = this.getByToken.bind(this);
  }

  async getByToken(req, res) {
    try {
      const data = await this.getService().resolveByToken({
        rawToken: readTokenParam(req),
      });

      return res.json({
        data: toPublicInvitationResponse(data),
        success: true,
      });
    } catch (error) {
      this.logRejected(error);
      return sendGenericNotAvailable(res);
    }
  }

  getService() {
    if (
      !this.resolveEnrollmentInvitationService ||
      typeof this.resolveEnrollmentInvitationService.resolveByToken !== "function"
    ) {
      throw new TypeError(
        "EnrollmentInvitationPublicController requires resolveEnrollmentInvitationService.",
      );
    }

    return this.resolveEnrollmentInvitationService;
  }

  logRejected(error) {
    const writer = typeof this.logger?.warn === "function" ? this.logger.warn.bind(this.logger) : null;

    writer?.("[enrollments] public invitation request rejected", {
      code:
        nullableText(readProperty(error, "code"), 96) ||
        RESOLVE_ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
      result: "not_available",
    });
  }
}

function applyPublicInvitationResponseHeaders(_req, res, next) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  next();
}

function sendGenericNotAvailable(res) {
  return res.status(404).json({
    code: RESOLVE_ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
    error: ENROLLMENT_INVITATION_PUBLIC_ERROR_MESSAGE,
    success: false,
  });
}

function readTokenParam(req = {}) {
  const params = req.params && typeof req.params === "object" ? req.params : {};
  return nullableText(params.token, 256);
}

function toPublicInvitationResponse(value = {}) {
  const capabilities = readProperty(value, "capabilities");
  return Object.freeze({
    available: readProperty(value, "available") === true,
    capabilities: Object.freeze({
      canContinue: readProperty(capabilities, "canContinue") === true,
      requiresAuthentication: readProperty(capabilities, "requiresAuthentication") === true,
    }),
    expiresAt: nullableText(readProperty(value, "expiresAt"), 32),
    nextStep: nullableText(readProperty(value, "nextStep"), 64),
  });
}

function readProperty(value, property) {
  return value && typeof value === "object" ? value[property] ?? null : null;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "").trim().slice(0, max);
  return normalized || null;
}

module.exports = {
  ENROLLMENT_INVITATION_PUBLIC_ERROR_MESSAGE,
  EnrollmentInvitationPublicController,
  applyPublicInvitationResponseHeaders,
  readTokenParam,
  sendGenericNotAvailable,
  toPublicInvitationResponse,
};
