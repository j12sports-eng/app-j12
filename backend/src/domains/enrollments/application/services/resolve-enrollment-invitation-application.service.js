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
  const enrollment = readObject(readProperty(result, "enrollment"));

  return Object.freeze({
    enrollment: Object.freeze({
      enrollmentId: nullableText(readProperty(enrollment, "enrollmentId"), 64),
      status: nullableText(readProperty(enrollment, "status"), 32),
    }),
    enrollmentId: nullableText(readProperty(result, "enrollmentId"), 64),
    expiresAt: nullableText(readProperty(result, "expiresAt"), 32),
    invitationId: nullableText(readProperty(result, "invitationId"), 64),
    status: nullableText(readProperty(result, "status"), 32),
    unitId: nullableText(readProperty(result, "unitId"), 64),
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
