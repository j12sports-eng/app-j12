const ENROLLMENT_SCHEDULE_LINK_INPUT_REQUIRED_CODE = "ENROLLMENT_SCHEDULE_LINK_INPUT_REQUIRED";
const ENROLLMENT_SCHEDULE_LINK_INVALID_CLASS_ID_CODE = "ENROLLMENT_SCHEDULE_LINK_INVALID_CLASS_ID";
const ENROLLMENT_SCHEDULE_LINK_INVALID_CLASS_STATUS_CODE =
  "ENROLLMENT_SCHEDULE_LINK_INVALID_CLASS_STATUS";
const ENROLLMENT_SCHEDULE_LINK_INVALID_ENROLLMENT_STATUS_CODE =
  "ENROLLMENT_SCHEDULE_LINK_INVALID_ENROLLMENT_STATUS";
const ENROLLMENT_SCHEDULE_LINK_BLOCKED_BY_SCHEMA_OR_MODULE_GAP_CODE =
  "SCHEDULE_CREATION_BLOCKED_BY_SCHEMA_OR_MODULE_GAP";
const ENROLLMENT_SCHEDULE_LINK_PREPARED_STATUS = "PREPARED_ONLY";
const ENROLLMENT_SCHEDULE_LINK_CONTRACT_VERSION = "sprint-9.52";
const REQUIRED_ENROLLMENT_STATUS_FOR_SCHEDULE_LINK = "ACTIVE";
const REQUIRED_SCHEDULE_LINK_TABLE = "enrollment_schedule_links";
const ALLOWED_CLASS_STATUSES_FOR_SCHEDULE_LINK = Object.freeze(["ativa"]);

/**
 * Contract-only preparation for a future Enrollment -> Agenda link.
 *
 * It validates the internal payload shape and returns a safe no-write plan.
 * It does not create schedules, attendance records, financial entries or
 * notifications.
 *
 * @param {Object} input
 * @param {string|null} [input.enrollmentId]
 * @param {string|null} [input.studentPersonId]
 * @param {string|null} [input.studentProfileId]
 * @param {string|null} [input.classId]
 * @param {string|null} [input.turmaId]
 * @param {string|null} [input.requestedBy]
 * @param {string|null} [input.enrollmentStatus]
 * @param {string|null} [input.classStatus]
 * @param {Record<string, unknown>} [input.classSchedule]
 * @param {Record<string, unknown>} [input.metadata]
 * @returns {Record<string, unknown>}
 */
function prepareEnrollmentScheduleLink(input = {}) {
  const enrollmentId = nullableText(input.enrollmentId, 64);
  const studentPersonId = nullableText(input.studentPersonId, 64);
  const studentProfileId = nullableText(input.studentProfileId, 64);
  const classId = nullableText(input.classId ?? input.turmaId, 64);
  const requestedBy = nullableText(input.requestedBy, 191);
  const enrollmentStatus =
    normalizeUpperText(input.enrollmentStatus) || REQUIRED_ENROLLMENT_STATUS_FOR_SCHEDULE_LINK;
  const classStatus = normalizeLowerText(input.classStatus);
  const classSchedule = normalizeClassSchedule(input.classSchedule);

  if (!enrollmentId || !studentPersonId || !studentProfileId || !classId || !requestedBy) {
    throw controlledError(
      "prepareEnrollmentScheduleLink requires enrollmentId, studentPersonId, studentProfileId, classId and requestedBy.",
      ENROLLMENT_SCHEDULE_LINK_INPUT_REQUIRED_CODE,
      {
        hasClassId: Boolean(classId),
        hasEnrollmentId: Boolean(enrollmentId),
        hasRequestedBy: Boolean(requestedBy),
        hasStudentPersonId: Boolean(studentPersonId),
        hasStudentProfileId: Boolean(studentProfileId),
      },
    );
  }

  if (!/^\d+$/.test(classId)) {
    throw controlledError(
      "prepareEnrollmentScheduleLink requires a numeric classId compatible with j12_turmas.id.",
      ENROLLMENT_SCHEDULE_LINK_INVALID_CLASS_ID_CODE,
      { classId },
    );
  }

  if (enrollmentStatus !== REQUIRED_ENROLLMENT_STATUS_FOR_SCHEDULE_LINK) {
    throw controlledError(
      "Enrollment must be ACTIVE before a schedule link can be prepared.",
      ENROLLMENT_SCHEDULE_LINK_INVALID_ENROLLMENT_STATUS_CODE,
      {
        enrollmentId,
        enrollmentStatus,
        requiredEnrollmentStatus: REQUIRED_ENROLLMENT_STATUS_FOR_SCHEDULE_LINK,
      },
    );
  }

  if (classStatus && !ALLOWED_CLASS_STATUSES_FOR_SCHEDULE_LINK.includes(classStatus)) {
    throw controlledError(
      "Class must be active before a schedule link can be prepared.",
      ENROLLMENT_SCHEDULE_LINK_INVALID_CLASS_STATUS_CODE,
      {
        allowedClassStatuses: [...ALLOWED_CLASS_STATUSES_FOR_SCHEDULE_LINK],
        classId,
        classStatus,
      },
    );
  }

  return {
    agendaModuleMapped: true,
    allowedClassStatuses: [...ALLOWED_CLASS_STATUSES_FOR_SCHEDULE_LINK],
    blocked: true,
    blockedBySchemaOrModuleGap: true,
    blockerCode: ENROLLMENT_SCHEDULE_LINK_BLOCKED_BY_SCHEMA_OR_MODULE_GAP_CODE,
    canPersist: false,
    classId,
    classSchedule,
    classScheduleMapped: classSchedule.daysOfWeek.length > 0 || Boolean(classSchedule.startTime),
    classScheduleSourceVerified: false,
    classStatus: classStatus || null,
    contractDocumented: true,
    contractVersion: ENROLLMENT_SCHEDULE_LINK_CONTRACT_VERSION,
    duplicateScheduleCheckAvailable: false,
    duplicateScheduleCheckBlockedBySchemaOrModuleGap: true,
    enrollmentId,
    enrollmentStatus,
    financialSideEffects: false,
    futureRules: [
      "Enrollment must be ACTIVE before schedule generation.",
      "A safe Enrollment -> Turma link must exist before schedule persistence.",
      "Class schedule must be read from a single Agenda/Turma service.",
      "Duplicate schedules must be prevented by enrollment, class and recurrence window.",
      "Agenda creation must not create financial entries or notifications.",
      "A dedicated enrollment-schedule link table should be created before real persistence.",
    ],
    metadata: normalizeMetadata(input.metadata),
    notificationSideEffects: false,
    persisted: false,
    prepared: true,
    requestedBy,
    requiredEnrollmentStatus: REQUIRED_ENROLLMENT_STATUS_FOR_SCHEDULE_LINK,
    requiredFutureFields: [
      "enrollmentId",
      "studentPersonId",
      "studentProfileId",
      "classId",
      "daysOfWeek",
      "startTime",
      "endTime",
      "requestedBy",
    ],
    requiresDedicatedScheduleLinkTable: true,
    requiresMigration: true,
    scheduleCreated: false,
    scheduleCreationBlockedBySchemaOrModuleGap: true,
    scheduleLinkTable: {
      required: true,
      tableName: REQUIRED_SCHEDULE_LINK_TABLE,
      suggestedColumns: [
        "id",
        "enrollment_id",
        "class_id",
        "student_person_id",
        "student_profile_id",
        "days_of_week_json",
        "start_time",
        "end_time",
        "starts_at",
        "ends_at",
        "status",
        "created_by",
        "metadata_json",
        "created_at",
        "updated_at",
      ],
      suggestedUniqueKey: ["enrollment_id", "class_id", "status_active_or_current"],
    },
    scheduleModule: {
      agendaDomainBoundary: "backend/src/domains/agenda",
      agendaEndpointExists: false,
      attendanceRoute: "backend/src/routes/presencas.routes.js",
      attendanceTable: "student_presencas",
      classRoute: "backend/src/routes/turmas.routes.js",
      classScheduleFields: [
        "j12_turmas.dias_semana",
        "j12_turmas.dias_semana_json",
        "j12_turmas.horario",
        "j12_turmas.horario_inicio",
        "j12_turmas.horario_fim",
      ],
      classTable: "j12_turmas",
      dedicatedEnrollmentScheduleTableExists: false,
      enrollmentForeignKeyExists: false,
      currentFrontendSurfaces: [
        "src/routes/agenda.tsx",
        "src/routes/portal-aluno/agenda.tsx",
        "src/routes/portal-responsavel/agenda.tsx",
      ],
    },
    status: ENROLLMENT_SCHEDULE_LINK_PREPARED_STATUS,
    studentPersonId,
    studentProfileId,
  };
}

/**
 * @param {unknown} value
 * @returns {{ daysOfWeek: string[], endTime: string|null, recurrence: string|null, source: string, startTime: string|null }}
 */
function normalizeClassSchedule(value = {}) {
  const schedule = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return {
    daysOfWeek: normalizeStringList(
      schedule.daysOfWeek ?? schedule.diasSemana ?? schedule.dias_semana_json ?? schedule.dias_semana,
    ),
    endTime: nullableText(schedule.endTime ?? schedule.horarioFim ?? schedule.horario_fim, 20),
    recurrence: nullableText(schedule.recurrence ?? schedule.recorrencia ?? "weekly", 30),
    source: nullableText(schedule.source, 191) || "caller-provided-or-future-agenda-service",
    startTime: nullableText(
      schedule.startTime ?? schedule.horarioInicio ?? schedule.horario_inicio ?? schedule.horario,
      20,
    ),
  };
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => nullableText(item, 64)).filter(Boolean))];
  }

  const raw = nullableText(value, 65535);

  if (!raw) {
    return [];
  }

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      return normalizeStringList(parsed);
    } catch {
      return [];
    }
  }

  return [
    ...new Set(
      raw
        .replace(/\./g, "")
        .split(/[\/,;|]/g)
        .map((item) => nullableText(item.toLowerCase(), 64))
        .filter(Boolean),
    ),
  ];
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function normalizeMetadata(value = {}) {
  const metadata = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const normalized = {};

  for (const [key, item] of Object.entries(metadata)) {
    const normalizedKey = nullableText(key, 64);

    if (!normalizedKey) {
      continue;
    }

    if (item === null || ["boolean", "number", "string"].includes(typeof item)) {
      normalized[normalizedKey] = typeof item === "string" ? nullableText(item, 191) : item;
    }
  }

  return {
    noFinancialSideEffects: true,
    noNotificationSideEffects: true,
    noScheduleCreated: true,
    preparedOnly: true,
    ...normalized,
  };
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeLowerText(value) {
  const normalized = nullableText(value, 64);
  return normalized ? normalized.toLowerCase() : null;
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
  ALLOWED_CLASS_STATUSES_FOR_SCHEDULE_LINK,
  ENROLLMENT_SCHEDULE_LINK_BLOCKED_BY_SCHEMA_OR_MODULE_GAP_CODE,
  ENROLLMENT_SCHEDULE_LINK_CONTRACT_VERSION,
  ENROLLMENT_SCHEDULE_LINK_INPUT_REQUIRED_CODE,
  ENROLLMENT_SCHEDULE_LINK_INVALID_CLASS_ID_CODE,
  ENROLLMENT_SCHEDULE_LINK_INVALID_CLASS_STATUS_CODE,
  ENROLLMENT_SCHEDULE_LINK_INVALID_ENROLLMENT_STATUS_CODE,
  ENROLLMENT_SCHEDULE_LINK_PREPARED_STATUS,
  REQUIRED_ENROLLMENT_STATUS_FOR_SCHEDULE_LINK,
  REQUIRED_SCHEDULE_LINK_TABLE,
  prepareEnrollmentScheduleLink,
};
