const { AppError } = require("../../../../errors/app-error.js");
const { normalizeCanonicalUnitId } = require("../../domain/entities/enrollment.entity.js");

const STUDENT_ENROLLMENT_ERROR_CODES = Object.freeze({
  ACTIVE_EXISTS: "ENROLLMENT_ACTIVE_EXISTS",
  DATA_INCOMPLETE: "ENROLLMENT_DATA_INCOMPLETE",
  DRAFT_CREATION_FAILED: "ENROLLMENT_DRAFT_CREATION_FAILED",
  RESOLUTION_FAILED: "ENROLLMENT_RESOLUTION_FAILED",
  STATE_CONFLICT: "ENROLLMENT_STATE_CONFLICT",
});

/** Coordinates canonical Aluno resolution with modern DRAFT Enrollment. */
class StudentEnrollmentApplicationService {
  constructor({ studentApplicationService = null, enrollmentApplicationService = null } = {}) {
    this.studentApplicationService = studentApplicationService;
    this.enrollmentApplicationService = enrollmentApplicationService;
  }

  async resolveStudentAndCreateDraftEnrollment(input = {}, context = {}) {
    const source = normalizeObject(input);
    const studentResolution = await this.getStudentApplicationService().resolveOrCreateStudent(
      normalizeObject(source.student),
      context,
    );
    const enrollmentResolution = await this.resolveOrCreateDraftEnrollmentForResolvedStudent(
      {
        personId: studentResolution.personId,
        personProfileId: studentResolution.personProfileId,
        startDate: normalizeObject(source.enrollment).startDate,
      },
      context,
    );

    return buildResult(studentResolution, enrollmentResolution);
  }

  /** Creates or reuses a DRAFT after Pessoa and Aluno profile were resolved upstream. */
  async resolveOrCreateDraftEnrollmentForResolvedStudent(input = {}, context = {}) {
    const source = normalizeObject(input);
    const personId = nullableText(source.personId);
    const personProfileId = nullableText(source.personProfileId);
    const startDate = nullableText(source.startDate);
    const unitId = readCanonicalUnitId(context);
    const missing = [
      ["personId", personId],
      ["personProfileId", personProfileId],
      ["startDate", startDate],
      ["unitId", unitId],
    ]
      .filter(([, value]) => !value)
      .map(([field]) => field);
    if (missing.length) {
      throw applicationError(
        "Enrollment data is incomplete.",
        STUDENT_ENROLLMENT_ERROR_CODES.DATA_INCOMPLETE,
        422,
        { fields: missing },
      );
    }

    const scope = {
      studentPersonId: personId,
      studentProfileId: personProfileId,
      unitId,
    };
    const enrollmentService = this.getEnrollmentApplicationService();
    let summary;
    try {
      summary = await enrollmentService.getEnrollmentStatusSummary(scope);
    } catch {
      throw applicationError(
        "Enrollment resolution failed.",
        STUDENT_ENROLLMENT_ERROR_CODES.RESOLUTION_FAILED,
        500,
      );
    }

    if (!summary || !["NONE", "DRAFT", "ACTIVE", "CONFLICT"].includes(summary.status)) {
      throw applicationError(
        "Enrollment resolution failed.",
        STUDENT_ENROLLMENT_ERROR_CODES.RESOLUTION_FAILED,
        500,
      );
    }
    if (summary.status === "ACTIVE") {
      throw applicationError(
        "An active Enrollment already exists.",
        STUDENT_ENROLLMENT_ERROR_CODES.ACTIVE_EXISTS,
        409,
      );
    }
    if (summary.status === "CONFLICT") {
      throw applicationError(
        "Enrollment state conflict requires assisted review.",
        STUDENT_ENROLLMENT_ERROR_CODES.STATE_CONFLICT,
        409,
      );
    }
    if (summary.status === "DRAFT")
      return buildEnrollmentResult(summary.draftEnrollment, false, true, unitId);

    let creation;
    try {
      creation = await enrollmentService.createDraftEnrollmentIdempotently({ ...scope, startDate });
    } catch {
      throw applicationError(
        "Draft Enrollment creation failed.",
        STUDENT_ENROLLMENT_ERROR_CODES.DRAFT_CREATION_FAILED,
        500,
      );
    }

    const draftEnrollment = creation?.draftEnrollment ?? null;
    if (!draftEnrollment || readProperty(draftEnrollment, "status") !== "DRAFT") {
      throw applicationError(
        "Draft Enrollment creation failed.",
        STUDENT_ENROLLMENT_ERROR_CODES.DRAFT_CREATION_FAILED,
        500,
      );
    }
    return buildEnrollmentResult(
      draftEnrollment,
      Boolean(creation.created),
      Boolean(creation.reused),
      unitId,
    );
  }

  getStudentApplicationService() {
    if (typeof this.studentApplicationService?.resolveOrCreateStudent !== "function") {
      throw new TypeError(
        "StudentEnrollmentApplicationService requires a studentApplicationService.resolveOrCreateStudent function.",
      );
    }
    return this.studentApplicationService;
  }

  getEnrollmentApplicationService() {
    const service = this.enrollmentApplicationService;
    if (
      typeof service?.getEnrollmentStatusSummary !== "function" ||
      typeof service?.createDraftEnrollmentIdempotently !== "function"
    ) {
      throw new TypeError(
        "StudentEnrollmentApplicationService requires the modern Enrollment application contract.",
      );
    }
    return service;
  }
}

function buildEnrollmentResult(enrollment, created, reused, unitId) {
  const enrollmentId = nullableText(readProperty(enrollment, "id"));
  const enrollmentUnitId = readCanonicalUnitId(enrollment);
  if (!enrollmentId || !enrollmentUnitId || enrollmentUnitId !== unitId)
    throw applicationError(
      "Draft Enrollment creation failed.",
      STUDENT_ENROLLMENT_ERROR_CODES.DRAFT_CREATION_FAILED,
      500,
    );
  return Object.freeze({
    enrollmentId,
    enrollmentStatus: "DRAFT",
    resolution: created ? "CREATED" : "FOUND",
    reused,
  });
}

function buildResult(student, enrollment) {
  return Object.freeze({
    enrollmentId: enrollment.enrollmentId,
    enrollmentStatus: enrollment.enrollmentStatus,
    personId: student.personId,
    personProfileId: student.personProfileId,
    resolutions: Object.freeze({
      enrollment: enrollment.resolution,
      person: student.personResolution,
      profile: student.profileResolution,
    }),
    reused: Object.freeze({
      enrollment: enrollment.reused,
      person: Boolean(student.reused?.person),
      profile: Boolean(student.reused?.profile),
    }),
  });
}

function applicationError(message, code, statusCode, details = null) {
  return new AppError(message, { code, details, expose: statusCode < 500, statusCode });
}
function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function nullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}
function readProperty(value, property) {
  return value && typeof value === "object" ? (value[property] ?? null) : null;
}

function readCanonicalUnitId(value) {
  try {
    return normalizeCanonicalUnitId(readProperty(value, "unitId"), { nullable: true });
  } catch {
    return null;
  }
}

module.exports = { STUDENT_ENROLLMENT_ERROR_CODES, StudentEnrollmentApplicationService };
