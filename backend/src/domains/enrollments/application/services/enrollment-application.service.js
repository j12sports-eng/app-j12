const { Enrollment } = require("../../domain/entities/enrollment.entity.js");
const { EnrollmentFactory } = require("../../domain/factories/enrollment.factory.js");
const {
  EnrollmentStatus,
  normalizeEnrollmentStatus,
} = require("../../domain/enums/enrollment-status.enum.js");

const CONFIRM_DRAFT_ENROLLMENT_ID_REQUIRED_CODE = "CONFIRM_DRAFT_ENROLLMENT_ID_REQUIRED";
const CONFIRM_DRAFT_ENROLLMENT_NOT_FOUND_CODE = "CONFIRM_DRAFT_ENROLLMENT_NOT_FOUND";
const CONFIRM_DRAFT_ENROLLMENT_INVALID_STATUS_CODE = "CONFIRM_DRAFT_ENROLLMENT_INVALID_STATUS";
const ACTIVE_ENROLLMENT_GUARD_INPUT_REQUIRED_CODE = "ACTIVE_ENROLLMENT_GUARD_INPUT_REQUIRED";
const ACTIVE_ENROLLMENT_ALREADY_EXISTS_CODE = "ACTIVE_ENROLLMENT_ALREADY_EXISTS";
const ENROLLMENT_PROCEED_GUARD_INPUT_REQUIRED_CODE = "ENROLLMENT_PROCEED_GUARD_INPUT_REQUIRED";
const ENROLLMENT_PROCEED_BLOCKED_CODE = "ENROLLMENT_PROCEED_BLOCKED";
const ENROLLMENT_PROCEED_CONFLICT_CODE = "ENROLLMENT_PROCEED_CONFLICT";
const ENROLLMENT_PROCEED_STATUS_VALUES = Object.freeze(["NONE", "DRAFT", "ACTIVE", "CONFLICT"]);
const ENROLLMENT_CANCEL_ACCESS_DENIED_CODE = "ENROLLMENT_CANCEL_ACCESS_DENIED";
const ENROLLMENT_CANCEL_FAILED_CODE = "ENROLLMENT_CANCEL_FAILED";
const ENROLLMENT_CANCEL_INPUT_INVALID_CODE = "ENROLLMENT_CANCEL_INPUT_INVALID";
const ENROLLMENT_CANCEL_INPUT_REQUIRED_CODE = "ENROLLMENT_CANCEL_INPUT_REQUIRED";
const ENROLLMENT_CANCEL_NOT_FOUND_CODE = "ENROLLMENT_CANCEL_NOT_FOUND";
const ENROLLMENT_STATE_CONFLICT_CODE = "ENROLLMENT_STATE_CONFLICT";
const ENROLLMENT_UNIT_OWNERSHIP_CONFLICT_CODE = "ENROLLMENT_UNIT_OWNERSHIP_CONFLICT";
const ENROLLMENT_CANCEL_COMMAND_FIELDS = new Set(["enrollmentId"]);

/**
 * Application service for Enrollment use cases.
 *
 * Sprint 9.14 only creates draft Enrollment aggregates in memory through the
 * domain factory. It does not access repositories, database, Prisma, SQL,
 * events, routes, controllers, APIs, frontend or legacy modules.
 * Sprint 9.22 adds opt-in persistence through an injected repository only.
 * Sprint 9.32 exposes a stable application-level read method for the current
 * persisted DRAFT without leaking concrete repositories to upper layers.
 * Sprint 9.33 prepares internal confirmation by validating and transitioning
 * a persisted DRAFT to ACTIVE without endpoints or side effects.
 * Sprint 9.34 forwards confirmation audit metadata to the injected repository
 * after the schema migration adds confirmed_at and confirmed_by.
 * Sprint 9.35 exposes a stable application-level read method for the current
 * persisted ACTIVE Enrollment without leaking concrete repositories.
 * Sprint 9.36 adds an internal read-only guard against duplicated ACTIVE
 * Enrollment for the same student/profile pair.
 * Sprint 9.37 wires that guard into draft confirmation before the status
 * transition to ACTIVE.
 * Sprint 9.38 exposes a consolidated read-only status summary for future
 * internal integrations.
 * Sprint 9.39 adds an internal read-only proceed guard based on the
 * consolidated status summary.
 * Sprint 9.51 exposes a read-only lookup by Enrollment id for internal
 * integration services without exposing repository details.
 * Sprint 10.11 exposes a read-only administrative student scope search through
 * the injected repository, keeping People/Profile SQL behind the domain.
 */
class EnrollmentApplicationService {
  /**
   * @param {Object} [options]
   * @param {{ createDraft: (input: Record<string, unknown>) => unknown }} [options.enrollmentFactory]
   * @param {{ create: (enrollment: unknown) => Promise<unknown>, createDraftIfNotExists?: (enrollment: unknown) => Promise<{ enrollment: unknown|null, created: boolean, reused: boolean }>, findActiveByStudent?: (input: Record<string, unknown>) => Promise<unknown|null>, findById?: (id: string) => Promise<unknown|null>, findDraftByStudent?: (input: Record<string, unknown>) => Promise<unknown|null>, searchStudentScopes?: (input: Record<string, unknown>) => Promise<unknown[]>, updateStatus?: (id: string, status: string, options?: Record<string, unknown>) => Promise<unknown|null> }} [options.enrollmentRepository]
   */
  constructor({
    authorizeEnrollmentCancellation = null,
    enrollmentFactory = EnrollmentFactory,
    enrollmentRepository = null,
  } = {}) {
    this.authorizeEnrollmentCancellation =
      typeof authorizeEnrollmentCancellation === "function"
        ? authorizeEnrollmentCancellation
        : null;
    this.enrollmentFactory = enrollmentFactory;
    this.enrollmentRepository = enrollmentRepository;
  }

  /**
   * Creates a draft Enrollment aggregate in memory.
   *
   * @param {Object} input
   * @param {string|null} [input.id]
   * @param {string} input.studentPersonId
   * @param {string} input.studentProfileId
   * @param {string} input.startDate
   * @param {string} input.unitId
   * @param {string|null} [input.createdAt]
   * @param {string|null} [input.updatedAt]
   * @returns {unknown}
   */
  createDraftEnrollment(input = {}) {
    return this.getEnrollmentFactory().createDraft(input);
  }

  /**
   * Creates a draft Enrollment aggregate in memory and persists it through the
   * injected repository. The service does not instantiate repositories or touch
   * database modules directly.
   *
   * @param {Object} input
   * @param {string|null} [input.id]
   * @param {string} input.studentPersonId
   * @param {string} input.studentProfileId
   * @param {string} input.startDate
   * @param {string} input.unitId
   * @param {string|null} [input.createdAt]
   * @param {string|null} [input.updatedAt]
   * @returns {Promise<unknown>}
   */
  async createDraftEnrollmentAndPersist(input = {}) {
    const result = await this.createDraftEnrollmentIdempotently(input);

    return result.draftEnrollment;
  }

  /**
   * Creates a draft Enrollment only when there is no persisted DRAFT for the
   * same student/profile pair.
   *
   * @param {Object} input
   * @param {string|null} [input.id]
   * @param {string} input.studentPersonId
   * @param {string} input.studentProfileId
   * @param {string} input.startDate
   * @param {string} input.unitId
   * @param {string|null} [input.createdAt]
   * @param {string|null} [input.updatedAt]
   * @returns {Promise<{ draftEnrollment: unknown|null, created: boolean, reused: boolean }>}
   */
  async createDraftEnrollmentIdempotently(input = {}) {
    const enrollment = this.getEnrollmentFactory().createDraft(input);
    const repository = this.getEnrollmentRepository();

    if (typeof repository.createDraftIfNotExists === "function") {
      const result = await repository.createDraftIfNotExists(enrollment);
      const draftEnrollment = result?.enrollment ?? null;

      if (Boolean(result?.reused) && draftEnrollment) {
        ensureSameEnrollmentUnit(enrollment, draftEnrollment);
      }

      return {
        created: Boolean(result?.created),
        draftEnrollment,
        reused: Boolean(result?.reused),
      };
    }

    const existingEnrollment = await this.findCurrentDraftEnrollment({
      studentPersonId: enrollment.studentPersonId,
      studentProfileId: enrollment.studentProfileId,
    });

    if (existingEnrollment) {
      ensureSameEnrollmentUnit(enrollment, existingEnrollment);

      return {
        created: false,
        draftEnrollment: existingEnrollment,
        reused: true,
      };
    }

    return {
      created: true,
      draftEnrollment: await repository.create(enrollment),
      reused: false,
    };
  }

  /**
   * Finds the current persisted DRAFT Enrollment for a student/profile pair.
   * Invalid or incomplete identifiers return null and do not touch the
   * repository.
   *
   * @param {Object} input
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @returns {Promise<unknown|null>}
   */
  async findCurrentDraftEnrollment(input = {}) {
    const studentPersonId = nullableText(input.studentPersonId, 64);
    const studentProfileId = nullableText(input.studentProfileId, 64);

    if (!studentPersonId || !studentProfileId) {
      return null;
    }

    return this.getEnrollmentDraftReader().findDraftByStudent({
      studentPersonId,
      studentProfileId,
    });
  }

  /**
   * Backward-compatible alias for the consolidated current draft query.
   *
   * @param {Object} input
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @returns {Promise<unknown|null>}
   */
  async findDraftEnrollment(input = {}) {
    return this.findCurrentDraftEnrollment(input);
  }

  /**
   * Finds the current persisted ACTIVE Enrollment for a student/profile pair.
   * Invalid or incomplete identifiers return null and do not touch the
   * repository.
   *
   * @param {Object} input
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @returns {Promise<unknown|null>}
   */
  async findCurrentActiveEnrollment(input = {}) {
    const studentPersonId = nullableText(input.studentPersonId, 64);
    const studentProfileId = nullableText(input.studentProfileId, 64);

    if (!studentPersonId || !studentProfileId) {
      return null;
    }

    return this.getEnrollmentActiveReader().findActiveByStudent({
      studentPersonId,
      studentProfileId,
    });
  }

  /**
   * Finds a persisted Enrollment by id for internal integration services.
   * Invalid identifiers return null and do not touch the repository.
   *
   * @param {string|null} id
   * @returns {Promise<unknown|null>}
   */
  async findEnrollmentById(id = null) {
    const enrollmentId = nullableText(id, 64);

    if (!enrollmentId) {
      return null;
    }

    return this.getEnrollmentByIdReader().findById(enrollmentId);
  }

  /**
   * Returns the consolidated Enrollment status for a student/profile pair.
   * Invalid or incomplete identifiers return null and do not touch the
   * repository, matching the current read-query behavior.
   *
   * @param {Object} input
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @returns {Promise<{ hasDraftEnrollment: boolean, hasActiveEnrollment: boolean, draftEnrollment: unknown|null, activeEnrollment: unknown|null, status: "NONE"|"DRAFT"|"ACTIVE"|"CONFLICT" }|null>}
   */
  async getEnrollmentStatusSummary(input = {}) {
    const studentPersonId = nullableText(input.studentPersonId, 64);
    const studentProfileId = nullableText(input.studentProfileId, 64);

    if (!studentPersonId || !studentProfileId) {
      return null;
    }

    const [draftEnrollment, activeEnrollment] = await Promise.all([
      this.findCurrentDraftEnrollment({ studentPersonId, studentProfileId }),
      this.findCurrentActiveEnrollment({ studentPersonId, studentProfileId }),
    ]);
    const hasDraftEnrollment = Boolean(draftEnrollment);
    const hasActiveEnrollment = Boolean(activeEnrollment);
    let status = "NONE";

    if (hasDraftEnrollment && hasActiveEnrollment) {
      status = "CONFLICT";
    } else if (hasActiveEnrollment) {
      status = "ACTIVE";
    } else if (hasDraftEnrollment) {
      status = "DRAFT";
    }

    return {
      hasDraftEnrollment,
      hasActiveEnrollment,
      draftEnrollment,
      activeEnrollment,
      status,
    };
  }

  /**
   * Searches administrative Aluno Pessoa/Profile scopes for Enrollment status
   * queries. Short or empty terms return an empty list without touching the
   * repository.
   *
   * @param {Object} input
   * @param {string|null} [input.query]
   * @param {number|string|null} [input.limit]
   * @returns {Promise<unknown[]>}
   */
  async searchStudentScopes(input = {}) {
    const query = nullableText(input.query ?? input.q ?? input.search, 100);

    if (!query || query.length < 2) {
      return [];
    }

    return this.getEnrollmentStudentScopeSearchReader().searchStudentScopes({
      limit: normalizeSearchLimit(input.limit),
      query,
    });
  }

  /**
   * Ensures the current consolidated Enrollment status can proceed.
   *
   * This guard is read-only and centralizes future decisions around the
   * student/profile Enrollment state. CONFLICT is always blocked, even when it
   * is accidentally listed in allowedStatuses.
   *
   * @param {Object} input
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @param {string[]} [input.allowedStatuses]
   * @returns {Promise<{ allowed: boolean, allowedStatuses: string[], status: "NONE"|"DRAFT"|"ACTIVE", statusSummary: unknown, studentPersonId: string, studentProfileId: string }>}
   */
  async ensureEnrollmentCanProceed(input = {}) {
    const studentPersonId = nullableText(input.studentPersonId, 64);
    const studentProfileId = nullableText(input.studentProfileId, 64);

    if (!studentPersonId || !studentProfileId) {
      throw controlledError(
        "ensureEnrollmentCanProceed requires studentPersonId and studentProfileId.",
        ENROLLMENT_PROCEED_GUARD_INPUT_REQUIRED_CODE,
        {
          hasStudentPersonId: Boolean(studentPersonId),
          hasStudentProfileId: Boolean(studentProfileId),
        },
      );
    }

    const allowedStatuses = normalizeProceedAllowedStatuses(input.allowedStatuses);
    const statusSummary = await this.getEnrollmentStatusSummary({
      studentPersonId,
      studentProfileId,
    });
    const currentStatus = statusSummary?.status ?? null;

    if (currentStatus === "CONFLICT") {
      throw controlledError(
        "Enrollment status conflict blocks this operation.",
        ENROLLMENT_PROCEED_CONFLICT_CODE,
        {
          allowedStatuses,
          status: currentStatus,
          statusSummary,
          studentPersonId,
          studentProfileId,
        },
      );
    }

    if (!allowedStatuses.includes(currentStatus)) {
      throw controlledError(
        "Enrollment status is not allowed to proceed.",
        ENROLLMENT_PROCEED_BLOCKED_CODE,
        {
          allowedStatuses,
          status: currentStatus,
          statusSummary,
          studentPersonId,
          studentProfileId,
        },
      );
    }

    return {
      allowed: true,
      allowedStatuses,
      status: currentStatus,
      statusSummary,
      studentPersonId,
      studentProfileId,
    };
  }

  /**
   * Ensures there is no current ACTIVE Enrollment for a student/profile pair.
   *
   * This guard is read-only. It validates the complete pair before querying so
   * callers cannot accidentally continue with incomplete identifiers.
   *
   * @param {Object} input
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @returns {Promise<{ activeEnrollment: null, allowed: boolean, studentPersonId: string, studentProfileId: string }>}
   */
  async ensureNoActiveEnrollment(input = {}) {
    const studentPersonId = nullableText(input.studentPersonId, 64);
    const studentProfileId = nullableText(input.studentProfileId, 64);

    if (!studentPersonId || !studentProfileId) {
      throw controlledError(
        "ensureNoActiveEnrollment requires studentPersonId and studentProfileId.",
        ACTIVE_ENROLLMENT_GUARD_INPUT_REQUIRED_CODE,
        {
          hasStudentPersonId: Boolean(studentPersonId),
          hasStudentProfileId: Boolean(studentProfileId),
        },
      );
    }

    const activeEnrollment = await this.findCurrentActiveEnrollment({
      studentPersonId,
      studentProfileId,
    });

    if (activeEnrollment) {
      throw controlledError(
        "Active Enrollment already exists for this student/profile pair.",
        ACTIVE_ENROLLMENT_ALREADY_EXISTS_CODE,
        {
          activeEnrollment,
          enrollmentId: readProperty(activeEnrollment, "id"),
          studentPersonId,
          studentProfileId,
        },
      );
    }

    return {
      activeEnrollment: null,
      allowed: true,
      studentPersonId,
      studentProfileId,
    };
  }

  /**
   * Cancels a persisted ACTIVE Enrollment without touching class links or integrations.
   *
   * @param {{ enrollmentId?: string|null }} command
   * @param {{ actorId?: string|null, authorization?: unknown, correlationId?: string|null, requestId?: string|null }} context
   * @returns {Promise<Readonly<{ changed: boolean, enrollmentId: string, previousStatus: string, status: string }>>}
   */
  async cancelEnrollment(command = {}, context = {}) {
    const safeCommand = readObject(command);
    const unexpectedFields = Object.keys(safeCommand).filter(
      (field) => !ENROLLMENT_CANCEL_COMMAND_FIELDS.has(field),
    );
    const enrollmentId = nullableText(safeCommand.enrollmentId, 64);
    const actorId = nullableText(readProperty(context, "actorId"), 191);

    if (unexpectedFields.length > 0) {
      throw controlledError(
        "cancelEnrollment accepts only enrollmentId.",
        ENROLLMENT_CANCEL_INPUT_INVALID_CODE,
        {
          unexpectedFields,
        },
      );
    }

    if (!enrollmentId || !actorId) {
      throw controlledError(
        "cancelEnrollment requires enrollmentId and an authenticated actor.",
        ENROLLMENT_CANCEL_INPUT_REQUIRED_CODE,
        {
          hasActorId: Boolean(actorId),
          hasEnrollmentId: Boolean(enrollmentId),
        },
      );
    }

    if (!isValidEnrollmentId(enrollmentId)) {
      throw controlledError(
        "cancelEnrollment received an invalid enrollmentId.",
        ENROLLMENT_CANCEL_INPUT_INVALID_CODE,
        { enrollmentIdValid: false },
      );
    }

    const authorized = await this.isEnrollmentCancellationAuthorized({
      actorId,
      authorization: readProperty(context, "authorization"),
      enrollmentId,
      operation: "cancelEnrollment",
    });

    if (!authorized) {
      throw controlledError(
        "Actor is not authorized to cancel this Enrollment.",
        ENROLLMENT_CANCEL_ACCESS_DENIED_CODE,
        { actorId, enrollmentId },
      );
    }

    const repository = this.getEnrollmentCancellationRepository();

    try {
      const currentEnrollment = await repository.findById(enrollmentId);

      if (!currentEnrollment) {
        throw controlledError(
          "Enrollment was not found for cancellation.",
          ENROLLMENT_CANCEL_NOT_FOUND_CODE,
          { enrollmentId },
        );
      }

      const currentStatus = normalizeEnrollmentStatus(readProperty(currentEnrollment, "status"));

      if (currentStatus === EnrollmentStatus.CANCELLED) {
        return toEnrollmentCancellationDto({
          changed: false,
          enrollmentId,
          previousStatus: EnrollmentStatus.CANCELLED,
        });
      }

      if (currentStatus !== EnrollmentStatus.ACTIVE) {
        throw enrollmentCancellationStateConflict(enrollmentId, currentStatus);
      }

      const enrollment = new Enrollment(currentEnrollment);
      enrollment.cancel();

      const result = await repository.cancelActiveEnrollment({
        enrollmentId,
        expectedStatus: EnrollmentStatus.ACTIVE,
        status: enrollment.status,
      });

      if (readBooleanProperty(result, "changed", false)) {
        return toEnrollmentCancellationDto({
          changed: true,
          enrollmentId,
          previousStatus: currentStatus,
        });
      }

      const latestEnrollment = await repository.findById(enrollmentId);

      if (!latestEnrollment) {
        throw controlledError(
          "Enrollment was not found after concurrent cancellation attempt.",
          ENROLLMENT_CANCEL_NOT_FOUND_CODE,
          { enrollmentId },
        );
      }

      const latestStatus = normalizeEnrollmentStatus(readProperty(latestEnrollment, "status"));

      if (latestStatus === EnrollmentStatus.CANCELLED) {
        return toEnrollmentCancellationDto({
          changed: false,
          enrollmentId,
          previousStatus: EnrollmentStatus.CANCELLED,
        });
      }

      throw enrollmentCancellationStateConflict(enrollmentId, latestStatus);
    } catch (error) {
      if (isEnrollmentCancellationControlledError(error)) {
        throw error;
      }

      throw controlledError("Enrollment cancellation failed.", ENROLLMENT_CANCEL_FAILED_CODE, {
        enrollmentId,
      });
    }
  }

  async isEnrollmentCancellationAuthorized(input = {}) {
    if (!this.authorizeEnrollmentCancellation) {
      return false;
    }

    try {
      return (await this.authorizeEnrollmentCancellation(Object.freeze({ ...input }))) === true;
    } catch {
      return false;
    }
  }
  /**
   * Confirms a persisted DRAFT Enrollment internally.
   *
   * @param {Object} input
   * @param {string|null} [input.enrollmentId]
   * @param {string|null} [input.confirmedBy]
   * @param {string|null} [input.confirmedAt]
   * @returns {Promise<{ alreadyConfirmed: boolean, confirmed: boolean, confirmedAt: string|null, confirmedBy: string|null, enrollment: unknown|null, status: string }>}
   */
  async confirmDraftEnrollment(input = {}) {
    const enrollmentId = nullableText(input.enrollmentId, 64);

    if (!enrollmentId) {
      throw controlledError(
        "confirmDraftEnrollment requires enrollmentId.",
        CONFIRM_DRAFT_ENROLLMENT_ID_REQUIRED_CODE,
      );
    }

    const repository = this.getEnrollmentConfirmationRepository();
    const currentEnrollment = await repository.findById(enrollmentId);

    if (!currentEnrollment) {
      throw controlledError(
        "Draft Enrollment was not found.",
        CONFIRM_DRAFT_ENROLLMENT_NOT_FOUND_CODE,
        { enrollmentId },
      );
    }

    const currentStatus = normalizeEnrollmentStatus(readProperty(currentEnrollment, "status"));
    const confirmedAt = normalizeTimestamp(input.confirmedAt);
    const confirmedBy = nullableText(input.confirmedBy, 191);

    if (currentStatus === EnrollmentStatus.ACTIVE) {
      return {
        alreadyConfirmed: true,
        confirmed: false,
        confirmedAt: confirmedAt || readProperty(currentEnrollment, "confirmedAt"),
        confirmedBy: confirmedBy || readProperty(currentEnrollment, "confirmedBy"),
        enrollment: currentEnrollment,
        status: EnrollmentStatus.ACTIVE,
      };
    }

    if (currentStatus !== EnrollmentStatus.DRAFT) {
      throw controlledError(
        "Only DRAFT Enrollment can be confirmed.",
        CONFIRM_DRAFT_ENROLLMENT_INVALID_STATUS_CODE,
        {
          currentStatus,
          enrollmentId,
        },
      );
    }

    const studentPersonId =
      readProperty(currentEnrollment, "studentPersonId") ||
      readProperty(currentEnrollment, "student_person_id");
    const studentProfileId =
      readProperty(currentEnrollment, "studentProfileId") ||
      readProperty(currentEnrollment, "student_profile_id");

    await this.ensureNoActiveEnrollment({
      studentPersonId,
      studentProfileId,
    });

    const confirmedEnrollment = await repository.updateStatus(
      enrollmentId,
      EnrollmentStatus.ACTIVE,
      {
        confirmedAt,
        confirmedBy,
      },
    );

    return {
      alreadyConfirmed: false,
      confirmed: true,
      confirmedAt: readProperty(confirmedEnrollment, "confirmedAt") || confirmedAt,
      confirmedBy: readProperty(confirmedEnrollment, "confirmedBy") || confirmedBy,
      enrollment: confirmedEnrollment,
      status: EnrollmentStatus.ACTIVE,
    };
  }

  /**
   * @returns {{ createDraft: (input: Record<string, unknown>) => unknown }}
   */
  getEnrollmentFactory() {
    if (typeof this.enrollmentFactory?.createDraft !== "function") {
      throw new TypeError(
        "EnrollmentApplicationService requires an enrollmentFactory.createDraft function.",
      );
    }

    return this.enrollmentFactory;
  }

  /**
   * @returns {{ create: (enrollment: unknown) => Promise<unknown> }}
   */
  getEnrollmentRepository() {
    if (typeof this.enrollmentRepository?.create !== "function") {
      throw new TypeError(
        "EnrollmentApplicationService requires an enrollmentRepository.create function.",
      );
    }

    return this.enrollmentRepository;
  }

  /**
   * @returns {{ findDraftByStudent: (input: Record<string, unknown>) => Promise<unknown|null> }}
   */
  getEnrollmentDraftReader() {
    if (typeof this.enrollmentRepository?.findDraftByStudent !== "function") {
      throw new TypeError(
        "EnrollmentApplicationService requires an enrollmentRepository.findDraftByStudent function.",
      );
    }

    return this.enrollmentRepository;
  }

  /**
   * @returns {{ findActiveByStudent: (input: Record<string, unknown>) => Promise<unknown|null> }}
   */
  getEnrollmentActiveReader() {
    if (typeof this.enrollmentRepository?.findActiveByStudent !== "function") {
      throw new TypeError(
        "EnrollmentApplicationService requires an enrollmentRepository.findActiveByStudent function.",
      );
    }

    return this.enrollmentRepository;
  }

  /**
   * @returns {{ findById: (id: string) => Promise<unknown|null> }}
   */
  getEnrollmentByIdReader() {
    if (typeof this.enrollmentRepository?.findById !== "function") {
      throw new TypeError(
        "EnrollmentApplicationService requires an enrollmentRepository.findById function.",
      );
    }

    return this.enrollmentRepository;
  }

  /**
   * @returns {{ findById: (id: string) => Promise<unknown|null>, updateStatus: (id: string, status: string, options?: Record<string, unknown>) => Promise<unknown|null> }}
   */
  getEnrollmentConfirmationRepository() {
    if (typeof this.enrollmentRepository?.findById !== "function") {
      throw new TypeError(
        "EnrollmentApplicationService requires an enrollmentRepository.findById function.",
      );
    }

    if (typeof this.enrollmentRepository?.updateStatus !== "function") {
      throw new TypeError(
        "EnrollmentApplicationService requires an enrollmentRepository.updateStatus function.",
      );
    }

    return this.enrollmentRepository;
  }

  /**
   * @returns {{ searchStudentScopes: (input: Record<string, unknown>) => Promise<unknown[]> }}
   */
  /**
   * @returns {{ findById: (id: string) => Promise<unknown|null>, cancelActiveEnrollment: (input: Record<string, unknown>) => Promise<{ changed: boolean }> }}
   */
  getEnrollmentCancellationRepository() {
    if (typeof this.enrollmentRepository?.findById !== "function") {
      throw new TypeError(
        "EnrollmentApplicationService requires an enrollmentRepository.findById function.",
      );
    }

    if (typeof this.enrollmentRepository?.cancelActiveEnrollment !== "function") {
      throw new TypeError(
        "EnrollmentApplicationService requires an enrollmentRepository.cancelActiveEnrollment function.",
      );
    }

    return this.enrollmentRepository;
  }
  getEnrollmentStudentScopeSearchReader() {
    if (typeof this.enrollmentRepository?.searchStudentScopes !== "function") {
      throw new TypeError(
        "EnrollmentApplicationService requires an enrollmentRepository.searchStudentScopes function.",
      );
    }

    return this.enrollmentRepository;
  }
}

/**
 * @param {unknown} value
 * @param {string} property
 * @returns {unknown|null}
 */
function readProperty(value, property) {
  return value && typeof value === "object" ? (value[property] ?? null) : null;
}

/**
 * Bloqueia reutilizaÃ§Ã£o idempotente quando o DRAFT existente pertence a outra
 * unidade ou nÃ£o possui ownership persistido.
 *
 * @param {unknown} requestedEnrollment
 * @param {unknown} existingEnrollment
 * @returns {void}
 */
function ensureSameEnrollmentUnit(requestedEnrollment, existingEnrollment) {
  const requestedUnitId = nullableText(
    readProperty(requestedEnrollment, "unitId") ?? readProperty(requestedEnrollment, "unit_id"),
    20,
  );
  const existingUnitId = nullableText(
    readProperty(existingEnrollment, "unitId") ?? readProperty(existingEnrollment, "unit_id"),
    20,
  );

  if (!requestedUnitId || !existingUnitId || requestedUnitId !== existingUnitId) {
    throw controlledError(
      "Enrollment unit ownership conflict blocks idempotent reuse.",
      ENROLLMENT_UNIT_OWNERSHIP_CONFLICT_CODE,
      {
        existingUnitId,
        requestedUnitId,
      },
    );
  }
}

/**
 * @param {unknown} value
 * @param {string} property
 * @param {boolean} fallback
 * @returns {boolean}
 */
function readBooleanProperty(value, property, fallback) {
  const raw = readProperty(value, property);
  return typeof raw === "boolean" ? raw : fallback;
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
 * @param {string} value
 * @returns {boolean}
 */
function isValidEnrollmentId(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(String(value ?? ""));
}

function enrollmentCancellationStateConflict(enrollmentId, currentStatus) {
  return controlledError(
    "Only ACTIVE Enrollment can be cancelled in this sprint.",
    ENROLLMENT_STATE_CONFLICT_CODE,
    {
      currentStatus,
      enrollmentId,
      requiredStatus: EnrollmentStatus.ACTIVE,
    },
  );
}

function toEnrollmentCancellationDto({ changed, enrollmentId, previousStatus }) {
  return Object.freeze({
    changed: changed === true,
    enrollmentId,
    previousStatus,
    status: EnrollmentStatus.CANCELLED,
  });
}

function isEnrollmentCancellationControlledError(error) {
  return [
    ENROLLMENT_CANCEL_ACCESS_DENIED_CODE,
    ENROLLMENT_CANCEL_INPUT_INVALID_CODE,
    ENROLLMENT_CANCEL_INPUT_REQUIRED_CODE,
    ENROLLMENT_CANCEL_NOT_FOUND_CODE,
    ENROLLMENT_STATE_CONFLICT_CODE,
  ].includes(readProperty(error, "code"));
}
/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeTimestamp(value) {
  const normalized = nullableText(value, 32);

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return normalized.replace("T", " ").slice(0, 19);
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * @param {unknown} statuses
 * @returns {string[]}
 */
function normalizeProceedAllowedStatuses(statuses = ["NONE", "DRAFT"]) {
  if (!Array.isArray(statuses)) {
    return [];
  }

  return [
    ...new Set(
      statuses
        .map((status) =>
          String(status ?? "")
            .trim()
            .toUpperCase(),
        )
        .filter(
          (status) => ENROLLMENT_PROCEED_STATUS_VALUES.includes(status) && status !== "CONFLICT",
        ),
    ),
  ];
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function normalizeSearchLimit(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10;
  }

  return Math.min(Math.trunc(parsed), 25);
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
  ACTIVE_ENROLLMENT_ALREADY_EXISTS_CODE,
  ACTIVE_ENROLLMENT_GUARD_INPUT_REQUIRED_CODE,
  CONFIRM_DRAFT_ENROLLMENT_ID_REQUIRED_CODE,
  CONFIRM_DRAFT_ENROLLMENT_INVALID_STATUS_CODE,
  CONFIRM_DRAFT_ENROLLMENT_NOT_FOUND_CODE,
  ENROLLMENT_PROCEED_BLOCKED_CODE,
  ENROLLMENT_PROCEED_CONFLICT_CODE,
  ENROLLMENT_PROCEED_GUARD_INPUT_REQUIRED_CODE,
  ENROLLMENT_CANCEL_ACCESS_DENIED_CODE,
  ENROLLMENT_CANCEL_FAILED_CODE,
  ENROLLMENT_CANCEL_INPUT_INVALID_CODE,
  ENROLLMENT_CANCEL_INPUT_REQUIRED_CODE,
  ENROLLMENT_CANCEL_NOT_FOUND_CODE,
  ENROLLMENT_STATE_CONFLICT_CODE,
  ENROLLMENT_UNIT_OWNERSHIP_CONFLICT_CODE,
  EnrollmentApplicationService,
  ensureSameEnrollmentUnit,
  normalizeSearchLimit,
};
