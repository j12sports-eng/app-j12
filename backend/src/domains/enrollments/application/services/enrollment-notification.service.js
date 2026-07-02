const { normalizeEnrollmentStatus } = require("../../domain/enums/enrollment-status.enum.js");
const {
  EnrollmentNotificationEventType,
  prepareEnrollmentNotification,
} = require("../contracts/enrollment-notification.contract.js");

const ENROLLMENT_NOTIFICATION_PREPARATION_INPUT_REQUIRED_CODE =
  "ENROLLMENT_NOTIFICATION_PREPARATION_INPUT_REQUIRED";
const ENROLLMENT_NOTIFICATION_PREPARATION_ENROLLMENT_NOT_FOUND_CODE =
  "ENROLLMENT_NOTIFICATION_PREPARATION_ENROLLMENT_NOT_FOUND";
const ENROLLMENT_NOTIFICATION_PREPARATION_STUDENT_LINK_MISSING_CODE =
  "ENROLLMENT_NOTIFICATION_PREPARATION_STUDENT_LINK_MISSING";
const ENROLLMENT_NOTIFICATION_PREPARATION_STUDENT_MISMATCH_CODE =
  "ENROLLMENT_NOTIFICATION_PREPARATION_STUDENT_MISMATCH";

/**
 * Internal preparation service for Enrollment -> Notificacoes integration.
 *
 * It validates a persisted Enrollment and returns the notification contract.
 * It does not create in-app notifications, emit Socket.IO events, send e-mail,
 * send WhatsApp messages or send push notifications.
 */
class EnrollmentNotificationService {
  /**
   * @param {Object} [options]
   * @param {{ findEnrollmentById?: (id: string) => Promise<unknown|null>, findById?: (id: string) => Promise<unknown|null> }} [options.enrollmentReader]
   */
  constructor({ enrollmentReader = null } = {}) {
    this.enrollmentReader = enrollmentReader;
  }

  /**
   * Prepares an internal no-send notification plan for an Enrollment event.
   *
   * @param {Object} input
   * @param {string|null} [input.enrollmentId]
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @param {string|null} [input.eventType]
   * @param {string|null} [input.requestedBy]
   * @param {Record<string, unknown>} [input.metadata]
   * @returns {Promise<Record<string, unknown>>}
   */
  async prepareEnrollmentNotification(input = {}) {
    const enrollmentId = nullableText(input.enrollmentId, 64);
    const eventType = nullableText(input.eventType, 64);
    const requestedBy = nullableText(input.requestedBy, 191);

    if (!enrollmentId || !eventType || !requestedBy) {
      throw controlledError(
        "prepareEnrollmentNotification requires enrollmentId, eventType and requestedBy.",
        ENROLLMENT_NOTIFICATION_PREPARATION_INPUT_REQUIRED_CODE,
        {
          hasEnrollmentId: Boolean(enrollmentId),
          hasEventType: Boolean(eventType),
          hasRequestedBy: Boolean(requestedBy),
        },
      );
    }

    const enrollment = await this.findEnrollmentById(enrollmentId);

    if (!enrollment) {
      throw controlledError(
        "Enrollment was not found for notification preparation.",
        ENROLLMENT_NOTIFICATION_PREPARATION_ENROLLMENT_NOT_FOUND_CODE,
        { enrollmentId },
      );
    }

    const enrollmentStatus =
      normalizeEnrollmentStatus(readProperty(enrollment, "status")) ||
      nullableText(readProperty(enrollment, "status"), 32);
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
        "Enrollment notification preparation requires student person/profile ids.",
        ENROLLMENT_NOTIFICATION_PREPARATION_STUDENT_LINK_MISSING_CODE,
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

    const contract = prepareEnrollmentNotification({
      ...input,
      enrollmentId,
      enrollmentStatus,
      metadata: {
        operation: "prepareEnrollmentNotification",
        ...readObject(input.metadata),
      },
      requestedBy,
      studentPersonId,
      studentProfileId,
    });

    return {
      ...contract,
      duplicateNotificationPreventedByNoWrite: true,
      enrollmentFound: true,
      enrollmentSnapshot: {
        id: enrollmentId,
        status: enrollmentStatus,
        studentPersonId,
        studentProfileId,
      },
      idempotency: {
        key: `enrollment:${enrollmentId}:event:${contract.eventType}`,
        realDuplicateCheckAvailable: false,
        safeToRetry: true,
      },
      notificationDispatcherCalled: false,
      socketEventEmitted: false,
    };
  }

  /**
   * Prepares a no-send notification contract from an internal Enrollment event.
   * The event payload is intentionally reduced to stable identifiers only.
   *
   * @param {Object} input
   * @param {string|null} [input.eventType]
   * @param {string|null} [input.enrollmentId]
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @param {string|null} [input.occurredAt]
   * @param {Record<string, unknown>} [input.payload]
   * @param {string|null} [input.requestedBy]
   * @returns {Promise<Record<string, unknown>>}
   */
  async prepareEnrollmentNotificationFromEvent(input = {}) {
    const occurredAt = nullableText(input.occurredAt, 40) || new Date().toISOString();
    const unsafePayloadProvided = Boolean(
      input.payload && typeof input.payload === "object" && !Array.isArray(input.payload),
    );
    const contract = await this.prepareEnrollmentNotification({
      enrollmentId: input.enrollmentId,
      eventType: input.eventType,
      metadata: {
        operation: "prepareEnrollmentNotificationFromEvent",
        eventPayloadSanitized: true,
        unsafePayloadDropped: unsafePayloadProvided,
        ...readObject(input.metadata),
      },
      occurredAt,
      requestedBy: input.requestedBy,
      studentPersonId: input.studentPersonId,
      studentProfileId: input.studentProfileId,
    });

    return {
      ...contract,
      noEmailSent: true,
      noPushSent: true,
      noWhatsappSent: true,
      notificationContractDocumented: true,
      notificationCreationBlockedBySchemaOrInfraGap:
        contract.notificationCreationBlockedBySchemaOrModuleGap === true,
      notificationModuleMapped: true,
      notificationPreparedFromEvent: true,
      officialFlowStillWorking: true,
      unsafePayloadDropped: unsafePayloadProvided,
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
        "EnrollmentNotificationService requires an enrollmentReader.findEnrollmentById or findById function.",
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
    "Enrollment notification input does not match the persisted Enrollment student ids.",
    ENROLLMENT_NOTIFICATION_PREPARATION_STUDENT_MISMATCH_CODE,
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
  ENROLLMENT_NOTIFICATION_PREPARATION_ENROLLMENT_NOT_FOUND_CODE,
  ENROLLMENT_NOTIFICATION_PREPARATION_INPUT_REQUIRED_CODE,
  ENROLLMENT_NOTIFICATION_PREPARATION_STUDENT_LINK_MISSING_CODE,
  ENROLLMENT_NOTIFICATION_PREPARATION_STUDENT_MISMATCH_CODE,
  EnrollmentNotificationEventType,
  EnrollmentNotificationService,
};
