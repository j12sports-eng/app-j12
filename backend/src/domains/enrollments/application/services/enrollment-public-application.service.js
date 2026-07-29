const { normalizeEnrollmentStatus } = require("../../domain/enums/enrollment-status.enum.js");
const {
  EnrollmentDigitalInvitationStatus,
  normalizeEnrollmentDigitalInvitationStatus,
} = require("../../domain/enums/enrollment-digital-invitation-status.enum.js");
const { isValidRawToken } = require("./enrollment-digital-invitation.service.js");

const ENROLLMENT_PUBLIC_NOT_AVAILABLE_CODE = "ENROLLMENT_PUBLIC_NOT_AVAILABLE";
const ENROLLMENT_PUBLIC_FIELDS = new Set(["token"]);

class EnrollmentPublicApplicationError extends Error {
  constructor() {
    super("Digital Enrollment invitation is not available.");
    this.name = "EnrollmentPublicApplicationError";
    this.code = ENROLLMENT_PUBLIC_NOT_AVAILABLE_CODE;
    this.statusCode = 404;
    this.expose = true;
  }
}

/**
 * Public application boundary for Sprint 29.3E.
 *
 * Token hashing, invitation lookup and invitation state rules remain owned by
 * EnrollmentDigitalInvitationService. This service only coordinates the safe
 * Enrollment projection and builds the allowlisted public DTO.
 */
class EnrollmentPublicApplicationService {
  constructor({ enrollmentReader = null, invitationService = null, logger = null } = {}) {
    this.enrollmentReader = enrollmentReader;
    this.invitationService = invitationService;
    this.logger = logger;
  }

  async resolveDigitalEnrollmentByToken(command = {}) {
    const safeCommand = readObject(command);
    const unexpectedFields = Object.keys(safeCommand).filter(
      (field) => !ENROLLMENT_PUBLIC_FIELDS.has(field),
    );
    const rawToken = nullableText(safeCommand.token, 256);

    if (unexpectedFields.length > 0 || !isValidRawToken(rawToken)) {
      throw notAvailable();
    }

    try {
      const resolved = await this.getInvitationService().resolveInvitationByRawToken({
        rawToken,
      });
      const enrollment = await this.loadPublicEnrollment(resolved);

      return toEnrollmentPublicDto({ enrollment, invitation: resolved });
    } catch (error) {
      this.logRejected(error);
      throw notAvailable();
    }
  }

  async loadPublicEnrollment(resolved = {}) {
    const enrollmentId = nullableText(readProperty(resolved, "enrollmentId"), 64);
    const unitId = nullableText(readProperty(resolved, "unitId"), 64);
    if (!enrollmentId || !unitId) throw notAvailable();

    const reader = this.enrollmentReader;
    const enrollment =
      typeof reader?.findPublicById === "function"
        ? await reader.findPublicById({ enrollmentId, unitId })
        : readProperty(resolved, "enrollment");

    if (!enrollment || typeof enrollment !== "object") throw notAvailable();

    const projectedEnrollmentId = nullableText(
      readProperty(enrollment, "enrollmentId") ?? readProperty(enrollment, "id"),
      64,
    );
    const projectedUnitId = nullableText(
      readProperty(enrollment, "unitId") ?? readProperty(enrollment, "unit_id"),
      64,
    );
    const status = normalizeEnrollmentStatus(readProperty(enrollment, "status"));

    if (
      projectedEnrollmentId !== enrollmentId ||
      projectedUnitId !== unitId ||
      status !== "DRAFT"
    ) {
      throw notAvailable();
    }

    return enrollment;
  }

  getInvitationService() {
    if (
      !this.invitationService ||
      typeof this.invitationService.resolveInvitationByRawToken !== "function"
    ) {
      throw new TypeError(
        "EnrollmentPublicApplicationService requires EnrollmentDigitalInvitationService.",
      );
    }
    return this.invitationService;
  }

  logRejected(error) {
    const writer =
      typeof this.logger?.warn === "function" ? this.logger.warn.bind(this.logger) : null;
    writer?.("[enrollments] digital public access rejected", {
      code: nullableText(readProperty(error, "code"), 96) || "UNEXPECTED_ERROR",
      result: "not_available",
    });
  }
}

function toEnrollmentPublicDto({ enrollment = {}, invitation = {} } = {}) {
  const status = normalizeEnrollmentDigitalInvitationStatus(readProperty(invitation, "status"));
  const expiresAt = nullableText(readProperty(invitation, "expiresAt"), 32);
  if (status !== EnrollmentDigitalInvitationStatus.ACTIVE || !expiresAt) {
    throw notAvailable();
  }

  const student = readObject(readProperty(enrollment, "student"));
  return Object.freeze({
    student: Object.freeze({
      name: nullableText(
        readProperty(student, "name") ?? readProperty(enrollment, "studentName"),
        191,
      ),
      birthDate: normalizeDate(
        readProperty(student, "birthDate") ?? readProperty(enrollment, "studentBirthDate"),
      ),
      gender: nullableText(
        readProperty(student, "gender") ?? readProperty(enrollment, "studentGender"),
        30,
      ),
    }),
    invitation: Object.freeze({
      status: EnrollmentDigitalInvitationStatus.ACTIVE,
      expiresAt,
    }),
  });
}

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const normalized = nullableText(value, 32);
  return normalized ? normalized.slice(0, 10) : null;
}

function notAvailable() {
  return new EnrollmentPublicApplicationError();
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readProperty(value, property) {
  return value && typeof value === "object" ? (value[property] ?? null) : null;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

module.exports = {
  ENROLLMENT_PUBLIC_NOT_AVAILABLE_CODE,
  EnrollmentPublicApplicationError,
  EnrollmentPublicApplicationService,
  notAvailable,
  toEnrollmentPublicDto,
};
