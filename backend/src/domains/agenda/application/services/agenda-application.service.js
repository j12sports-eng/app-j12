const AGENDA_REPOSITORY_REQUIRED_CODE = "AGENDA_REPOSITORY_REQUIRED";
const AGENDA_ENROLLMENT_ID_REQUIRED_CODE = "AGENDA_ENROLLMENT_ID_REQUIRED";
const AGENDA_ENROLLMENT_FACADE_UNAVAILABLE_CODE = "AGENDA_ENROLLMENT_FACADE_UNAVAILABLE";
const AGENDA_ENROLLMENT_FACADE_READER_UNAVAILABLE_CODE =
  "AGENDA_ENROLLMENT_FACADE_READER_UNAVAILABLE";
const AGENDA_ENROLLMENT_FACADE_ERROR_CODE = "AGENDA_ENROLLMENT_FACADE_ERROR";
const AGENDA_ENROLLMENT_NOT_FOUND_CODE = "AGENDA_ENROLLMENT_NOT_FOUND";
const AGENDA_ENROLLMENT_NOT_ACTIVE_CODE = "AGENDA_ENROLLMENT_NOT_ACTIVE";
const AGENDA_ENROLLMENT_STUDENT_SCOPE_MISSING_CODE =
  "AGENDA_ENROLLMENT_STUDENT_SCOPE_MISSING";
const AGENDA_ENROLLMENT_SCHEDULES_NOT_FOUND_CODE = "AGENDA_ENROLLMENT_SCHEDULES_NOT_FOUND";
const AGENDA_CLASS_FACADE_UNAVAILABLE_CODE = "AGENDA_CLASS_FACADE_UNAVAILABLE";
const AGENDA_CLASS_FACADE_READER_UNAVAILABLE_CODE = "AGENDA_CLASS_FACADE_READER_UNAVAILABLE";
const AGENDA_CLASS_FACADE_ERROR_CODE = "AGENDA_CLASS_FACADE_ERROR";
const AGENDA_CLASS_NOT_FOUND_OR_INACTIVE_CODE = "AGENDA_CLASS_NOT_FOUND_OR_INACTIVE";
const AGENDA_INITIAL_CLASS_LINK_REQUIRED_CODE = "AGENDA_INITIAL_CLASS_LINK_REQUIRED";
const AGENDA_INITIAL_CLASS_SCHEDULE_NOT_TRUSTED_CODE =
  "AGENDA_INITIAL_CLASS_SCHEDULE_NOT_TRUSTED";
const AGENDA_INITIAL_CREATION_SCHEMA_GAP_CODE = "AGENDA_INITIAL_CREATION_SCHEMA_GAP";
const AGENDA_INITIAL_IDEMPOTENCY_GAP_CODE = "AGENDA_INITIAL_IDEMPOTENCY_GAP";
const AGENDA_INITIAL_PERSISTENCE_ERROR_CODE = "AGENDA_INITIAL_PERSISTENCE_ERROR";
const AGENDA_INITIAL_PERSISTENCE_REPOSITORY_UNAVAILABLE_CODE =
  "AGENDA_INITIAL_PERSISTENCE_REPOSITORY_UNAVAILABLE";
const AGENDA_REPOSITORY_READ_ERROR_CODE = "AGENDA_REPOSITORY_READ_ERROR";
const ACTIVE_ENROLLMENT_STATUS = "ACTIVE";
const {
  AGENDA_CONFLICT_VALIDATION_FAILED_CODE,
  AgendaConflictValidationService,
  normalizeAgendaEvent,
} = require("./agenda-conflict-validation.service.js");
const {
  AgendaRecurrenceService,
} = require("./agenda-recurrence.service.js");

/**
 * Application service for the Agenda backend domain.
 *
 * The service exposes schedule discovery and the controlled initial planned
 * Agenda persistence for ACTIVE enrollments. It never creates attendance,
 * financial entries, notifications or public API behavior.
 */
class AgendaApplicationService {
  /**
   * @param {Object} [options]
   * @param {import("../repositories/agenda.repository.js").AgendaRepository} [options.agendaRepository]
   * @param {Record<string, unknown>} [options.enrollmentFacade]
   * @param {Record<string, unknown>} [options.classFacade]
   */
  constructor({ agendaRepository = null, classFacade = null, enrollmentFacade = null } = {}) {
    this.agendaRepository = agendaRepository;
    this.classFacade = classFacade;
    this.enrollmentFacade = enrollmentFacade;
  }

  /**
   * @param {{ classId?: string|number|null }} [input]
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async findSchedulesByClass(input = {}) {
    const classId = normalizeClassId(input.classId);

    if (!classId) {
      return [];
    }

    return normalizeScheduleList(
      await this.getAgendaRepository().findSchedulesByClass({ classId }),
    );
  }

  /**
   * @param {{ studentPersonId?: string|null, studentProfileId?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async findSchedulesByStudent(input = {}) {
    const scope = normalizeStudentScope(input);

    if (!scope.valid) {
      return [];
    }

    return normalizeScheduleList(
      await this.getAgendaRepository().findSchedulesByStudent({
        studentPersonId: scope.studentPersonId,
        studentProfileId: scope.studentProfileId,
      }),
    );
  }

  /**
   * @param {{ enrollmentId?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async findSchedulesByEnrollment(input = {}) {
    const enrollmentId = nullableText(input.enrollmentId, 64);

    if (!enrollmentId) {
      return [];
    }

    return normalizeScheduleList(
      await this.getAgendaRepository().findSchedulesByEnrollment({ enrollmentId }),
    );
  }

  /**
   * @param {{ studentPersonId?: string|null, studentProfileId?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async getAgendaSummaryByStudent(input = {}) {
    const scope = normalizeStudentScope(input);

    if (!scope.valid) {
      return buildAgendaSummary({
        schedules: [],
        scopeResolved: false,
        studentPersonId: scope.studentPersonId,
        studentProfileId: scope.studentProfileId,
      });
    }

    const repository = this.getAgendaRepository();

    if (typeof repository.getAgendaSummaryByStudent === "function") {
      return normalizeAgendaSummary(
        await repository.getAgendaSummaryByStudent({
          studentPersonId: scope.studentPersonId,
          studentProfileId: scope.studentProfileId,
        }),
        scope,
      );
    }

    const schedules = await this.findSchedulesByStudent(scope);
    return buildAgendaSummary({
      schedules,
      scopeResolved: true,
      studentPersonId: scope.studentPersonId,
      studentProfileId: scope.studentProfileId,
    });
  }

  /**
   * Prepares a read-only Agenda summary for a persisted ACTIVE Enrollment.
   *
   * This contract uses only injected Enrollment/Class facades for cross-domain
   * validation. It never creates schedules, attendance records, recurrence,
   * financial entries, notifications or public API behavior.
   *
   * @param {{ enrollmentId?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async getEnrollmentAgendaSummary(input = {}) {
    const enrollmentId = nullableText(input.enrollmentId, 64);

    if (!enrollmentId) {
      return buildEnrollmentAgendaSummary({
        blockers: [
          createBlocker(
            AGENDA_ENROLLMENT_ID_REQUIRED_CODE,
            "enrollmentId is required to prepare an enrollment Agenda summary.",
          ),
        ],
      });
    }

    const enrollmentResult = await this.findEnrollmentByIdWithFacade(enrollmentId);

    if (enrollmentResult.blocker) {
      return buildEnrollmentAgendaSummary({
        blockers: [enrollmentResult.blocker],
        enrollmentId,
        usesEnrollmentFacade: enrollmentResult.usesEnrollmentFacade,
      });
    }

    const enrollment = enrollmentResult.enrollment;

    if (!enrollment) {
      return buildEnrollmentAgendaSummary({
        blockers: [
          createBlocker(
            AGENDA_ENROLLMENT_NOT_FOUND_CODE,
            "EnrollmentFacade did not return an enrollment for the requested id.",
          ),
        ],
        enrollmentId,
        usesEnrollmentFacade: true,
      });
    }

    const enrollmentStatus = normalizeUpperText(readFirstDefined(enrollment, ["status"]));

    if (enrollmentStatus !== ACTIVE_ENROLLMENT_STATUS) {
      return buildEnrollmentAgendaSummary({
        blockers: [
          createBlocker(
            AGENDA_ENROLLMENT_NOT_ACTIVE_CODE,
            "Enrollment must be ACTIVE before Agenda can return schedule candidates.",
            {
              enrollmentStatus: enrollmentStatus || null,
              requiredEnrollmentStatus: ACTIVE_ENROLLMENT_STATUS,
            },
          ),
        ],
        enrollmentId,
        enrollmentStatus,
        usesEnrollmentFacade: true,
      });
    }

    const studentPersonId = nullableText(
      readFirstDefined(enrollment, ["studentPersonId", "student_person_id"]),
      64,
    );
    const studentProfileId = nullableText(
      readFirstDefined(enrollment, ["studentProfileId", "student_profile_id"]),
      64,
    );

    if (!studentPersonId || !studentProfileId) {
      return buildEnrollmentAgendaSummary({
        blockers: [
          createBlocker(
            AGENDA_ENROLLMENT_STUDENT_SCOPE_MISSING_CODE,
            "EnrollmentFacade returned an enrollment without student person/profile scope.",
            {
              hasStudentPersonId: Boolean(studentPersonId),
              hasStudentProfileId: Boolean(studentProfileId),
            },
          ),
        ],
        enrollmentId,
        enrollmentStatus,
        studentPersonId,
        studentProfileId,
        usesEnrollmentFacade: true,
      });
    }

    const schedulesResult = await this.findEnrollmentSchedulesSafely({ enrollmentId });
    const schedules = normalizeScheduleList(schedulesResult.schedules);
    const classIds = readClassIdsFromSchedules(schedules);
    const classValidation = await this.validateClassesWithFacade(classIds);
    const blockers = [
      ...schedulesResult.blockers,
      ...classValidation.blockers,
    ];

    if (schedules.length === 0) {
      blockers.push(
        createBlocker(
          AGENDA_ENROLLMENT_SCHEDULES_NOT_FOUND_CODE,
          "No active Enrollment -> Turma schedule candidates were found for this enrollment.",
        ),
      );
    }

    return buildEnrollmentAgendaSummary({
      blockers,
      classId: classIds[0] ?? null,
      classIds,
      enrollmentId,
      enrollmentStatus,
      schedules,
      studentPersonId,
      studentProfileId,
      usesClassFacade: classValidation.usesClassFacade,
      usesEnrollmentFacade: true,
    });
  }

  /**
   * Prepares initial Agenda creation for an ACTIVE enrollment without writing.
   *
   * The method validates the same Enrollment -> Turma -> schedule chain used by
   * the summary contract and stops before persistence while Agenda schema,
   * recurrence and idempotency are not canonical.
   *
   * @param {{ enrollmentId?: string|null, requestedBy?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async prepareInitialAgendaForEnrollment(input = {}) {
    const enrollmentId = nullableText(input.enrollmentId, 64);
    const requestedBy = nullableText(input.requestedBy, 128);
    const summary = await this.getEnrollmentAgendaSummary({ enrollmentId });
    const summaryBlockers = normalizeBlockerList(summary.blockers);
    const scheduleCandidates = normalizeScheduleList(summary.schedules);
    const blockers = [...summaryBlockers];
    const canEvaluateScheduleChain = canEvaluateInitialAgendaCreation(summaryBlockers);
    const persistenceReady = this.supportsInitialAgendaPersistence();

    if (canEvaluateScheduleChain) {
      if (!summary.classId || scheduleCandidates.length === 0) {
        blockers.push(
          createBlocker(
            AGENDA_INITIAL_CLASS_LINK_REQUIRED_CODE,
            "Initial Agenda creation requires an ACTIVE Enrollment -> Turma schedule link.",
            {
              classId: summary.classId ?? null,
              scheduleCandidateCount: scheduleCandidates.length,
            },
          ),
        );
      }

      const scheduleValidation = validateTrustedScheduleCandidates(scheduleCandidates);
      blockers.push(...scheduleValidation.blockers);

      if (scheduleValidation.hasTrustedClassSchedule && !persistenceReady) {
        blockers.push(
          createBlocker(
            AGENDA_INITIAL_CREATION_SCHEMA_GAP_CODE,
            "Initial Agenda creation is blocked until canonical Agenda persistence is available.",
            {
              requiredCapabilities: [
                "agenda table for planned classes",
                "repository method createInitialAgendaForEnrollment",
                "enrollment to agenda link",
                "student person/profile to agenda link",
                "date/time fields",
                "status lifecycle",
                "recurrence policy",
              ],
            },
          ),
          createBlocker(
            AGENDA_INITIAL_IDEMPOTENCY_GAP_CODE,
            "Initial Agenda creation is blocked until duplicate detection is backed by a canonical key.",
            {
              expectedKey: "enrollmentId + classId + recurrence/date scope",
            },
          ),
        );
      }
    }

    return buildInitialAgendaPreparation({
      blockers,
      canCreateAgenda: persistenceReady && blockers.length === 0,
      classId: summary.classId ?? null,
      classIds: summary.classIds ?? [],
      enrollmentId,
      enrollmentStatus: summary.enrollmentStatus ?? null,
      requestedBy,
      scheduleCandidates,
      studentPersonId: summary.studentPersonId ?? null,
      studentProfileId: summary.studentProfileId ?? null,
      usesClassFacade: summary.usesClassFacade === true,
      usesEnrollmentFacade: summary.usesEnrollmentFacade === true,
    });
  }

  /**
   * Persists the initial Agenda for an ACTIVE enrollment when schema/repository
   * support exists. It never creates attendance, financial records or
   * notifications.
   *
   * @param {{ enrollmentId?: string|null, requestedBy?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async createInitialAgendaForEnrollment(input = {}) {
    const preparation = await this.prepareInitialAgendaForEnrollment(input);

    if (!preparation.canCreateAgenda || preparation.blockers.length > 0) {
      return {
        ...preparation,
        agendaCreated: false,
        creationBlocked: true,
      };
    }

    const repository = this.getAgendaRepository();

    if (typeof repository.createInitialAgendaForEnrollment !== "function") {
      return buildInitialAgendaPreparation({
        ...preparation,
        blockers: [
          ...normalizeBlockerList(preparation.blockers),
          createBlocker(
            AGENDA_INITIAL_PERSISTENCE_REPOSITORY_UNAVAILABLE_CODE,
            "AgendaRepository does not expose initial Agenda persistence yet.",
          ),
        ],
        canCreateAgenda: false,
      });
    }

    try {
      const persistence = normalizeAgendaPersistenceResult(
        await repository.createInitialAgendaForEnrollment({
          classId: preparation.classId,
          enrollmentId: preparation.enrollmentId,
          requestedBy: preparation.requestedBy,
          scheduleCandidates: preparation.scheduleCandidates,
          studentPersonId: preparation.studentPersonId,
          studentProfileId: preparation.studentProfileId,
        }),
      );

      return buildInitialAgendaPersistenceResult({
        ...preparation,
        ...persistence,
      });
    } catch (error) {
      return buildInitialAgendaPreparation({
        ...preparation,
        blockers: [
          ...normalizeBlockerList(preparation.blockers),
          createBlocker(
            AGENDA_INITIAL_PERSISTENCE_ERROR_CODE,
            "AgendaRepository failed while persisting initial Agenda items.",
            { errorMessage: readErrorMessage(error) },
          ),
        ],
        canCreateAgenda: false,
      });
    }
  }

  /**
   * Centralized conflict validation entrypoint for Agenda create/edit/move flows.
   *
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async validateAgendaEvent(input = {}) {
    return this.createConflictValidationService().validateAgendaEvent(input);
  }

  /**
   * Validates and, when possible, persists a reschedule of a canonical Agenda item.
   *
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async rescheduleAgendaEvent(input = {}) {
    const repository = this.getAgendaRepository();
    const eventId = nullableText(
      input.eventId || input.agendaItemId || input.scheduleId || input.calendarEventId || input.id,
      191,
    );
    const run = async (agendaRepository = repository) => {
      const validator = new AgendaConflictValidationService({
        agendaRepository,
        classFacade: this.classFacade,
      });
      const validation = await validator.validateAgendaEvent({
        ...input,
        action: "RESCHEDULE",
        eventId,
        lockForUpdate: true,
      });

      if (!validation.canConfirm) {
        throw controlledError(
          "Agenda event cannot be confirmed because critical conflicts were found.",
          AGENDA_CONFLICT_VALIDATION_FAILED_CODE,
          { validation },
        );
      }

      const normalizedEvent = normalizeAgendaEvent({
        ...input,
        action: "RESCHEDULE",
        eventId,
      });
      const updatedSchedule =
        normalizedEvent.agendaItemId &&
        typeof agendaRepository.updateAgendaItemSchedule === "function"
          ? await agendaRepository.updateAgendaItemSchedule({
              agendaItemId: normalizedEvent.agendaItemId,
              courtId: normalizedEvent.courtId,
              courtName: normalizedEvent.courtName,
              date: normalizedEvent.date,
              dayOfWeek: normalizedEvent.dayOfWeek,
              endTime: normalizedEvent.endTime,
              professorId: normalizedEvent.professorId,
              professorName: normalizedEvent.professorName,
              reason: nullableText(input.reason, 500),
              startTime: normalizedEvent.startTime,
            })
          : null;
      const schedule = updatedSchedule || buildRescheduledScheduleFromInput(input, normalizedEvent);

      return {
        agendaConflictValidation: validation,
        agendaDragDropRescheduleEnabled: true,
        conflictDetected: validation.conflictDetected,
        conflicts: validation.conflicts,
        message: updatedSchedule
          ? "Evento da Agenda reagendado com validacao de conflitos."
          : "Reagendamento validado; evento derivado nao possui linha persistida para atualizar.",
        noBackendSchemaChange: !updatedSchedule,
        noFinancialSideEffects: true,
        noNotificationSideEffects: true,
        schedule,
        updatedSchedule: schedule,
        warnings: validation.warnings,
      };
    };

    if (typeof repository.withAgendaTransaction === "function") {
      return repository.withAgendaTransaction(run);
    }

    return run(repository);
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async previewRecurrence(input = {}) {
    return this.createRecurrenceService().previewRecurrence(input);
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async createRecurrenceSeries(input = {}) {
    return this.createRecurrenceService().createRecurrenceSeries(input);
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async getRecurrenceSeries(input = {}) {
    return this.createRecurrenceService().getRecurrenceSeries(input);
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async updateRecurrence(input = {}) {
    return this.createRecurrenceService().updateRecurrence(input);
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async cancelRecurrence(input = {}) {
    return this.createRecurrenceService().cancelRecurrence(input);
  }

  /**
   * @returns {AgendaConflictValidationService}
   */
  createConflictValidationService() {
    return new AgendaConflictValidationService({
      agendaRepository: this.agendaRepository,
      classFacade: this.classFacade,
    });
  }

  /**
   * @returns {AgendaRecurrenceService}
   */
  createRecurrenceService() {
    return new AgendaRecurrenceService({
      agendaRepository: this.agendaRepository,
      classFacade: this.classFacade,
    });
  }

  /**
   * @returns {import("../repositories/agenda.repository.js").AgendaRepository}
   */
  getAgendaRepository() {
    const repository = this.agendaRepository;

    if (!repository || typeof repository !== "object") {
      throw controlledError(
        "AgendaApplicationService requires an agendaRepository.",
        AGENDA_REPOSITORY_REQUIRED_CODE,
      );
    }

    for (const method of [
      "findSchedulesByClass",
      "findSchedulesByStudent",
      "findSchedulesByEnrollment",
    ]) {
      if (typeof repository[method] !== "function") {
        throw controlledError(
          `AgendaApplicationService requires agendaRepository.${method}.`,
          AGENDA_REPOSITORY_REQUIRED_CODE,
        );
      }
    }

    return repository;
  }

  /**
   * @param {string} enrollmentId
   * @returns {Promise<{ blocker: Record<string, unknown>|null, enrollment: Record<string, unknown>|null, usesEnrollmentFacade: boolean }>}
   */
  async findEnrollmentByIdWithFacade(enrollmentId) {
    const facade = this.enrollmentFacade;

    if (!facade || typeof facade !== "object") {
      return {
        blocker: createBlocker(
          AGENDA_ENROLLMENT_FACADE_UNAVAILABLE_CODE,
          "EnrollmentFacade is required to prepare an enrollment Agenda summary.",
        ),
        enrollment: null,
        usesEnrollmentFacade: false,
      };
    }

    try {
      if (typeof facade.findEnrollmentById === "function") {
        return {
          blocker: null,
          enrollment: await facade.findEnrollmentById(enrollmentId),
          usesEnrollmentFacade: true,
        };
      }

      if (typeof facade.getEnrollmentById === "function") {
        return {
          blocker: null,
          enrollment: await facade.getEnrollmentById({ enrollmentId }),
          usesEnrollmentFacade: true,
        };
      }
    } catch (error) {
      return {
        blocker: createBlocker(
          AGENDA_ENROLLMENT_FACADE_ERROR_CODE,
          "EnrollmentFacade failed while resolving the requested enrollment.",
          { errorMessage: readErrorMessage(error) },
        ),
        enrollment: null,
        usesEnrollmentFacade: true,
      };
    }

    return {
      blocker: createBlocker(
        AGENDA_ENROLLMENT_FACADE_READER_UNAVAILABLE_CODE,
        "EnrollmentFacade does not expose a read method for enrollmentId yet.",
      ),
      enrollment: null,
      usesEnrollmentFacade: true,
    };
  }

  /**
   * @param {{ enrollmentId: string }} input
   * @returns {Promise<{ blockers: Record<string, unknown>[], schedules: Record<string, unknown>[] }>}
   */
  async findEnrollmentSchedulesSafely(input) {
    try {
      return {
        blockers: [],
        schedules: await this.findSchedulesByEnrollment(input),
      };
    } catch (error) {
      return {
        blockers: [
          createBlocker(
            AGENDA_REPOSITORY_READ_ERROR_CODE,
            "AgendaRepository failed while reading enrollment schedule candidates.",
            { errorMessage: readErrorMessage(error) },
          ),
        ],
        schedules: [],
      };
    }
  }

  /**
   * @param {Array<string|number>} classIds
   * @returns {Promise<{ blockers: Record<string, unknown>[], usesClassFacade: boolean }>}
   */
  async validateClassesWithFacade(classIds) {
    if (!classIds.length) {
      return {
        blockers: [],
        usesClassFacade: false,
      };
    }

    const facade = this.classFacade;

    if (!facade || typeof facade !== "object") {
      return {
        blockers: [
          createBlocker(
            AGENDA_CLASS_FACADE_UNAVAILABLE_CODE,
            "ClassFacade is required to validate schedule class links.",
            { classIds },
          ),
        ],
        usesClassFacade: false,
      };
    }

    const blockers = [];

    for (const classId of classIds) {
      const validation = await this.findClassWithFacade(facade, classId);

      if (validation.blocker) {
        blockers.push(validation.blocker);
      }
    }

    return {
      blockers,
      usesClassFacade: true,
    };
  }

  /**
   * @param {Record<string, unknown>} facade
   * @param {string|number} classId
   * @returns {Promise<{ blocker: Record<string, unknown>|null }>}
   */
  async findClassWithFacade(facade, classId) {
    try {
      if (typeof facade.findActiveClassById === "function") {
        const classRecord = await facade.findActiveClassById({ classId });

        return {
          blocker: classRecord
            ? null
            : createBlocker(
                AGENDA_CLASS_NOT_FOUND_OR_INACTIVE_CODE,
                "ClassFacade did not return an active class for the schedule candidate.",
                { classId },
              ),
        };
      }

      if (typeof facade.findClassById === "function") {
        const classRecord = await facade.findClassById({ classId });

        if (!classRecord) {
          return {
            blocker: createBlocker(
              AGENDA_CLASS_NOT_FOUND_OR_INACTIVE_CODE,
              "ClassFacade did not return a class for the schedule candidate.",
              { classId },
            ),
          };
        }

        if (!isActiveClassRecord(classRecord)) {
          return {
            blocker: createBlocker(
              AGENDA_CLASS_NOT_FOUND_OR_INACTIVE_CODE,
              "ClassFacade returned an inactive class for the schedule candidate.",
              { classId },
            ),
          };
        }

        return { blocker: null };
      }
    } catch (error) {
      return {
        blocker: createBlocker(
          AGENDA_CLASS_FACADE_ERROR_CODE,
          "ClassFacade failed while validating a schedule class.",
          {
            classId,
            errorMessage: readErrorMessage(error),
          },
        ),
      };
    }

    return {
      blocker: createBlocker(
        AGENDA_CLASS_FACADE_READER_UNAVAILABLE_CODE,
        "ClassFacade does not expose a read method for classId yet.",
        { classId },
      ),
    };
  }

  /**
   * @returns {boolean}
   */
  supportsInitialAgendaPersistence() {
    const repository = this.agendaRepository;
    return Boolean(
      repository &&
        typeof repository === "object" &&
        typeof repository.createInitialAgendaForEnrollment === "function",
    );
  }
}

/**
 * @param {Record<string, unknown>[]} schedules
 * @returns {Record<string, unknown>[]}
 */
function normalizeScheduleList(schedules) {
  return Array.isArray(schedules)
    ? schedules.filter((schedule) => schedule && typeof schedule === "object")
    : [];
}

/**
 * @param {Record<string, unknown>} summary
 * @param {{ studentPersonId: string, studentProfileId: string }} scope
 * @returns {Record<string, unknown>}
 */
function normalizeAgendaSummary(summary, scope) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return buildAgendaSummary({
      schedules: [],
      scopeResolved: true,
      studentPersonId: scope.studentPersonId,
      studentProfileId: scope.studentProfileId,
    });
  }

  return {
    ...summary,
    noAttendanceCreated: true,
    noFinancialSideEffects: true,
    noNotificationSideEffects: true,
    noScheduleCreated: true,
    readOnly: true,
    scopeResolved: summary.scopeResolved !== false,
    studentPersonId: scope.studentPersonId,
    studentProfileId: scope.studentProfileId,
  };
}

/**
 * @param {{ schedules: Record<string, unknown>[], scopeResolved: boolean, studentPersonId?: string|null, studentProfileId?: string|null }} input
 * @returns {Record<string, unknown>}
 */
function buildAgendaSummary({
  schedules = [],
  scopeResolved = false,
  studentPersonId = null,
  studentProfileId = null,
} = {}) {
  const scheduleList = normalizeScheduleList(schedules);
  const classIds = Array.from(
    new Set(
      scheduleList
        .map((schedule) => schedule.classId)
        .filter((classId) => classId !== null && classId !== undefined)
        .map((classId) => String(classId)),
    ),
  );

  return {
    agendaSource: "j12_turmas via enrollment_class_links ACTIVE",
    classCount: classIds.length,
    classIds,
    hasSchedules: scheduleList.length > 0,
    limitations: [
      "Read summaries are derived from active Enrollment -> Turma links.",
      "Initial planned Agenda persistence uses enrollment_agenda_items when the repository is available.",
      "Attendance is not created or updated by this layer.",
      "Cancellation and replacement workflows are not implemented.",
    ],
    noAttendanceCreated: true,
    noFinancialSideEffects: true,
    noNotificationSideEffects: true,
    noScheduleCreated: true,
    readOnly: true,
    scheduleCount: scheduleList.length,
    schedules: scheduleList,
    scopeResolved,
    studentPersonId: studentPersonId || null,
    studentProfileId: studentProfileId || null,
  };
}

/**
 * @param {Object} input
 * @param {Record<string, unknown>[]} [input.blockers]
 * @param {boolean} [input.canCreateAgenda]
 * @param {string|number|null} [input.classId]
 * @param {Array<string|number>} [input.classIds]
 * @param {string|null} [input.enrollmentId]
 * @param {string|null} [input.enrollmentStatus]
 * @param {Record<string, unknown>[]} [input.schedules]
 * @param {string|null} [input.studentPersonId]
 * @param {string|null} [input.studentProfileId]
 * @param {boolean} [input.usesClassFacade]
 * @param {boolean} [input.usesEnrollmentFacade]
 * @returns {Record<string, unknown>}
 */
function buildEnrollmentAgendaSummary({
  blockers = [],
  classId = null,
  classIds = [],
  enrollmentId = null,
  enrollmentStatus = null,
  schedules = [],
  studentPersonId = null,
  studentProfileId = null,
  usesClassFacade = false,
  usesEnrollmentFacade = false,
} = {}) {
  const scheduleList = normalizeScheduleList(schedules);

  return {
    blockers: blockers.filter((blocker) => blocker && typeof blocker === "object"),
    classId: classId ?? null,
    classIds,
    enrollmentId: enrollmentId || null,
    enrollmentStatus: enrollmentStatus || null,
    hasSchedule: scheduleList.length > 0,
    noAttendanceCreated: true,
    noFinancialSideEffects: true,
    noNotificationSideEffects: true,
    noScheduleCreated: true,
    readOnly: true,
    schedules: scheduleList,
    studentPersonId: studentPersonId || null,
    studentProfileId: studentProfileId || null,
    usesClassFacade,
    usesEnrollmentFacade,
  };
}

/**
 * @param {Object} input
 * @param {Record<string, unknown>[]} [input.blockers]
 * @param {string|number|null} [input.classId]
 * @param {Array<string|number>} [input.classIds]
 * @param {string|null} [input.enrollmentId]
 * @param {string|null} [input.enrollmentStatus]
 * @param {string|null} [input.requestedBy]
 * @param {Record<string, unknown>[]} [input.scheduleCandidates]
 * @param {string|null} [input.studentPersonId]
 * @param {string|null} [input.studentProfileId]
 * @param {boolean} [input.usesClassFacade]
 * @param {boolean} [input.usesEnrollmentFacade]
 * @returns {Record<string, unknown>}
 */
function buildInitialAgendaPreparation({
  blockers = [],
  canCreateAgenda = false,
  classId = null,
  classIds = [],
  enrollmentId = null,
  enrollmentStatus = null,
  requestedBy = null,
  scheduleCandidates = [],
  studentPersonId = null,
  studentProfileId = null,
  usesClassFacade = false,
  usesEnrollmentFacade = false,
} = {}) {
  const candidateList = normalizeScheduleList(scheduleCandidates);
  const blockerList = normalizeBlockerList(blockers);
  const hasClassLink = Boolean(
    (classId !== null && classId !== undefined) ||
      classIds.length > 0 ||
      candidateList.some((candidate) => candidate.classId ?? candidate.class_id),
  );
  const hasTrustedClassSchedule = candidateList.some(hasTrustedScheduleFields);
  const agendaCanBeCreated = Boolean(canCreateAgenda && blockerList.length === 0);

  return {
    agendaCreated: false,
    blockers: blockerList,
    canCreateAgenda: agendaCanBeCreated,
    classId: classId ?? null,
    classIds,
    creationBlocked: !agendaCanBeCreated,
    enrollmentId: enrollmentId || null,
    enrollmentStatus: enrollmentStatus || null,
    hasClassLink,
    hasTrustedClassSchedule,
    initialAgendaPrepared: Boolean(enrollmentId && hasClassLink && hasTrustedClassSchedule),
    noAttendanceCreated: true,
    noFakeAgendaCreated: true,
    noFakeScheduleCreated: true,
    noFinancialSideEffects: true,
    noNotificationSideEffects: true,
    noScheduleCreated: true,
    noTestDataLeft: true,
    readOnly: true,
    requestedBy: requestedBy || null,
    scheduleCandidateCount: candidateList.length,
    scheduleCandidates: candidateList,
    studentPersonId: studentPersonId || null,
    studentProfileId: studentProfileId || null,
    usesClassFacade,
    usesEnrollmentFacade,
  };
}

/**
 * @param {Object} input
 * @returns {Record<string, unknown>}
 */
function buildInitialAgendaPersistenceResult(input = {}) {
  const agendaItems = normalizeScheduleList(input.agendaItems);
  const createdCount = Number(input.createdCount || 0);
  const reusedCount = Number(input.reusedCount || 0);

  return {
    ...buildInitialAgendaPreparation({
      ...input,
      canCreateAgenda: true,
    }),
    agendaCreated: createdCount > 0,
    agendaItems,
    agendaReused: createdCount === 0 && agendaItems.length > 0,
    canCreateAgenda: true,
    createdCount,
    creationBlocked: false,
    duplicateAgendaReusedOrBlocked: true,
    initialAgendaPrepared: true,
    initialAgendaPersistenceEnabled: true,
    noScheduleCreated: false,
    persistedAgendaCount: agendaItems.length,
    readOnly: false,
    reusedCount,
  };
}

/**
 * @param {Record<string, unknown>} input
 * @param {Record<string, unknown>} normalizedEvent
 * @returns {Record<string, unknown>}
 */
function buildRescheduledScheduleFromInput(input = {}, normalizedEvent = {}) {
  return {
    agendaItemId: normalizedEvent.agendaItemId || input.agendaItemId || null,
    classId: normalizedEvent.classId || input.classId || null,
    courtId: normalizedEvent.courtId || input.courtId || input.quadraId || null,
    courtName: normalizedEvent.courtName || input.courtName || input.quadraName || null,
    endTime: normalizedEvent.endTime || input.toEndTime || input.endTime || null,
    enrollmentId: normalizedEvent.enrollmentId || input.enrollmentId || null,
    id: normalizedEvent.agendaItemId || input.scheduleId || input.calendarEventId || null,
    noAttendanceCreated: true,
    noFinancialSideEffects: true,
    noNotificationSideEffects: true,
    persistedAgenda: Boolean(normalizedEvent.agendaItemId),
    professorId: normalizedEvent.professorId || input.professorId || null,
    professorName: normalizedEvent.professorName || input.professorName || null,
    quadraId: normalizedEvent.courtId || input.quadraId || input.courtId || null,
    quadraName: normalizedEvent.courtName || input.quadraName || input.courtName || null,
    scheduleDate: normalizedEvent.date || input.toDate || input.date || null,
    scheduleStatus: "ACTIVE",
    startTime: normalizedEvent.startTime || input.toStartTime || input.startTime || null,
    status: "ACTIVE",
    studentPersonId: normalizedEvent.studentPersonId || input.studentPersonId || null,
    studentProfileId: normalizedEvent.studentProfileId || input.studentProfileId || null,
  };
}

/**
 * @param {Record<string, unknown>} input
 * @returns {{ studentPersonId: string|null, studentProfileId: string|null, valid: boolean }}
 */
function normalizeStudentScope(input = {}) {
  const studentPersonId = nullableText(input.studentPersonId ?? input.student_person_id, 64);
  const studentProfileId = nullableText(input.studentProfileId ?? input.student_profile_id, 64);

  return {
    studentPersonId,
    studentProfileId,
    valid: Boolean(studentPersonId && studentProfileId),
  };
}

/**
 * @param {unknown} result
 * @returns {{ agendaItems: Record<string, unknown>[], createdCount: number, reusedCount: number }}
 */
function normalizeAgendaPersistenceResult(result) {
  const data = result && typeof result === "object" && !Array.isArray(result) ? result : {};

  return {
    agendaItems: normalizeScheduleList(data.agendaItems),
    createdCount: Number(data.createdCount || 0),
    reusedCount: Number(data.reusedCount || 0),
  };
}

/**
 * @param {Record<string, unknown>[]} blockers
 * @returns {Record<string, unknown>[]}
 */
function normalizeBlockerList(blockers) {
  return Array.isArray(blockers)
    ? blockers.filter((blocker) => blocker && typeof blocker === "object")
    : [];
}

/**
 * @param {Record<string, unknown>[]} blockers
 * @returns {boolean}
 */
function canEvaluateInitialAgendaCreation(blockers) {
  const hardBlockerCodes = new Set([
    AGENDA_CLASS_FACADE_ERROR_CODE,
    AGENDA_CLASS_FACADE_READER_UNAVAILABLE_CODE,
    AGENDA_CLASS_FACADE_UNAVAILABLE_CODE,
    AGENDA_CLASS_NOT_FOUND_OR_INACTIVE_CODE,
    AGENDA_ENROLLMENT_FACADE_ERROR_CODE,
    AGENDA_ENROLLMENT_FACADE_READER_UNAVAILABLE_CODE,
    AGENDA_ENROLLMENT_FACADE_UNAVAILABLE_CODE,
    AGENDA_ENROLLMENT_ID_REQUIRED_CODE,
    AGENDA_ENROLLMENT_NOT_ACTIVE_CODE,
    AGENDA_ENROLLMENT_NOT_FOUND_CODE,
    AGENDA_ENROLLMENT_STUDENT_SCOPE_MISSING_CODE,
    AGENDA_REPOSITORY_READ_ERROR_CODE,
  ]);

  return normalizeBlockerList(blockers).every((blocker) => !hardBlockerCodes.has(blocker.code));
}

/**
 * @param {Record<string, unknown>[]} scheduleCandidates
 * @returns {{ blockers: Record<string, unknown>[], hasTrustedClassSchedule: boolean }}
 */
function validateTrustedScheduleCandidates(scheduleCandidates) {
  const candidates = normalizeScheduleList(scheduleCandidates);

  if (candidates.length === 0) {
    return {
      blockers: [],
      hasTrustedClassSchedule: false,
    };
  }

  const hasTrustedClassSchedule = candidates.some(hasTrustedScheduleFields);

  if (hasTrustedClassSchedule) {
    return {
      blockers: [],
      hasTrustedClassSchedule: true,
    };
  }

  return {
    blockers: [
      createBlocker(
        AGENDA_INITIAL_CLASS_SCHEDULE_NOT_TRUSTED_CODE,
        "Class schedule candidates do not expose enough real schedule data for Agenda creation.",
        {
          requiredFields: ["classId", "daysOfWeek", "startTime"],
          scheduleCandidateCount: candidates.length,
        },
      ),
    ],
    hasTrustedClassSchedule: false,
  };
}

/**
 * @param {Record<string, unknown>} schedule
 * @returns {boolean}
 */
function hasTrustedScheduleFields(schedule) {
  const classId = normalizeClassId(schedule?.classId ?? schedule?.class_id);
  const daysOfWeek = Array.isArray(schedule?.daysOfWeek)
    ? schedule.daysOfWeek.filter(Boolean)
    : [];
  const startTime = nullableText(schedule?.startTime ?? schedule?.start_time, 20);

  return Boolean(classId && daysOfWeek.length > 0 && startTime);
}

/**
 * @param {Record<string, unknown>[]} schedules
 * @returns {Array<string|number>}
 */
function readClassIdsFromSchedules(schedules) {
  return Array.from(
    new Set(
      normalizeScheduleList(schedules)
        .map((schedule) => schedule.classId ?? schedule.class_id)
        .filter((classId) => classId !== null && classId !== undefined && classId !== "")
        .map((classId) => {
          const parsed = normalizeClassId(classId);
          return parsed || String(classId);
        }),
    ),
  );
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizeClassId(value) {
  const normalized = String(value ?? "").trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeUpperText(value) {
  const normalized = nullableText(value, 64);
  return normalized ? normalized.toUpperCase() : null;
}

/**
 * @param {Record<string, unknown>} source
 * @param {string[]} keys
 * @returns {unknown}
 */
function readFirstDefined(source, keys) {
  for (const key of keys) {
    if (source?.[key] != null) {
      return source[key];
    }
  }

  return null;
}

/**
 * @param {Record<string, unknown>} classRecord
 * @returns {boolean}
 */
function isActiveClassRecord(classRecord) {
  const active = classRecord?.active;

  if (typeof active === "boolean") {
    return active;
  }

  const normalized = nullableText(readFirstDefined(classRecord, ["status", "rawStatus"]), 32)
    ?.toLowerCase();

  if (["inativa", "inativo", "inactive", "false", "0"].includes(normalized || "")) {
    return false;
  }

  return true;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {Record<string, unknown>}
 */
function createBlocker(code, message, details = {}) {
  return {
    code,
    details,
    message,
  };
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function readErrorMessage(error) {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
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
 * @returns {Error}
 */
function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

module.exports = {
  ACTIVE_ENROLLMENT_STATUS,
  AGENDA_CLASS_FACADE_UNAVAILABLE_CODE,
  AGENDA_CLASS_NOT_FOUND_OR_INACTIVE_CODE,
  AGENDA_ENROLLMENT_FACADE_READER_UNAVAILABLE_CODE,
  AGENDA_ENROLLMENT_FACADE_UNAVAILABLE_CODE,
  AGENDA_ENROLLMENT_ID_REQUIRED_CODE,
  AGENDA_ENROLLMENT_NOT_ACTIVE_CODE,
  AGENDA_ENROLLMENT_NOT_FOUND_CODE,
  AGENDA_ENROLLMENT_SCHEDULES_NOT_FOUND_CODE,
  AGENDA_ENROLLMENT_STUDENT_SCOPE_MISSING_CODE,
  AGENDA_INITIAL_CLASS_LINK_REQUIRED_CODE,
  AGENDA_INITIAL_CLASS_SCHEDULE_NOT_TRUSTED_CODE,
  AGENDA_INITIAL_CREATION_SCHEMA_GAP_CODE,
  AGENDA_INITIAL_IDEMPOTENCY_GAP_CODE,
  AGENDA_INITIAL_PERSISTENCE_ERROR_CODE,
  AGENDA_INITIAL_PERSISTENCE_REPOSITORY_UNAVAILABLE_CODE,
  AGENDA_CONFLICT_VALIDATION_FAILED_CODE,
  AGENDA_REPOSITORY_REQUIRED_CODE,
  AgendaApplicationService,
  buildAgendaSummary,
  buildEnrollmentAgendaSummary,
  buildInitialAgendaPreparation,
  buildInitialAgendaPersistenceResult,
  normalizeClassId,
  normalizeStudentScope,
};
