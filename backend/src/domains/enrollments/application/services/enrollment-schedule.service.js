const {
  EnrollmentStatus,
  normalizeEnrollmentStatus,
} = require("../../domain/enums/enrollment-status.enum.js");
const { prepareEnrollmentScheduleLink } = require("../contracts/enrollment-schedule.contract.js");

const ENROLLMENT_SCHEDULE_PREPARATION_INPUT_REQUIRED_CODE =
  "ENROLLMENT_SCHEDULE_PREPARATION_INPUT_REQUIRED";
const ENROLLMENT_SCHEDULE_PREPARATION_ENROLLMENT_NOT_FOUND_CODE =
  "ENROLLMENT_SCHEDULE_PREPARATION_ENROLLMENT_NOT_FOUND";
const ENROLLMENT_SCHEDULE_PREPARATION_INVALID_ENROLLMENT_STATUS_CODE =
  "ENROLLMENT_SCHEDULE_PREPARATION_INVALID_ENROLLMENT_STATUS";
const ENROLLMENT_SCHEDULE_PREPARATION_STUDENT_LINK_MISSING_CODE =
  "ENROLLMENT_SCHEDULE_PREPARATION_STUDENT_LINK_MISSING";
const ENROLLMENT_SCHEDULE_PREPARATION_STUDENT_MISMATCH_CODE =
  "ENROLLMENT_SCHEDULE_PREPARATION_STUDENT_MISMATCH";
const ENROLLMENT_SCHEDULE_PREPARATION_ACTIVE_CLASS_LINK_MISSING_CODE =
  "ENROLLMENT_SCHEDULE_PREPARATION_ACTIVE_CLASS_LINK_MISSING";
const ENROLLMENT_SCHEDULE_PREPARATION_CLASS_SCHEDULE_MISSING_CODE =
  "ENROLLMENT_SCHEDULE_PREPARATION_CLASS_SCHEDULE_MISSING";

/**
 * Internal preparation service for Enrollment -> Agenda integration.
 *
 * It validates the persisted Enrollment and returns the schedule contract.
 * It does not create agenda rows, attendance records, financial entries or
 * notifications.
 */
class EnrollmentScheduleService {
  /**
   * @param {Object} [options]
   * @param {{ findEnrollmentById?: (id: string) => Promise<unknown|null>, findById?: (id: string) => Promise<unknown|null> }} [options.enrollmentReader]
   * @param {{ findActiveByEnrollmentAndClass?: (input: Record<string, unknown>) => Promise<unknown|null>, findActiveEnrollmentClassLink?: (input: Record<string, unknown>) => Promise<unknown|null> }} [options.classLinkReader]
   * @param {{ findClassById?: (id: string|number) => Promise<unknown|null>, findById?: (id: string|number) => Promise<unknown|null> }} [options.classReader]
   */
  constructor({ classLinkReader = null, classReader = null, enrollmentReader = null } = {}) {
    this.classLinkReader = classLinkReader;
    this.classReader = classReader;
    this.enrollmentReader = enrollmentReader;
  }

  /**
   * Prepares an internal schedule link plan for an ACTIVE Enrollment.
   *
   * @param {Object} input
   * @param {string|null} [input.enrollmentId]
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @param {string|null} [input.classId]
   * @param {string|null} [input.turmaId]
   * @param {string|null} [input.requestedBy]
   * @param {string|null} [input.classStatus]
   * @param {Record<string, unknown>} [input.classSchedule]
   * @param {Record<string, unknown>} [input.metadata]
   * @returns {Promise<Record<string, unknown>>}
   */
  async prepareEnrollmentScheduleLink(input = {}) {
    const enrollmentId = nullableText(input.enrollmentId, 64);
    const requestedBy = nullableText(input.requestedBy, 191);

    if (!enrollmentId || !requestedBy) {
      throw controlledError(
        "prepareEnrollmentScheduleLink requires enrollmentId and requestedBy.",
        ENROLLMENT_SCHEDULE_PREPARATION_INPUT_REQUIRED_CODE,
        {
          hasEnrollmentId: Boolean(enrollmentId),
          hasRequestedBy: Boolean(requestedBy),
        },
      );
    }

    const enrollment = await this.findEnrollmentById(enrollmentId);

    if (!enrollment) {
      throw controlledError(
        "Enrollment was not found for schedule preparation.",
        ENROLLMENT_SCHEDULE_PREPARATION_ENROLLMENT_NOT_FOUND_CODE,
        { enrollmentId },
      );
    }

    const enrollmentStatus = normalizeEnrollmentStatus(readProperty(enrollment, "status"));

    if (enrollmentStatus !== EnrollmentStatus.ACTIVE) {
      throw controlledError(
        "Only ACTIVE Enrollment can prepare a schedule link.",
        ENROLLMENT_SCHEDULE_PREPARATION_INVALID_ENROLLMENT_STATUS_CODE,
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
        "Enrollment schedule preparation requires student person/profile ids.",
        ENROLLMENT_SCHEDULE_PREPARATION_STUDENT_LINK_MISSING_CODE,
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

    const contract = prepareEnrollmentScheduleLink({
      ...input,
      enrollmentId,
      enrollmentStatus,
      metadata: {
        operation: "prepareEnrollmentScheduleLink",
        ...readObject(input.metadata),
      },
      requestedBy,
      studentPersonId,
      studentProfileId,
    });

    return {
      ...contract,
      duplicateSchedulePreventedByNoWrite: true,
      enrollmentFound: true,
      enrollmentSnapshot: {
        id: enrollmentId,
        status: enrollmentStatus,
        studentPersonId,
        studentProfileId,
      },
      idempotency: {
        key: `enrollment:${enrollmentId}:class:${contract.classId}`,
        realDuplicateCheckAvailable: false,
        safeToRetry: true,
      },
      scheduleGatewayCalled: false,
    };
  }

  /**
   * Prepares the initial schedule for an ACTIVE Enrollment already linked to a
   * class. Real Agenda persistence remains blocked until a dedicated Agenda
   * boundary/table exists for Enrollment-generated schedules.
   *
   * @param {Object} input
   * @param {string|null} [input.enrollmentId]
   * @param {string|number|null} [input.classId]
   * @param {string|number|null} [input.turmaId]
   * @param {string|null} [input.requestedBy]
   * @param {Record<string, unknown>} [input.classSchedule]
   * @param {Record<string, unknown>} [input.metadata]
   * @returns {Promise<Record<string, unknown>>}
   */
  async createInitialScheduleForEnrollment(input = {}) {
    const enrollmentId = nullableText(input.enrollmentId, 64);
    const classId = normalizeClassIdInput(input.classId ?? input.turmaId);
    const requestedBy = nullableText(input.requestedBy, 191);

    if (!enrollmentId || !classId || !requestedBy) {
      throw controlledError(
        "createInitialScheduleForEnrollment requires enrollmentId, classId and requestedBy.",
        ENROLLMENT_SCHEDULE_PREPARATION_INPUT_REQUIRED_CODE,
        {
          hasClassId: Boolean(classId),
          hasEnrollmentId: Boolean(enrollmentId),
          hasRequestedBy: Boolean(requestedBy),
        },
      );
    }

    const enrollment = await this.findEnrollmentById(enrollmentId);

    if (!enrollment) {
      throw controlledError(
        "Enrollment was not found for initial schedule preparation.",
        ENROLLMENT_SCHEDULE_PREPARATION_ENROLLMENT_NOT_FOUND_CODE,
        { enrollmentId },
      );
    }

    const enrollmentStatus = normalizeEnrollmentStatus(readProperty(enrollment, "status"));

    if (enrollmentStatus !== EnrollmentStatus.ACTIVE) {
      throw controlledError(
        "Only ACTIVE Enrollment can prepare an initial schedule.",
        ENROLLMENT_SCHEDULE_PREPARATION_INVALID_ENROLLMENT_STATUS_CODE,
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
        "Enrollment initial schedule preparation requires student person/profile ids.",
        ENROLLMENT_SCHEDULE_PREPARATION_STUDENT_LINK_MISSING_CODE,
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

    const activeClassLink = await this.findActiveEnrollmentClassLink({
      classId,
      enrollmentId,
    });

    if (!activeClassLink) {
      throw controlledError(
        "Enrollment must have an active class link before initial schedule preparation.",
        ENROLLMENT_SCHEDULE_PREPARATION_ACTIVE_CLASS_LINK_MISSING_CODE,
        {
          classId,
          classLinkReaderAvailable: Boolean(this.classLinkReader),
          enrollmentId,
        },
      );
    }

    const classSnapshot = await this.findClassById(classId);
    const classSchedule = buildClassScheduleInput(input.classSchedule, classSnapshot);
    const contract = prepareEnrollmentScheduleLink({
      ...input,
      classId,
      classSchedule,
      classStatus: readProperty(classSnapshot, "status") ?? input.classStatus,
      enrollmentId,
      enrollmentStatus,
      metadata: {
        operation: "createInitialScheduleForEnrollment",
        ...readObject(input.metadata),
      },
      requestedBy,
      studentPersonId,
      studentProfileId,
    });

    if (!contract.classScheduleMapped) {
      throw controlledError(
        "Class schedule was not found or is not reliable enough for initial schedule preparation.",
        ENROLLMENT_SCHEDULE_PREPARATION_CLASS_SCHEDULE_MISSING_CODE,
        {
          classId,
          classReaderAvailable: Boolean(this.classReader),
          enrollmentId,
        },
      );
    }

    return {
      ...contract,
      activeClassLinkFound: true,
      activeClassLinkId: nullableText(readProperty(activeClassLink, "id"), 64),
      agendaModuleMapped: true,
      classScheduleMapped: true,
      duplicateScheduleReusedOrBlocked: true,
      enrollmentFound: true,
      enrollmentSchedulePrepared: true,
      enrollmentSnapshot: {
        id: enrollmentId,
        status: enrollmentStatus,
        studentPersonId,
        studentProfileId,
      },
      idempotency: {
        key: `enrollment:${enrollmentId}:class:${contract.classId}:initial-schedule`,
        realDuplicateCheckAvailable: false,
        safeToRetry: true,
      },
      initialSchedulePrepared: true,
      noFakeScheduleCreated: true,
      noFinancialSideEffects: true,
      noNotificationSideEffects: true,
      noScheduleCreated: true,
      scheduleCreationBlockedBySchemaOrRuleGap: true,
      scheduleCreationIsIdempotent: true,
      scheduleGatewayCalled: false,
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
        "EnrollmentScheduleService requires an enrollmentReader.findEnrollmentById or findById function.",
      );
    }

    return this.enrollmentReader;
  }

  /**
   * @param {{ classId: string|number, enrollmentId: string }} input
   * @returns {Promise<unknown|null>}
   */
  async findActiveEnrollmentClassLink(input) {
    const reader = this.classLinkReader;

    if (typeof reader?.findActiveByEnrollmentAndClass === "function") {
      return reader.findActiveByEnrollmentAndClass(input);
    }

    if (typeof reader?.findActiveEnrollmentClassLink === "function") {
      return reader.findActiveEnrollmentClassLink(input);
    }

    return null;
  }

  /**
   * @param {string|number} classId
   * @returns {Promise<unknown|null>}
   */
  async findClassById(classId) {
    const reader = this.classReader;

    if (typeof reader?.findClassById === "function") {
      return reader.findClassById(classId);
    }

    if (typeof reader?.findById === "function") {
      return reader.findById(classId);
    }

    return null;
  }
}

function normalizeClassIdInput(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  const stringValue = String(value).trim();
  return /^\d+$/.test(stringValue) ? Number(stringValue) : stringValue;
}

function buildClassScheduleInput(inputSchedule, classSnapshot) {
  const schedule = readObject(inputSchedule);

  if (Object.keys(schedule).length > 0) {
    return schedule;
  }

  if (!classSnapshot || typeof classSnapshot !== "object") {
    return {};
  }

  return {
    dias_semana: readProperty(classSnapshot, "dias_semana"),
    dias_semana_json: readProperty(classSnapshot, "dias_semana_json"),
    endTime: readProperty(classSnapshot, "horario_fim"),
    horario: readProperty(classSnapshot, "horario"),
    horarioFim: readProperty(classSnapshot, "horarioFim"),
    horarioInicio: readProperty(classSnapshot, "horarioInicio"),
    startTime: readProperty(classSnapshot, "horario_inicio"),
  };
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
    "Enrollment schedule input does not match the persisted Enrollment student ids.",
    ENROLLMENT_SCHEDULE_PREPARATION_STUDENT_MISMATCH_CODE,
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
  ENROLLMENT_SCHEDULE_PREPARATION_ENROLLMENT_NOT_FOUND_CODE,
  ENROLLMENT_SCHEDULE_PREPARATION_ACTIVE_CLASS_LINK_MISSING_CODE,
  ENROLLMENT_SCHEDULE_PREPARATION_CLASS_SCHEDULE_MISSING_CODE,
  ENROLLMENT_SCHEDULE_PREPARATION_INPUT_REQUIRED_CODE,
  ENROLLMENT_SCHEDULE_PREPARATION_INVALID_ENROLLMENT_STATUS_CODE,
  ENROLLMENT_SCHEDULE_PREPARATION_STUDENT_LINK_MISSING_CODE,
  ENROLLMENT_SCHEDULE_PREPARATION_STUDENT_MISMATCH_CODE,
  EnrollmentScheduleService,
};
