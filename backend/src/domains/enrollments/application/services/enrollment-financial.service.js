const {
  EnrollmentStatus,
  normalizeEnrollmentStatus,
} = require("../../domain/enums/enrollment-status.enum.js");
const { prepareEnrollmentFinancialLink } = require("../contracts/enrollment-financial-link.contract.js");

const ENROLLMENT_FINANCIAL_OBLIGATION_INPUT_REQUIRED_CODE =
  "ENROLLMENT_FINANCIAL_OBLIGATION_INPUT_REQUIRED";
const ENROLLMENT_FINANCIAL_OBLIGATION_ENROLLMENT_NOT_FOUND_CODE =
  "ENROLLMENT_FINANCIAL_OBLIGATION_ENROLLMENT_NOT_FOUND";
const ENROLLMENT_FINANCIAL_OBLIGATION_INVALID_ENROLLMENT_STATUS_CODE =
  "ENROLLMENT_FINANCIAL_OBLIGATION_INVALID_ENROLLMENT_STATUS";
const ENROLLMENT_FINANCIAL_OBLIGATION_STUDENT_LINK_MISSING_CODE =
  "ENROLLMENT_FINANCIAL_OBLIGATION_STUDENT_LINK_MISSING";
const ENROLLMENT_FINANCIAL_OBLIGATION_STUDENT_MISMATCH_CODE =
  "ENROLLMENT_FINANCIAL_OBLIGATION_STUDENT_MISMATCH";

/**
 * Internal preparation service for Enrollment -> Financeiro integration.
 *
 * It validates the persisted Enrollment before returning the preparation-only
 * financial contract. It does not create charges, installments or payments.
 */
class EnrollmentFinancialService {
  /**
   * @param {Object} [options]
   * @param {{ findEnrollmentById?: (id: string) => Promise<unknown|null>, findById?: (id: string) => Promise<unknown|null> }} [options.enrollmentReader]
   * @param {(payload: Record<string, unknown>) => Promise<Record<string, unknown>>} [options.financialWriter]
   */
  constructor({ enrollmentReader = null, financialWriter = null } = {}) {
    this.enrollmentReader = enrollmentReader;
    this.financialWriter = financialWriter;
  }

  /**
   * Prepares an internal financial obligation plan for an ACTIVE Enrollment.
   *
   * @param {Object} input
   * @param {string|null} [input.enrollmentId]
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @param {string|null} [input.requestedBy]
   * @param {string|null} [input.planId]
   * @param {string|null} [input.planName]
   * @param {string|null} [input.competence]
   * @param {string|null} [input.dueDate]
   * @param {number|null} [input.amount]
   * @param {Record<string, unknown>} [input.metadata]
   * @returns {Promise<Record<string, unknown>>}
   */
  async prepareEnrollmentFinancialObligation(input = {}) {
    const enrollmentId = nullableText(input.enrollmentId, 64);
    const requestedBy = nullableText(input.requestedBy, 191);

    if (!enrollmentId || !requestedBy) {
      throw controlledError(
        "prepareEnrollmentFinancialObligation requires enrollmentId and requestedBy.",
        ENROLLMENT_FINANCIAL_OBLIGATION_INPUT_REQUIRED_CODE,
        {
          hasEnrollmentId: Boolean(enrollmentId),
          hasRequestedBy: Boolean(requestedBy),
        },
      );
    }

    const enrollment = await this.findEnrollmentById(enrollmentId);

    if (!enrollment) {
      throw controlledError(
        "Enrollment was not found for financial obligation preparation.",
        ENROLLMENT_FINANCIAL_OBLIGATION_ENROLLMENT_NOT_FOUND_CODE,
        { enrollmentId },
      );
    }

    const enrollmentStatus = normalizeEnrollmentStatus(readProperty(enrollment, "status"));

    if (enrollmentStatus !== EnrollmentStatus.ACTIVE) {
      throw controlledError(
        "Only ACTIVE Enrollment can prepare a financial obligation.",
        ENROLLMENT_FINANCIAL_OBLIGATION_INVALID_ENROLLMENT_STATUS_CODE,
        {
          enrollmentId,
          enrollmentStatus,
          requiredEnrollmentStatus: EnrollmentStatus.ACTIVE,
        },
      );
    }

    const studentPersonId = readEnrollmentStudentId(enrollment, input, [
      "studentPersonId",
      "student_person_id",
    ]);
    const studentProfileId = readEnrollmentStudentId(enrollment, input, [
      "studentProfileId",
      "student_profile_id",
    ]);

    if (!studentPersonId || !studentProfileId) {
      throw controlledError(
        "Enrollment financial obligation preparation requires student person/profile ids.",
        ENROLLMENT_FINANCIAL_OBLIGATION_STUDENT_LINK_MISSING_CODE,
        {
          enrollmentId,
          hasStudentPersonId: Boolean(studentPersonId),
          hasStudentProfileId: Boolean(studentProfileId),
        },
      );
    }

    assertInputStudentMatchesEnrollment(input, {
      enrollmentId,
      studentPersonId,
      studentProfileId,
    });

    const contract = prepareEnrollmentFinancialLink({
      ...input,
      enrollmentId,
      enrollmentStatus,
      metadata: {
        operation: "prepareEnrollmentFinancialObligation",
        ...readObject(input.metadata),
      },
      requestedBy,
      studentPersonId,
      studentProfileId,
    });

    return {
      ...contract,
      duplicateFinancialObligationPreventedByNoWrite: true,
      enrollmentFound: true,
      enrollmentSnapshot: {
        id: enrollmentId,
        status: enrollmentStatus,
        studentPersonId,
        studentProfileId,
      },
      financialCreationBlockedBySchemaOrModuleGap: true,
      financialGatewayCalled: false,
      idempotency: {
        key: `enrollment:${enrollmentId}`,
        realDuplicateCheckAvailable: false,
        safeToRetry: true,
      },
    };
  }

  /**
   * Prepares an initial financial obligation for an ACTIVE Enrollment without
   * creating real charges, installments or entries.
   *
   * @param {Object} input
   * @param {string|null} [input.enrollmentId]
   * @param {string|null} [input.requestedBy]
   * @returns {Promise<Record<string, unknown>>}
   */
  async createInitialFinancialObligationForEnrollment(input = {}) {
    const enrollmentId = nullableText(input.enrollmentId, 64);
    const requestedBy = nullableText(input.requestedBy, 191);

    if (!enrollmentId || !requestedBy) {
      throw controlledError(
        "createInitialFinancialObligationForEnrollment requires enrollmentId and requestedBy.",
        ENROLLMENT_FINANCIAL_OBLIGATION_INPUT_REQUIRED_CODE,
        {
          hasEnrollmentId: Boolean(enrollmentId),
          hasRequestedBy: Boolean(requestedBy),
        },
      );
    }

    const enrollment = await this.findEnrollmentById(enrollmentId);

    if (!enrollment) {
      throw controlledError(
        "Enrollment was not found for initial financial obligation creation.",
        ENROLLMENT_FINANCIAL_OBLIGATION_ENROLLMENT_NOT_FOUND_CODE,
        { enrollmentId },
      );
    }

    const enrollmentStatus = normalizeEnrollmentStatus(readProperty(enrollment, "status"));

    if (enrollmentStatus !== EnrollmentStatus.ACTIVE) {
      throw controlledError(
        "Only ACTIVE Enrollment can create an initial financial obligation.",
        ENROLLMENT_FINANCIAL_OBLIGATION_INVALID_ENROLLMENT_STATUS_CODE,
        {
          enrollmentId,
          enrollmentStatus,
          requiredEnrollmentStatus: EnrollmentStatus.ACTIVE,
        },
      );
    }

    const studentPersonId = readEnrollmentStudentId(enrollment, input, [
      "studentPersonId",
      "student_person_id",
    ]);
    const studentProfileId = readEnrollmentStudentId(enrollment, input, [
      "studentProfileId",
      "student_profile_id",
    ]);

    if (!studentPersonId || !studentProfileId) {
      throw controlledError(
        "Enrollment initial financial obligation requires student person/profile ids.",
        ENROLLMENT_FINANCIAL_OBLIGATION_STUDENT_LINK_MISSING_CODE,
        {
          enrollmentId,
          hasStudentPersonId: Boolean(studentPersonId),
          hasStudentProfileId: Boolean(studentProfileId),
        },
      );
    }

    assertInputStudentMatchesEnrollment(input, {
      enrollmentId,
      studentPersonId,
      studentProfileId,
    });

    if (input.persist !== true) {
      return {
        blockedBySchemaOrRuleGap: true,
        chargeCreated: false,
        created: false,
        financialEntryCreated: false,
        installmentCreated: false,
        obligationId: null,
        persisted: false,
        prepared: true,
        preparationOnly: true,
        requirementsResolved: false,
        requestedBy,
        studentPersonId,
        studentProfileId,
        enrollmentId,
        enrollmentStatus,
        noChargeCreated: true,
        noFinancialEntryCreated: true,
        noInstallmentCreated: true,
        idempotency: {
          key: `enrollment:${enrollmentId}`,
          safeToRetry: true,
        },
      };
    }

    if (typeof this.financialWriter !== "function") {
      throw controlledError(
        "Financial writer is not configured for initial obligation persistence.",
        ENROLLMENT_FINANCIAL_OBLIGATION_INPUT_REQUIRED_CODE,
        { enrollmentId },
      );
    }

    const persisted = await this.financialWriter({
      enrollment: {
        id: enrollmentId,
        status: enrollmentStatus,
        studentPersonId,
        studentProfileId,
      },
      input: {
        ...input,
        enrollmentId,
        requestedBy,
        studentPersonId,
        studentProfileId,
      },
    });

    return {
      blockedBySchemaOrRuleGap: false,
      chargeCreated: Boolean(persisted?.chargeCreated),
      created: Boolean(persisted?.created),
      financialEntryCreated: Boolean(persisted?.financialEntryCreated),
      installmentCreated: Boolean(persisted?.installmentCreated),
      obligationId: persisted?.obligationId ?? null,
      persisted: Boolean(persisted?.persisted),
      prepared: true,
      preparationOnly: false,
      requirementsResolved: true,
      requestedBy,
      studentPersonId,
      studentProfileId,
      enrollmentId,
      enrollmentStatus,
      noChargeCreated: !Boolean(persisted?.chargeCreated),
      noFinancialEntryCreated: !Boolean(persisted?.financialEntryCreated),
      noInstallmentCreated: !Boolean(persisted?.installmentCreated),
      idempotency: {
        key: `enrollment:${enrollmentId}`,
        safeToRetry: true,
      },
    };
  }

  /**
   * @param {string} enrollmentId
   * @returns {Promise<unknown|null>}
   */
  async findEnrollmentById(enrollmentId) {
    const reader = this.getEnrollmentReader();

    if (typeof reader.findEnrollmentById === "function") {
      return reader.findEnrollmentById(enrollmentId);
    }

    return reader.findById(enrollmentId);
  }

  /**
   * @returns {{ findEnrollmentById?: (id: string) => Promise<unknown|null>, findById?: (id: string) => Promise<unknown|null> }}
   */
  getEnrollmentReader() {
    if (
      !this.enrollmentReader ||
      (
        typeof this.enrollmentReader.findEnrollmentById !== "function" &&
        typeof this.enrollmentReader.findById !== "function"
      )
    ) {
      throw new TypeError(
        "EnrollmentFinancialService requires an enrollmentReader.findEnrollmentById or findById function.",
      );
    }

    return this.enrollmentReader;
  }
}

/**
 * @param {unknown} enrollment
 * @param {Record<string, unknown>} input
 * @param {string[]} fields
 * @returns {string|null}
 */
function readEnrollmentStudentId(enrollment, input, fields) {
  for (const field of fields) {
    const value = nullableText(readProperty(enrollment, field), 64);

    if (value) {
      return value;
    }
  }

  for (const field of fields) {
    const value = nullableText(input[field], 64);

    if (value) {
      return value;
    }
  }

  return null;
}

/**
 * @param {Record<string, unknown>} input
 * @param {{ enrollmentId: string, studentPersonId: string, studentProfileId: string }} expected
 * @returns {void}
 */
function assertInputStudentMatchesEnrollment(input, expected) {
  const inputStudentPersonId = nullableText(input.studentPersonId ?? input.student_person_id, 64);
  const inputStudentProfileId = nullableText(input.studentProfileId ?? input.student_profile_id, 64);
  const personMismatch = inputStudentPersonId && inputStudentPersonId !== expected.studentPersonId;
  const profileMismatch = inputStudentProfileId && inputStudentProfileId !== expected.studentProfileId;

  if (!personMismatch && !profileMismatch) {
    return;
  }

  throw controlledError(
    "Enrollment financial obligation input does not match the persisted Enrollment student ids.",
    ENROLLMENT_FINANCIAL_OBLIGATION_STUDENT_MISMATCH_CODE,
    {
      enrollmentId: expected.enrollmentId,
      expectedStudentPersonId: expected.studentPersonId,
      expectedStudentProfileId: expected.studentProfileId,
      inputStudentPersonId: inputStudentPersonId || null,
      inputStudentProfileId: inputStudentProfileId || null,
    },
  );
}

/**
 * @param {unknown} value
 * @param {string} property
 * @returns {unknown|null}
 */
function readProperty(value, property) {
  return value && typeof value === "object" ? value[property] ?? null : null;
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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
 * @param {string} message
 * @param {string} code
 * @param {Record<string, unknown>} [details]
 * @returns {Error}
 */
function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;

  for (const [key, value] of Object.entries(details)) {
    error[key] = value;
  }

  return error;
}

module.exports = {
  ENROLLMENT_FINANCIAL_OBLIGATION_ENROLLMENT_NOT_FOUND_CODE,
  ENROLLMENT_FINANCIAL_OBLIGATION_INPUT_REQUIRED_CODE,
  ENROLLMENT_FINANCIAL_OBLIGATION_INVALID_ENROLLMENT_STATUS_CODE,
  ENROLLMENT_FINANCIAL_OBLIGATION_STUDENT_LINK_MISSING_CODE,
  ENROLLMENT_FINANCIAL_OBLIGATION_STUDENT_MISMATCH_CODE,
  EnrollmentFinancialService,
};
