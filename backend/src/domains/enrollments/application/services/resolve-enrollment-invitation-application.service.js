const {
  ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
  isValidRawToken,
} = require("./enrollment-digital-invitation.service.js");

const RESOLVE_ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE =
  "RESOLVE_ENROLLMENT_INVITATION_NOT_AVAILABLE";
const RESOLVE_ENROLLMENT_INVITATION_FIELDS = new Set(["rawToken"]);

class ResolveEnrollmentInvitationApplicationService {
  constructor({ invitationResolver = null, logger = null } = {}) {
    this.invitationResolver = invitationResolver;
    this.logger = logger;
  }

  async resolveByToken(command = {}) {
    const safeCommand = readObject(command);
    const unexpectedFields = Object.keys(safeCommand).filter(
      (field) => !RESOLVE_ENROLLMENT_INVITATION_FIELDS.has(field),
    );
    const rawToken = nullableText(safeCommand.rawToken, 256);

    if (unexpectedFields.length > 0 || !isValidRawToken(rawToken)) {
      throw notAvailable();
    }

    try {
      const result = await this.getInvitationResolver().resolveInvitationByRawToken({ rawToken });
      return toPublicInvitationDto(result);
    } catch (error) {
      this.logRejected(error);
      throw notAvailable();
    }
  }

  getInvitationResolver() {
    if (
      !this.invitationResolver ||
      typeof this.invitationResolver.resolveInvitationByRawToken !== "function"
    ) {
      throw new TypeError(
        "ResolveEnrollmentInvitationApplicationService requires an invitationResolver.",
      );
    }

    return this.invitationResolver;
  }

  logRejected(error) {
    const writer = typeof this.logger?.warn === "function" ? this.logger.warn.bind(this.logger) : null;

    writer?.("[enrollments] invitation public resolution rejected", {
      code: nullableText(readProperty(error, "code"), 96) || ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
      result: "not_available",
    });
  }
}

function toPublicInvitationDto(result = {}) {
  return Object.freeze({
    available: true,
    capabilities: Object.freeze({
      canContinue: false,
      requiresAuthentication: false,
    }),
    expiresAt: nullableText(readProperty(result, "expiresAt"), 32),
    nextStep: "WAIT_FOR_ENROLLMENT_FORM",
  });
}

function notAvailable() {
  const error = new Error("Enrollment invitation is not available.");
  error.code = RESOLVE_ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE;
  error.statusCode = 404;
  error.expose = true;
  return error;
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readProperty(value, property) {
  return value && typeof value === "object" ? value[property] ?? null : null;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "").trim().slice(0, max);
  return normalized || null;
}

module.exports = {
  RESOLVE_ENROLLMENT_INVITATION_NOT_AVAILABLE_CODE,
  ResolveEnrollmentInvitationApplicationService,
  notAvailable,
  toPublicInvitationDto,
};
