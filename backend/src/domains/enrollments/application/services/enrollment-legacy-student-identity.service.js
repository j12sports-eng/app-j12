const ENROLLMENT_IDENTITY_INPUT_REQUIRED = "ENROLLMENT_IDENTITY_INPUT_REQUIRED";
const ENROLLMENT_IDENTITY_ENROLLMENT_NOT_FOUND = "ENROLLMENT_IDENTITY_ENROLLMENT_NOT_FOUND";
const ENROLLMENT_IDENTITY_PERSON_NOT_FOUND = "ENROLLMENT_IDENTITY_PERSON_NOT_FOUND";
const ENROLLMENT_IDENTITY_PROFILE_NOT_FOUND = "ENROLLMENT_IDENTITY_PROFILE_NOT_FOUND";
const ENROLLMENT_IDENTITY_LEGACY_STUDENT_NOT_FOUND = "ENROLLMENT_IDENTITY_LEGACY_STUDENT_NOT_FOUND";
const ENROLLMENT_IDENTITY_DUPLICATE = "ENROLLMENT_IDENTITY_DUPLICATE";

/**
 * Resolves the canonical identity required by modern Enrollment consumers.
 * The legacy id must be explicit; mutable personal data is never inferred.
 */
class EnrollmentLegacyStudentIdentityService {
  constructor({ identityReader = null } = {}) {
    this.identityReader = identityReader;
  }

  async resolve(enrollment) {
    const identity = readEnrollmentIdentity(enrollment);
    const rows = await this.getIdentityReader().resolveEnrollmentLegacyStudentIdentity(identity);
    const matches = normalizeRows(rows);

    if (matches.length > 1) {
      throw controlledError(
        "Canonical Enrollment identity resolved more than one legacy student.",
        ENROLLMENT_IDENTITY_DUPLICATE,
        identity,
      );
    }

    const match = matches[0] || {};
    assertResolved(
      match,
      "enrollmentId",
      "enrollment_id",
      ENROLLMENT_IDENTITY_ENROLLMENT_NOT_FOUND,
      "Enrollment was not found for canonical identity resolution.",
      identity,
    );
    assertResolved(
      match,
      "personId",
      "person_id",
      ENROLLMENT_IDENTITY_PERSON_NOT_FOUND,
      "Person was not found for canonical Enrollment identity resolution.",
      identity,
    );
    assertResolved(
      match,
      "profileId",
      "profile_id",
      ENROLLMENT_IDENTITY_PROFILE_NOT_FOUND,
      "Student Profile was not found or is inconsistent with Person.",
      identity,
    );
    assertResolved(
      match,
      "legacyStudentId",
      "legacy_student_id",
      ENROLLMENT_IDENTITY_LEGACY_STUDENT_NOT_FOUND,
      "Explicit legacy student was not found for canonical Enrollment identity resolution.",
      identity,
    );

    return Object.freeze({
      enrollment_id: identity.enrollmentId,
      legacy_student_id: identity.legacyStudentId,
      person_id: identity.personId,
      profile_id: identity.profileId,
    });
  }

  getIdentityReader() {
    if (typeof this.identityReader?.resolveEnrollmentLegacyStudentIdentity !== "function") {
      throw new TypeError("EnrollmentLegacyStudentIdentityService requires an identity reader.");
    }
    return this.identityReader;
  }
}

function readEnrollmentIdentity(enrollment) {
  if (!enrollment || typeof enrollment !== "object" || Array.isArray(enrollment)) {
    throw controlledError(
      "Canonical identity resolution requires an Enrollment object.",
      ENROLLMENT_IDENTITY_INPUT_REQUIRED,
    );
  }

  const identity = {
    enrollmentId: nullableText(enrollment.id ?? enrollment.enrollmentId, 64),
    legacyStudentId: nullableText(enrollment.legacyStudentId ?? enrollment.legacy_student_id, 64),
    personId: nullableText(enrollment.studentPersonId ?? enrollment.student_person_id, 64),
    profileId: nullableText(enrollment.studentProfileId ?? enrollment.student_profile_id, 64),
  };
  const missingFields = Object.entries(identity)
    .filter(([, value]) => !value)
    .map(([field]) => field);

  if (missingFields.length > 0) {
    throw controlledError(
      "Enrollment lacks explicit identifiers required for canonical legacy student resolution.",
      ENROLLMENT_IDENTITY_INPUT_REQUIRED,
      { missingFields },
    );
  }
  return identity;
}

function assertResolved(match, camelKey, snakeKey, code, message, details) {
  if (!nullableText(match[camelKey] ?? match[snakeKey], 64)) {
    throw controlledError(message, code, details);
  }
}

function normalizeRows(value) {
  if (!Array.isArray(value)) return [];
  return Array.isArray(value[0]) ? value[0] : value;
}

function nullableText(value, max) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

module.exports = {
  ENROLLMENT_IDENTITY_DUPLICATE,
  ENROLLMENT_IDENTITY_ENROLLMENT_NOT_FOUND,
  ENROLLMENT_IDENTITY_INPUT_REQUIRED,
  ENROLLMENT_IDENTITY_LEGACY_STUDENT_NOT_FOUND,
  ENROLLMENT_IDENTITY_PERSON_NOT_FOUND,
  ENROLLMENT_IDENTITY_PROFILE_NOT_FOUND,
  EnrollmentLegacyStudentIdentityService,
  readEnrollmentIdentity,
};
