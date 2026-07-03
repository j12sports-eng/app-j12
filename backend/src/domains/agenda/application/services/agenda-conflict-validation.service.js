const AGENDA_CONFLICT_VALIDATION_FAILED_CODE = "AGENDA_CONFLICT_VALIDATION_FAILED";
const AGENDA_EVENT_DATE_REQUIRED_CODE = "AGENDA_EVENT_DATE_REQUIRED";
const AGENDA_EVENT_TIME_REQUIRED_CODE = "AGENDA_EVENT_TIME_REQUIRED";
const AGENDA_EVENT_TIME_RANGE_INVALID_CODE = "AGENDA_EVENT_TIME_RANGE_INVALID";
const AGENDA_EVENT_CANCELLED_CODE = "AGENDA_EVENT_CANCELLED";
const AGENDA_EVENT_COMPLETED_CODE = "AGENDA_EVENT_COMPLETED";
const AGENDA_CONFLICT_PROFESSOR_OVERLAP_CODE = "AGENDA_CONFLICT_PROFESSOR_OVERLAP";
const AGENDA_CONFLICT_COURT_OVERLAP_CODE = "AGENDA_CONFLICT_COURT_OVERLAP";
const AGENDA_CONFLICT_STUDENT_OVERLAP_CODE = "AGENDA_CONFLICT_STUDENT_OVERLAP";
const AGENDA_CONFLICT_CLASS_DUPLICATE_CODE = "AGENDA_CONFLICT_CLASS_DUPLICATE";
const AGENDA_CONFLICT_CLASS_CAPACITY_FULL_CODE = "AGENDA_CONFLICT_CLASS_CAPACITY_FULL";
const AGENDA_CONFLICT_CLASS_CAPACITY_OVERBOOKED_CODE =
  "AGENDA_CONFLICT_CLASS_CAPACITY_OVERBOOKED";
const AGENDA_CONFLICT_ADMIN_BLOCK_CODE = "AGENDA_CONFLICT_ADMIN_BLOCK";
const AGENDA_CONFLICT_DATE_UNAVAILABLE_CODE = "AGENDA_CONFLICT_DATE_UNAVAILABLE";
const AGENDA_CONFLICT_REPOSITORY_ERROR_CODE = "AGENDA_CONFLICT_REPOSITORY_ERROR";
const AGENDA_RECURRENCE_SCOPE_WARNING_CODE = "AGENDA_RECURRENCE_SCOPE_WARNING";
const AGENDA_RECURRENCE_INTEGRITY_CODE = "AGENDA_RECURRENCE_INTEGRITY";

const CRITICAL_SEVERITY = "CRITICAL";
const WARNING_SEVERITY = "WARNING";
const DEFAULT_EVENT_DURATION_MINUTES = 60;

const WEEKDAY_LABELS = Object.freeze([
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
]);

const WEEKDAY_ALIASES = new Map([
  ["0", 0],
  ["7", 0],
  ["domingo", 0],
  ["dom", 0],
  ["sunday", 0],
  ["sun", 0],
  ["1", 1],
  ["segunda", 1],
  ["segunda-feira", 1],
  ["seg", 1],
  ["monday", 1],
  ["mon", 1],
  ["2", 2],
  ["terca", 2],
  ["terça", 2],
  ["terca-feira", 2],
  ["terça-feira", 2],
  ["ter", 2],
  ["tuesday", 2],
  ["tue", 2],
  ["3", 3],
  ["quarta", 3],
  ["quarta-feira", 3],
  ["qua", 3],
  ["wednesday", 3],
  ["wed", 3],
  ["4", 4],
  ["quinta", 4],
  ["quinta-feira", 4],
  ["qui", 4],
  ["thursday", 4],
  ["thu", 4],
  ["5", 5],
  ["sexta", 5],
  ["sexta-feira", 5],
  ["sex", 5],
  ["friday", 5],
  ["fri", 5],
  ["6", 6],
  ["sabado", 6],
  ["sábado", 6],
  ["sab", 6],
  ["saturday", 6],
  ["sat", 6],
]);

/**
 * Centralized Agenda conflict validator.
 *
 * The service is intentionally side-effect free. It can be reused before
 * create, edit, move and reschedule flows, while the caller decides whether to
 * persist after `canConfirm` is true.
 */
class AgendaConflictValidationService {
  /**
   * @param {Object} [options]
   * @param {Record<string, Function>|null} [options.agendaRepository]
   * @param {Record<string, Function>|null} [options.classFacade]
   */
  constructor({ agendaRepository = null, classFacade = null } = {}) {
    this.agendaRepository = agendaRepository;
    this.classFacade = classFacade;
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async validateAgendaEvent(input = {}) {
    const event = normalizeAgendaEvent(input);
    const conflicts = [];

    conflicts.push(...validateRequiredEventFields(event));
    conflicts.push(...validateEventLifecycle(event));
    conflicts.push(...validateRecurrenceIntegrity(event));
    conflicts.push(...validateUnavailableDates(event, input));

    if (event.hasValidWindow) {
      const [candidates, adminBlocks, capacitySummary] = await Promise.all([
        this.readConflictCandidates(event, input),
        this.readAdministrativeBlocks(event, input),
        this.readCapacitySummary(event, input),
      ]);

      conflicts.push(...candidates.conflicts);
      conflicts.push(...buildScheduleConflicts(event, candidates.items));
      conflicts.push(...adminBlocks.conflicts);
      conflicts.push(...buildAdministrativeBlockConflicts(event, adminBlocks.items));
      conflicts.push(...buildCapacityConflicts(event, capacitySummary));
    }

    return buildValidationResult(event, conflicts, input);
  }

  /**
   * @param {Record<string, unknown>} event
   * @param {Record<string, unknown>} input
   * @returns {Promise<{ conflicts: Record<string, unknown>[], items: Record<string, unknown>[] }>}
   */
  async readConflictCandidates(event, input) {
    const inlineCandidates = normalizeObjectArray(
      input.conflictCandidates || input.candidates || input.schedules,
    );

    if (inlineCandidates.length > 0) {
      return {
        conflicts: [],
        items: inlineCandidates.map(normalizeAgendaEvent),
      };
    }

    const repository = this.agendaRepository;

    if (!repository || typeof repository.findAgendaConflictCandidates !== "function") {
      return {
        conflicts: [],
        items: [],
      };
    }

    try {
      const items = await repository.findAgendaConflictCandidates({
        agendaItemId: event.agendaItemId,
        date: event.date,
        dayOfWeek: event.dayOfWeek,
        endTime: event.endTime,
        eventId: event.eventId,
        lockForUpdate: input.lockForUpdate === true,
        startTime: event.startTime,
      });

      return {
        conflicts: [],
        items: normalizeObjectArray(items).map(normalizeAgendaEvent),
      };
    } catch (error) {
      return {
        conflicts: [
          createConflict({
            code: AGENDA_CONFLICT_REPOSITORY_ERROR_CODE,
            details: { errorMessage: readErrorMessage(error) },
            message: "Nao foi possivel validar conflitos da agenda no banco de dados.",
          }),
        ],
        items: [],
      };
    }
  }

  /**
   * @param {Record<string, unknown>} event
   * @param {Record<string, unknown>} input
   * @returns {Promise<{ conflicts: Record<string, unknown>[], items: Record<string, unknown>[] }>}
   */
  async readAdministrativeBlocks(event, input) {
    const inlineBlocks = normalizeObjectArray(
      input.administrativeBlocks || input.blockedSlots || input.blocks,
    );
    const repository = this.agendaRepository;

    if (!repository || typeof repository.findAgendaAdministrativeBlocks !== "function") {
      return {
        conflicts: [],
        items: inlineBlocks.map(normalizeAdministrativeBlock),
      };
    }

    try {
      const persistedBlocks = await repository.findAgendaAdministrativeBlocks({
        classId: event.classId,
        courtId: event.courtId,
        courtName: event.courtName,
        date: event.date,
        dayOfWeek: event.dayOfWeek,
        endTime: event.endTime,
        professorId: event.professorId,
        professorName: event.professorName,
        startTime: event.startTime,
      });

      return {
        conflicts: [],
        items: [...inlineBlocks, ...normalizeObjectArray(persistedBlocks)].map(
          normalizeAdministrativeBlock,
        ),
      };
    } catch (error) {
      return {
        conflicts: [
          createConflict({
            code: AGENDA_CONFLICT_REPOSITORY_ERROR_CODE,
            details: { errorMessage: readErrorMessage(error) },
            message: "Nao foi possivel validar bloqueios administrativos da agenda.",
          }),
        ],
        items: inlineBlocks.map(normalizeAdministrativeBlock),
      };
    }
  }

  /**
   * @param {Record<string, unknown>} event
   * @param {Record<string, unknown>} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async readCapacitySummary(event, input) {
    if (!event.classId) {
      return null;
    }

    const inlineSummary = readObject(input.capacitySummary || input.classCapacitySummary);

    if (Object.keys(inlineSummary).length > 0) {
      return inlineSummary;
    }

    const facade = this.classFacade;

    if (!facade || typeof facade.getClassCapacitySummary !== "function") {
      return null;
    }

    try {
      return await facade.getClassCapacitySummary({
        classId: event.classId,
        lockForUpdate: input.lockForUpdate === true,
        occupancySource: "enrollment_class_links",
      });
    } catch {
      return null;
    }
  }
}

/**
 * @param {Record<string, unknown>} event
 * @returns {Record<string, unknown>[]}
 */
function validateRequiredEventFields(event) {
  const conflicts = [];

  if (!event.date && event.dayOfWeek == null) {
    conflicts.push(
      createConflict({
        code: AGENDA_EVENT_DATE_REQUIRED_CODE,
        message: "Informe a data ou o dia da semana do evento da agenda.",
      }),
    );
  }

  if (!event.startTime) {
    conflicts.push(
      createConflict({
        code: AGENDA_EVENT_TIME_REQUIRED_CODE,
        message: "Informe o horario inicial do evento da agenda.",
      }),
    );
  }

  if (event.startMinutes != null && event.endMinutes != null && event.startMinutes >= event.endMinutes) {
    conflicts.push(
      createConflict({
        code: AGENDA_EVENT_TIME_RANGE_INVALID_CODE,
        message: "Horario final deve ser maior que o horario inicial.",
      }),
    );
  }

  return conflicts;
}

/**
 * @param {Record<string, unknown>} event
 * @returns {Record<string, unknown>[]}
 */
function validateEventLifecycle(event) {
  if (["CANCELLED", "CANCELADO", "CANCELADA"].includes(event.status)) {
    return [
      createConflict({
        code: AGENDA_EVENT_CANCELLED_CODE,
        details: { status: event.status },
        message: "Evento cancelado nao pode ser confirmado ou movimentado.",
      }),
    ];
  }

  if (["COMPLETED", "ENCERRADO", "ENCERRADA", "CONCLUIDO", "CONCLUIDA"].includes(event.status)) {
    return [
      createConflict({
        code: AGENDA_EVENT_COMPLETED_CODE,
        details: { status: event.status },
        message: "Evento encerrado nao pode ser confirmado ou movimentado.",
      }),
    ];
  }

  return [];
}

/**
 * @param {Record<string, unknown>} event
 * @returns {Record<string, unknown>[]}
 */
function validateRecurrenceIntegrity(event) {
  const conflicts = [];

  if (event.recurrenceExceptionOfAgendaItemId && !event.agendaItemId) {
    conflicts.push(
      createConflict({
        code: AGENDA_RECURRENCE_INTEGRITY_CODE,
        message: "Excecao de recorrencia precisa estar vinculada a um evento individual.",
      }),
    );
  }

  if (
    event.isRecurringProjection &&
    ["EDIT", "MOVE", "RESCHEDULE"].includes(event.action) &&
    !event.recurrenceUpdateScope
  ) {
    conflicts.push(
      createConflict({
        blocking: false,
        code: AGENDA_RECURRENCE_SCOPE_WARNING_CODE,
        message:
          "Evento recorrente sem escopo de atualizacao definido; sera tratado como ajuste individual.",
        severity: WARNING_SEVERITY,
      }),
    );
  }

  return conflicts;
}

/**
 * @param {Record<string, unknown>} event
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>[]}
 */
function validateUnavailableDates(event, input) {
  const unavailableDates = normalizeStringArray(input.unavailableDates || input.unavailable_dates);

  if (!event.date || !unavailableDates.includes(event.date)) {
    return [];
  }

  return [
    createConflict({
      code: AGENDA_CONFLICT_DATE_UNAVAILABLE_CODE,
      details: { date: event.date },
      message: "Data indisponivel para eventos da agenda.",
    }),
  ];
}

/**
 * @param {Record<string, unknown>} event
 * @param {Record<string, unknown>[]} candidates
 * @returns {Record<string, unknown>[]}
 */
function buildScheduleConflicts(event, candidates) {
  const conflicts = [];

  for (const candidate of candidates) {
    if (isSameEvent(event, candidate) || !isComparableWindow(event, candidate)) {
      continue;
    }

    if (matchesProfessor(event, candidate)) {
      conflicts.push(
        createConflict({
          code: AGENDA_CONFLICT_PROFESSOR_OVERLAP_CODE,
          conflictEventId: candidate.eventId || candidate.agendaItemId,
          details: conflictDetails(event, candidate),
          message: "Professor ja possui outro evento no mesmo periodo.",
          resourceId: event.professorId || event.professorName,
          resourceType: "PROFESSOR",
        }),
      );
    }

    if (matchesCourt(event, candidate)) {
      conflicts.push(
        createConflict({
          code: AGENDA_CONFLICT_COURT_OVERLAP_CODE,
          conflictEventId: candidate.eventId || candidate.agendaItemId,
          details: conflictDetails(event, candidate),
          message: "Quadra ocupada no mesmo periodo.",
          resourceId: event.courtId || event.courtName,
          resourceType: "COURT",
        }),
      );
    }

    if (matchesStudent(event, candidate)) {
      conflicts.push(
        createConflict({
          code: AGENDA_CONFLICT_STUDENT_OVERLAP_CODE,
          conflictEventId: candidate.eventId || candidate.agendaItemId,
          details: conflictDetails(event, candidate),
          message: "Aluno matriculado em dois eventos simultaneos.",
          resourceId: event.studentProfileId || event.studentPersonId || event.enrollmentId,
          resourceType: "STUDENT",
        }),
      );
    }

    if (matchesClass(event, candidate)) {
      conflicts.push(
        createConflict({
          code: AGENDA_CONFLICT_CLASS_DUPLICATE_CODE,
          conflictEventId: candidate.eventId || candidate.agendaItemId,
          details: conflictDetails(event, candidate),
          message: "Turma duplicada no mesmo horario.",
          resourceId: event.classId,
          resourceType: "CLASS",
        }),
      );
    }
  }

  return conflicts;
}

/**
 * @param {Record<string, unknown>} event
 * @param {Record<string, unknown>[]} blocks
 * @returns {Record<string, unknown>[]}
 */
function buildAdministrativeBlockConflicts(event, blocks) {
  return blocks
    .filter((block) => matchesAdministrativeBlock(event, block))
    .map((block) =>
      createConflict({
        blocking: block.blocking,
        code:
          block.type === "UNAVAILABLE_DATE"
            ? AGENDA_CONFLICT_DATE_UNAVAILABLE_CODE
            : AGENDA_CONFLICT_ADMIN_BLOCK_CODE,
        details: {
          blockId: block.id,
          date: block.date,
          dayOfWeek: block.dayOfWeek,
          endTime: block.endTime,
          resourceId: block.resourceId,
          resourceType: block.resourceType,
          startTime: block.startTime,
        },
        message:
          block.message ||
          (block.type === "UNAVAILABLE_DATE"
            ? "Data indisponivel para eventos da agenda."
            : "Horario bloqueado pela administracao."),
        resourceId: block.resourceId,
        resourceType: block.resourceType || "ADMIN_BLOCK",
        severity: block.severity,
      }),
    );
}

/**
 * @param {Record<string, unknown>} event
 * @param {Record<string, unknown>|null} summary
 * @returns {Record<string, unknown>[]}
 */
function buildCapacityConflicts(event, summary) {
  if (!summary || typeof summary !== "object") {
    return [];
  }

  const capacityTotal = normalizeOptionalInteger(
    summary.capacityTotal ?? summary.capacity ?? summary.capacidade,
  );
  const occupiedSlots = normalizeOptionalInteger(
    summary.occupiedSlots ?? summary.currentStudentCount ?? summary.studentCount,
  );

  if (!Number.isInteger(capacityTotal) || capacityTotal <= 0 || !Number.isInteger(occupiedSlots)) {
    return [];
  }

  if (occupiedSlots > capacityTotal) {
    return [
      createConflict({
        code: AGENDA_CONFLICT_CLASS_CAPACITY_OVERBOOKED_CODE,
        details: { capacityTotal, classId: event.classId, occupiedSlots },
        message: "Turma acima da capacidade maxima configurada.",
        resourceId: event.classId,
        resourceType: "CLASS",
      }),
    ];
  }

  if (occupiedSlots >= capacityTotal) {
    const blocksCreation = ["CREATE", "EDIT"].includes(event.action) && event.capacityAffectsEnrollment;

    return [
      createConflict({
        blocking: blocksCreation,
        code: AGENDA_CONFLICT_CLASS_CAPACITY_FULL_CODE,
        details: { capacityTotal, classId: event.classId, occupiedSlots },
        message: "Turma atingiu a capacidade maxima configurada.",
        resourceId: event.classId,
        resourceType: "CLASS",
        severity: blocksCreation ? CRITICAL_SEVERITY : WARNING_SEVERITY,
      }),
    ];
  }

  return [];
}

/**
 * @param {Record<string, unknown>} event
 * @param {Record<string, unknown>} block
 * @returns {boolean}
 */
function matchesAdministrativeBlock(event, block) {
  if (!block) {
    return false;
  }

  const sameDate = block.date && event.date ? block.date === event.date : true;
  const sameDay = block.dayOfWeek == null || event.dayOfWeek == null || block.dayOfWeek === event.dayOfWeek;

  if (!sameDate || !sameDay) {
    return false;
  }

  if (block.type !== "UNAVAILABLE_DATE" && !timeWindowsOverlap(event, block)) {
    return false;
  }

  if (!block.resourceType || !block.resourceId) {
    return true;
  }

  if (block.resourceType === "CLASS") {
    return String(block.resourceId) === String(event.classId || "");
  }

  if (block.resourceType === "PROFESSOR") {
    return (
      String(block.resourceId) === String(event.professorId || "") ||
      normalizeComparable(block.resourceName) === event.professorNameComparable
    );
  }

  if (block.resourceType === "COURT") {
    return (
      String(block.resourceId) === String(event.courtId || "") ||
      normalizeComparable(block.resourceName) === event.courtNameComparable
    );
  }

  return true;
}

/**
 * @param {Record<string, unknown>} event
 * @param {Record<string, unknown>} candidate
 * @returns {Record<string, unknown>}
 */
function conflictDetails(event, candidate) {
  return {
    candidateClassId: candidate.classId,
    candidateDate: candidate.date,
    candidateEndTime: candidate.endTime,
    candidateStartTime: candidate.startTime,
    date: event.date,
    dayOfWeek: event.dayOfWeek,
    endTime: event.endTime,
    startTime: event.startTime,
  };
}

function isSameEvent(event, candidate) {
  const eventIds = [event.eventId, event.agendaItemId, event.scheduleId].filter(Boolean).map(String);
  const candidateIds = [candidate.eventId, candidate.agendaItemId, candidate.scheduleId]
    .filter(Boolean)
    .map(String);

  return eventIds.some((id) => candidateIds.includes(id));
}

function isComparableWindow(event, candidate) {
  if (!timeWindowsOverlap(event, candidate)) {
    return false;
  }

  if (event.date && candidate.date) {
    return event.date === candidate.date;
  }

  return event.dayOfWeek != null && candidate.dayOfWeek != null && event.dayOfWeek === candidate.dayOfWeek;
}

function timeWindowsOverlap(left, right) {
  if (left.startMinutes == null || right.startMinutes == null) {
    return false;
  }

  const leftEnd = left.endMinutes ?? left.startMinutes + DEFAULT_EVENT_DURATION_MINUTES;
  const rightEnd = right.endMinutes ?? right.startMinutes + DEFAULT_EVENT_DURATION_MINUTES;

  return left.startMinutes < rightEnd && leftEnd > right.startMinutes;
}

function matchesProfessor(event, candidate) {
  return Boolean(
    (event.professorId && event.professorId === candidate.professorId) ||
      (event.professorNameComparable &&
        event.professorNameComparable === candidate.professorNameComparable),
  );
}

function matchesCourt(event, candidate) {
  return Boolean(
    (event.courtId && event.courtId === candidate.courtId) ||
      (event.courtNameComparable && event.courtNameComparable === candidate.courtNameComparable),
  );
}

function matchesStudent(event, candidate) {
  const sameEnrollment = event.enrollmentId && event.enrollmentId === candidate.enrollmentId;
  const sameStudentProfile =
    event.studentProfileId &&
    candidate.studentProfileId &&
    event.studentProfileId === candidate.studentProfileId;
  const sameStudentScope =
    event.studentPersonId &&
    event.studentProfileId &&
    event.studentPersonId === candidate.studentPersonId &&
    event.studentProfileId === candidate.studentProfileId;

  return Boolean(sameEnrollment || sameStudentProfile || sameStudentScope);
}

function matchesClass(event, candidate) {
  return Boolean(event.classId && event.classId === candidate.classId);
}

/**
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
function normalizeAgendaEvent(input = {}) {
  const source = readObject(input);
  const metadata = readObject(source.metadata);
  const targetDate = normalizeDateString(
    source.toDate ??
      source.date ??
      source.scheduleDate ??
      source.attendanceDate ??
      source.recurrenceInstanceDate,
  );
  const dayOfWeek = normalizeDayOfWeek(
    source.dayOfWeek ?? source.day_of_week ?? (targetDate ? parseDateDayOfWeek(targetDate) : null),
  );
  const startTime = normalizeTime(source.toStartTime ?? source.startTime ?? source.start_time);
  const endTime = normalizeTime(source.toEndTime ?? source.endTime ?? source.end_time);
  const startMinutes = toTimeMinutes(startTime);
  const endMinutes = toTimeMinutes(endTime);
  const action = normalizeUpper(source.action || source.operation || "VALIDATE") || "VALIDATE";
  const status = normalizeUpper(
    source.scheduleStatus || source.status || source.classStatus || "ACTIVE",
  );

  return {
    action,
    agendaItemId: nullableText(source.agendaItemId ?? source.agenda_item_id, 64),
    capacityAffectsEnrollment: source.capacityAffectsEnrollment !== false,
    classId: nullableText(source.classId ?? source.class_id, 64),
    courtId: nullableText(
      source.courtId ?? source.quadraId ?? metadata.courtId ?? metadata.quadraId,
      64,
    ),
    courtName: nullableText(
      source.courtName ?? source.quadraName ?? metadata.courtName ?? metadata.quadraName,
      191,
    ),
    courtNameComparable: normalizeComparable(
      source.courtName ?? source.quadraName ?? metadata.courtName ?? metadata.quadraName,
    ),
    date: targetDate,
    dayOfWeek,
    endMinutes,
    endTime,
    enrollmentId: nullableText(source.enrollmentId ?? source.enrollment_id, 64),
    eventId: nullableText(source.eventId ?? source.calendarEventId ?? source.id, 191),
    hasValidWindow: Boolean(
      (targetDate || dayOfWeek != null) &&
        startTime &&
        startMinutes != null &&
        (endMinutes == null || startMinutes < endMinutes),
    ),
    isRecurringProjection: source.isRecurringProjection === true,
    professorId: nullableText(
      source.professorId ?? source.professor_id ?? metadata.professorId,
      64,
    ),
    professorName: nullableText(
      source.professorName ?? source.professor_name ?? metadata.professorName,
      191,
    ),
    professorNameComparable: normalizeComparable(
      source.professorName ?? source.professor_name ?? metadata.professorName,
    ),
    recurrenceExceptionOfAgendaItemId: nullableText(
      source.recurrenceExceptionOfAgendaItemId ?? source.replacementOfAgendaItemId,
      64,
    ),
    recurrenceType: nullableText(source.recurrenceType ?? source.recurrence, 32),
    recurrenceUpdateScope: normalizeUpper(source.recurrenceUpdateScope),
    scheduleId: nullableText(source.scheduleId ?? source.schedule_id, 191),
    startMinutes,
    startTime,
    status,
    studentPersonId: nullableText(source.studentPersonId ?? source.student_person_id, 64),
    studentProfileId: nullableText(source.studentProfileId ?? source.student_profile_id, 64),
  };
}

/**
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
function normalizeAdministrativeBlock(input = {}) {
  const source = readObject(input);
  const date = normalizeDateString(source.date ?? source.blockDate ?? source.block_date);
  const dayOfWeek = normalizeDayOfWeek(source.dayOfWeek ?? source.day_of_week);
  const startTime = normalizeTime(source.startTime ?? source.start_time);
  const endTime = normalizeTime(source.endTime ?? source.end_time);
  const severity = normalizeUpper(source.severity) === WARNING_SEVERITY ? WARNING_SEVERITY : CRITICAL_SEVERITY;

  return {
    blocking: source.blocking === false ? false : severity === CRITICAL_SEVERITY,
    date,
    dayOfWeek,
    endMinutes: toTimeMinutes(endTime),
    endTime,
    id: nullableText(source.id, 64),
    message: nullableText(source.message ?? source.reason, 500),
    resourceId: nullableText(source.resourceId ?? source.resource_id, 191),
    resourceName: nullableText(source.resourceName ?? source.resource_name, 191),
    resourceType: normalizeUpper(source.resourceType ?? source.resource_type),
    severity,
    startMinutes: toTimeMinutes(startTime),
    startTime,
    type: normalizeUpper(source.type || source.blockType || source.block_type || "BLOCKED_TIME"),
  };
}

/**
 * @param {Record<string, unknown>} event
 * @param {Record<string, unknown>[]} conflicts
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
function buildValidationResult(event, conflicts, input) {
  const conflictList = conflicts.filter((conflict) => conflict && typeof conflict === "object");
  const criticalConflicts = conflictList.filter((conflict) => conflict.blocking !== false);
  const warnings = conflictList.filter((conflict) => conflict.blocking === false);
  const blockOnWarnings = input.blockOnWarnings === true;
  const canConfirm = criticalConflicts.length === 0 && (!blockOnWarnings || warnings.length === 0);

  return {
    agendaConflictValidationEnabled: true,
    blocked: !canConfirm,
    canConfirm,
    conflictDetected: conflictList.length > 0,
    conflicts: conflictList,
    criticalConflicts,
    hasCriticalConflicts: criticalConflicts.length > 0,
    hasWarnings: warnings.length > 0,
    noAttendanceCreated: true,
    noFinancialSideEffects: true,
    noNotificationSideEffects: true,
    normalizedEvent: {
      action: event.action,
      agendaItemId: event.agendaItemId,
      classId: event.classId,
      date: event.date,
      dayOfWeek: event.dayOfWeek,
      endTime: event.endTime,
      eventId: event.eventId,
      startTime: event.startTime,
    },
    ok: canConfirm,
    validationCode: canConfirm ? "AGENDA_CONFLICT_VALIDATION_OK" : AGENDA_CONFLICT_VALIDATION_FAILED_CODE,
    warnings,
    warningsBlockConfirmation: blockOnWarnings,
  };
}

function createConflict({
  blocking = true,
  code,
  conflictEventId = null,
  details = {},
  message,
  resourceId = null,
  resourceType = null,
  severity = CRITICAL_SEVERITY,
}) {
  const normalizedSeverity = severity === WARNING_SEVERITY || blocking === false
    ? WARNING_SEVERITY
    : CRITICAL_SEVERITY;

  return {
    blocking: blocking !== false && normalizedSeverity === CRITICAL_SEVERITY,
    code,
    conflictEventId: conflictEventId || null,
    details,
    message,
    resourceId: resourceId == null ? null : String(resourceId),
    resourceType: resourceType || null,
    severity: normalizedSeverity,
  };
}

function normalizeDateString(value) {
  const normalized = nullableText(value, 32);

  if (!normalized) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseDateDayOfWeek(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ""));

  if (!match) {
    return null;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getDay();
}

function normalizeDayOfWeek(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value === 7) return 0;
    return value >= 0 && value <= 6 ? value : null;
  }

  const normalized = normalizeComparable(value);

  if (!normalized) {
    return null;
  }

  return WEEKDAY_ALIASES.get(normalized) ?? null;
}

function normalizeTime(value) {
  const normalized = nullableText(value, 20);
  const match = /^(\d{1,2}):(\d{2})/.exec(normalized || "");

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toTimeMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));

  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeComparable(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeUpper(value) {
  const normalized = nullableText(value, 64);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeObjectArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => nullableText(item, 32)).filter(Boolean)
    : [];
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeOptionalInteger(value) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

function readErrorMessage(error) {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}

function readWeekdayVariants(dayOfWeek) {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return [];
  }

  const label = WEEKDAY_LABELS[dayOfWeek];

  return Array.from(new Set([String(dayOfWeek), dayOfWeek === 0 ? "7" : null, label].filter(Boolean)));
}

module.exports = {
  AGENDA_CONFLICT_ADMIN_BLOCK_CODE,
  AGENDA_CONFLICT_CLASS_CAPACITY_FULL_CODE,
  AGENDA_CONFLICT_CLASS_CAPACITY_OVERBOOKED_CODE,
  AGENDA_CONFLICT_CLASS_DUPLICATE_CODE,
  AGENDA_CONFLICT_COURT_OVERLAP_CODE,
  AGENDA_CONFLICT_DATE_UNAVAILABLE_CODE,
  AGENDA_CONFLICT_PROFESSOR_OVERLAP_CODE,
  AGENDA_CONFLICT_REPOSITORY_ERROR_CODE,
  AGENDA_CONFLICT_STUDENT_OVERLAP_CODE,
  AGENDA_CONFLICT_VALIDATION_FAILED_CODE,
  AGENDA_EVENT_CANCELLED_CODE,
  AGENDA_EVENT_COMPLETED_CODE,
  AGENDA_EVENT_DATE_REQUIRED_CODE,
  AGENDA_EVENT_TIME_RANGE_INVALID_CODE,
  AGENDA_EVENT_TIME_REQUIRED_CODE,
  AGENDA_RECURRENCE_INTEGRITY_CODE,
  AGENDA_RECURRENCE_SCOPE_WARNING_CODE,
  AgendaConflictValidationService,
  CRITICAL_SEVERITY,
  WARNING_SEVERITY,
  buildValidationResult,
  normalizeAgendaEvent,
  normalizeAdministrativeBlock,
  readWeekdayVariants,
};
