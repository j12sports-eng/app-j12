const CRM_LEAD_ENROLLMENT_CONVERSION_ERROR_CODES = Object.freeze({
  CONFLICT: "CRM_LEAD_ENROLLMENT_CONFLICT",
  FAILED: "CRM_LEAD_ENROLLMENT_CONVERSION_FAILED",
});

const TOP_LEVEL_FIELDS = new Set(["enrollmentData", "idempotencyKey", "leadId", "studentData"]);
const ENROLLMENT_FIELDS = new Set(["startDate"]);

/** Orchestrates the resumable CRM Lead -> canonical Aluno -> DRAFT flow. */
class CrmLeadEnrollmentConversionService {
  constructor({
    leadStudentConversionService = null,
    enrollmentBoundary = null,
    enrollmentConversionRepository = null,
    authorizeUnit = () => true,
    now = () => new Date(),
  } = {}) {
    this.leadStudentConversionService = leadStudentConversionService;
    this.enrollmentBoundary = enrollmentBoundary;
    this.enrollmentConversionRepository = enrollmentConversionRepository;
    this.authorizeUnit = authorizeUnit;
    this.now = now;
  }

  async convertLeadToDraftEnrollment(input = {}, context = {}) {
    const source = object(input);
    const unitId = text(context.unitId);
    this.authorize(context, unitId);
    assertAllowedFields(source, TOP_LEVEL_FIELDS, "");

    const leadId = text(source.leadId);
    if (!leadId) throw crmError("CRM leadId required.", "CRM_INPUT_INVALID", 422);
    const repository = this.getEnrollmentConversionRepository();
    let existing;
    try {
      existing = await repository.findByLeadId({ leadId, unitId });
    } catch {
      throw crmError(
        "CRM Lead Enrollment conversion failed.",
        CRM_LEAD_ENROLLMENT_CONVERSION_ERROR_CODES.FAILED,
        500,
      );
    }
    if (existing) return resultFromExisting(existing);

    const enrollmentData = object(source.enrollmentData);
    assertAllowedFields(enrollmentData, ENROLLMENT_FIELDS, "enrollmentData.");
    const startDate = text(enrollmentData.startDate);
    if (!startDate) {
      throw crmError("CRM enrollment data is incomplete.", "CRM_CONVERSION_DATA_INCOMPLETE", 422, {
        fields: ["enrollmentData.startDate"],
      });
    }
    const idempotencyKey = prepareIdempotencyKey(source.idempotencyKey, leadId);

    const student = await this.getLeadStudentConversionService().convertLeadToStudent(
      { leadId, studentData: source.studentData },
      context,
    );
    let enrollment;
    try {
      enrollment =
        await this.getEnrollmentBoundary().resolveOrCreateDraftEnrollmentForResolvedStudent(
          {
            personId: student.personId,
            personProfileId: student.personProfileId,
            startDate,
          },
          context,
        );
    } catch (error) {
      if (isEnrollmentStateError(error)) throw error;
      throw crmError(
        "CRM Lead Enrollment conversion failed.",
        CRM_LEAD_ENROLLMENT_CONVERSION_ERROR_CODES.FAILED,
        500,
      );
    }
    assertDraftResolution(enrollment);

    let persisted;
    try {
      persisted = await repository.create({
        convertedAt: this.now().toISOString(),
        convertedBy: context.userId,
        enrollmentId: enrollment.enrollmentId,
        enrollmentStatus: "DRAFT",
        idempotencyKey,
        leadId,
        personId: student.personId,
        personProfileId: student.personProfileId,
        status: "COMPLETED",
        unitId,
      });
    } catch (error) {
      if (error?.code === CRM_LEAD_ENROLLMENT_CONVERSION_ERROR_CODES.CONFLICT) throw error;
      throw crmError(
        "CRM Lead Enrollment conversion failed.",
        CRM_LEAD_ENROLLMENT_CONVERSION_ERROR_CODES.FAILED,
        500,
      );
    }

    const conversion = persisted?.conversion;
    if (!conversion || !isCompatible(conversion, student, enrollment)) {
      throw crmError(
        "CRM Lead Enrollment conversion conflict.",
        CRM_LEAD_ENROLLMENT_CONVERSION_ERROR_CODES.CONFLICT,
        409,
      );
    }
    return buildResult({ conversion, enrollment, student });
  }

  authorize(context, unitId) {
    if (!context?.userId || !unitId || !this.authorizeUnit(context, unitId)) {
      throw crmError("CRM access denied.", "CRM_ACCESS_DENIED", 403);
    }
  }

  getLeadStudentConversionService() {
    if (typeof this.leadStudentConversionService?.convertLeadToStudent !== "function") {
      throw new TypeError("CRM Lead student conversion service is required.");
    }
    return this.leadStudentConversionService;
  }

  getEnrollmentBoundary() {
    if (
      typeof this.enrollmentBoundary?.resolveOrCreateDraftEnrollmentForResolvedStudent !==
      "function"
    ) {
      throw new TypeError("Enrollment resolved-student boundary is required.");
    }
    return this.enrollmentBoundary;
  }

  getEnrollmentConversionRepository() {
    if (
      typeof this.enrollmentConversionRepository?.findByLeadId !== "function" ||
      typeof this.enrollmentConversionRepository?.create !== "function"
    ) {
      throw new TypeError("CRM Lead Enrollment conversion repository is required.");
    }
    return this.enrollmentConversionRepository;
  }
}

function buildResult({ conversion, enrollment, student }) {
  return Object.freeze({
    conversionStatus: "COMPLETED",
    enrollmentId: conversion.enrollmentId,
    enrollmentStatus: "DRAFT",
    leadId: conversion.leadId,
    personId: conversion.personId,
    personProfileId: conversion.personProfileId,
    resolutions: Object.freeze({
      enrollment: enrollment.resolution,
      person: student.resolutions.person,
      profile: student.resolutions.profile,
    }),
    reused: Object.freeze({
      enrollment: Boolean(enrollment.reused),
      person: Boolean(student.reused.person),
      profile: Boolean(student.reused.profile),
    }),
  });
}

function resultFromExisting(conversion) {
  if (!isComplete(conversion)) {
    throw crmError(
      "CRM Lead Enrollment conversion conflict.",
      CRM_LEAD_ENROLLMENT_CONVERSION_ERROR_CODES.CONFLICT,
      409,
    );
  }
  return Object.freeze({
    conversionStatus: "COMPLETED",
    enrollmentId: conversion.enrollmentId,
    enrollmentStatus: "DRAFT",
    leadId: conversion.leadId,
    personId: conversion.personId,
    personProfileId: conversion.personProfileId,
    resolutions: Object.freeze({ enrollment: "FOUND", person: "FOUND", profile: "FOUND" }),
    reused: Object.freeze({ enrollment: true, person: true, profile: true }),
  });
}

function assertDraftResolution(value) {
  if (
    !value ||
    !text(value.enrollmentId) ||
    value.enrollmentStatus !== "DRAFT" ||
    !["CREATED", "FOUND"].includes(value.resolution)
  ) {
    throw crmError(
      "CRM Lead Enrollment conversion failed.",
      CRM_LEAD_ENROLLMENT_CONVERSION_ERROR_CODES.FAILED,
      500,
    );
  }
}

function isCompatible(conversion, student, enrollment) {
  return (
    isComplete(conversion) &&
    conversion.personId === student.personId &&
    conversion.personProfileId === student.personProfileId &&
    conversion.enrollmentId === enrollment.enrollmentId
  );
}

function isComplete(conversion) {
  return Boolean(
    conversion?.leadId &&
    conversion.personId &&
    conversion.personProfileId &&
    conversion.enrollmentId &&
    conversion.enrollmentStatus === "DRAFT" &&
    conversion.status === "COMPLETED",
  );
}

function isEnrollmentStateError(error) {
  return new Set([
    "ENROLLMENT_ACTIVE_EXISTS",
    "ENROLLMENT_DATA_INCOMPLETE",
    "ENROLLMENT_DRAFT_CREATION_FAILED",
    "ENROLLMENT_RESOLUTION_FAILED",
    "ENROLLMENT_STATE_CONFLICT",
  ]).has(error?.code);
}

function prepareIdempotencyKey(value, leadId) {
  const key = text(value) || `crm-lead-enrollment:${leadId}`;
  if (key.length > 191) {
    throw crmError("CRM idempotency key is invalid.", "CRM_INPUT_INVALID", 422, {
      fields: ["idempotencyKey"],
    });
  }
  return key;
}

function assertAllowedFields(source, allowed, prefix) {
  const fields = Object.keys(source)
    .filter((field) => !allowed.has(field))
    .map((field) => `${prefix}${field}`);
  if (fields.length) {
    throw crmError("CRM conversion input is invalid.", "CRM_INPUT_INVALID", 422, { fields });
  }
}

function crmError(message, code, statusCode, details = null) {
  return Object.assign(new Error(message), { code, details, expose: statusCode < 500, statusCode });
}
function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function text(value) {
  return String(value ?? "").trim();
}

module.exports = {
  CRM_LEAD_ENROLLMENT_CONVERSION_ERROR_CODES,
  CrmLeadEnrollmentConversionService,
  assertDraftResolution,
  resultFromExisting,
};
