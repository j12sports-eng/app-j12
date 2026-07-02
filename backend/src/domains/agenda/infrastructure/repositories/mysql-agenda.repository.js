const crypto = require("node:crypto");

const AGENDA_SOURCE = "j12_turmas via enrollment_class_links ACTIVE";
const AGENDA_ITEMS_TABLE = "enrollment_agenda_items";
const ACTIVE_ENROLLMENT_STATUS = "ACTIVE";
const ACTIVE_CLASS_LINK_STATUS = "ACTIVE";
const ACTIVE_AGENDA_STATUS = "ACTIVE";
const INITIAL_AGENDA_SOURCE = "ENROLLMENT_INITIAL";
const WEEKLY_RECURRENCE_TYPE = "WEEKLY";

const SELECT_SCHEDULES_BY_CLASS_SQL = `
  SELECT
    NULL AS enrollment_id,
    NULL AS student_person_id,
    NULL AS student_profile_id,
    NULL AS enrollment_status,
    NULL AS class_link_id,
    NULL AS class_link_status,
    turma.id AS class_id,
    turma.nome AS class_name,
    turma.status AS class_status,
    turma.modalidade,
    turma.modalidade_id,
    turma.unidade,
    turma.unidade_id,
    turma.professor_id,
    COALESCE(professor.nome, turma.professor_nome) AS professor_name,
    turma.dias_semana,
    turma.dias_semana_json,
    turma.horario,
    turma.horario_inicio,
    turma.horario_fim,
    turma.created_at
  FROM j12_turmas turma
  LEFT JOIN j12_professores professor ON professor.id = turma.professor_id
  WHERE turma.id = ?
  ORDER BY turma.nome ASC, turma.id ASC
`;

const SELECT_SCHEDULES_BY_STUDENT_SQL = `
  SELECT
    enrollment_record.id AS enrollment_id,
    enrollment_record.student_person_id,
    enrollment_record.student_profile_id,
    enrollment_record.status AS enrollment_status,
    class_link.id AS class_link_id,
    class_link.status AS class_link_status,
    turma.id AS class_id,
    turma.nome AS class_name,
    turma.status AS class_status,
    turma.modalidade,
    turma.modalidade_id,
    turma.unidade,
    turma.unidade_id,
    turma.professor_id,
    COALESCE(professor.nome, turma.professor_nome) AS professor_name,
    turma.dias_semana,
    turma.dias_semana_json,
    turma.horario,
    turma.horario_inicio,
    turma.horario_fim,
    turma.created_at
  FROM enrollments enrollment_record
  INNER JOIN enrollment_class_links class_link
    ON class_link.enrollment_id = enrollment_record.id
   AND class_link.status = ?
   AND class_link.unlinked_at IS NULL
  INNER JOIN j12_turmas turma ON turma.id = class_link.class_id
  LEFT JOIN j12_professores professor ON professor.id = turma.professor_id
  WHERE enrollment_record.student_person_id = ?
    AND enrollment_record.student_profile_id = ?
    AND enrollment_record.status = ?
    AND enrollment_record.deleted_at IS NULL
  ORDER BY turma.nome ASC, turma.id ASC, class_link.linked_at DESC
`;

const SELECT_SCHEDULES_BY_ENROLLMENT_SQL = `
  SELECT
    enrollment_record.id AS enrollment_id,
    enrollment_record.student_person_id,
    enrollment_record.student_profile_id,
    enrollment_record.status AS enrollment_status,
    class_link.id AS class_link_id,
    class_link.status AS class_link_status,
    turma.id AS class_id,
    turma.nome AS class_name,
    turma.status AS class_status,
    turma.modalidade,
    turma.modalidade_id,
    turma.unidade,
    turma.unidade_id,
    turma.professor_id,
    COALESCE(professor.nome, turma.professor_nome) AS professor_name,
    turma.dias_semana,
    turma.dias_semana_json,
    turma.horario,
    turma.horario_inicio,
    turma.horario_fim,
    turma.created_at
  FROM enrollments enrollment_record
  INNER JOIN enrollment_class_links class_link
    ON class_link.enrollment_id = enrollment_record.id
   AND class_link.status = ?
   AND class_link.unlinked_at IS NULL
  INNER JOIN j12_turmas turma ON turma.id = class_link.class_id
  LEFT JOIN j12_professores professor ON professor.id = turma.professor_id
  WHERE enrollment_record.id = ?
    AND enrollment_record.status = ?
    AND enrollment_record.deleted_at IS NULL
  ORDER BY turma.nome ASC, turma.id ASC, class_link.linked_at DESC
`;

const INSERT_INITIAL_AGENDA_ITEM_SQL = `
  INSERT INTO enrollment_agenda_items (
    id,
    enrollment_id,
    class_id,
    class_link_id,
    student_person_id,
    student_profile_id,
    day_of_week,
    start_time,
    end_time,
    recurrence_type,
    timezone,
    status,
    source,
    idempotency_key,
    created_by,
    metadata_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SELECT_AGENDA_ITEMS_BY_IDEMPOTENCY_KEYS_SQL_PREFIX = `
  SELECT
    id,
    enrollment_id,
    class_id,
    class_link_id,
    student_person_id,
    student_profile_id,
    day_of_week,
    start_time,
    end_time,
    recurrence_type,
    timezone,
    status,
    source,
    idempotency_key,
    created_by,
    created_at,
    updated_at,
    cancelled_at,
    cancelled_by,
    metadata_json
  FROM enrollment_agenda_items
  WHERE idempotency_key IN
`;

/**
 * MySQL read-only repository for the Agenda domain.
 *
 * This adapter derives schedule candidates from active Enrollment -> Turma
 * links and class schedule fields. It never inserts, updates or deletes rows
 * and it does not touch attendance, finance, notification or public API state.
 */
class MySqlAgendaRepository {
  /**
   * @param {Object} [options]
   * @param {(sql: string, params?: unknown[]) => Promise<unknown>} [options.queryRunner]
   */
  constructor({ queryRunner = null } = {}) {
    this.query = queryRunner || getDefaultQueryRunner();
  }

  /**
   * @param {{ classId?: string|number|null }} [input]
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async findSchedulesByClass(input = {}) {
    const classId = requiredInteger(input.classId, "classId");
    const rows = await this.query(SELECT_SCHEDULES_BY_CLASS_SQL, [classId]);

    return readRows(rows).map(toAgendaScheduleData);
  }

  /**
   * @param {{ studentPersonId?: string|null, studentProfileId?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async findSchedulesByStudent(input = {}) {
    const studentPersonId = requiredText(input.studentPersonId, "studentPersonId", 64);
    const studentProfileId = requiredText(input.studentProfileId, "studentProfileId", 64);
    const rows = await this.query(SELECT_SCHEDULES_BY_STUDENT_SQL, [
      ACTIVE_CLASS_LINK_STATUS,
      studentPersonId,
      studentProfileId,
      ACTIVE_ENROLLMENT_STATUS,
    ]);

    return readRows(rows).map(toAgendaScheduleData);
  }

  /**
   * @param {{ enrollmentId?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async findSchedulesByEnrollment(input = {}) {
    const enrollmentId = requiredText(input.enrollmentId, "enrollmentId", 64);
    const rows = await this.query(SELECT_SCHEDULES_BY_ENROLLMENT_SQL, [
      ACTIVE_CLASS_LINK_STATUS,
      enrollmentId,
      ACTIVE_ENROLLMENT_STATUS,
    ]);

    return readRows(rows).map(toAgendaScheduleData);
  }

  /**
   * @param {{ studentPersonId?: string|null, studentProfileId?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async getAgendaSummaryByStudent(input = {}) {
    const studentPersonId = requiredText(input.studentPersonId, "studentPersonId", 64);
    const studentProfileId = requiredText(input.studentProfileId, "studentProfileId", 64);
    const schedules = await this.findSchedulesByStudent({ studentPersonId, studentProfileId });

    return buildAgendaSummary({
      schedules,
      scopeResolved: true,
      studentPersonId,
      studentProfileId,
    });
  }

  /**
   * @param {Object} input
   * @param {string|null} [input.enrollmentId]
   * @param {string|number|null} [input.classId]
   * @param {string|null} [input.studentPersonId]
   * @param {string|null} [input.studentProfileId]
   * @param {Record<string, unknown>[]} [input.scheduleCandidates]
   * @param {string|null} [input.requestedBy]
   * @returns {Promise<Record<string, unknown>>}
   */
  async createInitialAgendaForEnrollment(input = {}) {
    const enrollmentId = requiredText(input.enrollmentId, "enrollmentId", 64);
    const classId = requiredInteger(input.classId, "classId");
    const studentPersonId = requiredText(input.studentPersonId, "studentPersonId", 64);
    const studentProfileId = requiredText(input.studentProfileId, "studentProfileId", 64);
    const requestedBy = nullableText(input.requestedBy, 191);
    const agendaItemsToPersist = buildInitialAgendaItems({
      classId,
      enrollmentId,
      requestedBy,
      scheduleCandidates: input.scheduleCandidates,
      studentPersonId,
      studentProfileId,
    });

    if (agendaItemsToPersist.length === 0) {
      return buildAgendaPersistenceResult({
        agendaItems: [],
        createdCount: 0,
        reusedCount: 0,
      });
    }

    const idempotencyKeys = agendaItemsToPersist.map((item) => item.idempotencyKey);
    const existingBefore = await this.findAgendaItemsByIdempotencyKeys(idempotencyKeys);
    const existingKeys = new Set(existingBefore.map((item) => item.idempotencyKey));
    let createdCount = 0;

    for (const item of agendaItemsToPersist) {
      if (existingKeys.has(item.idempotencyKey)) {
        continue;
      }

      try {
        await this.query(INSERT_INITIAL_AGENDA_ITEM_SQL, toInsertParams(item));
        createdCount += 1;
      } catch (error) {
        if (error?.code !== "ER_DUP_ENTRY") {
          throw error;
        }
      }
    }

    const agendaItems = await this.findAgendaItemsByIdempotencyKeys(idempotencyKeys);

    return buildAgendaPersistenceResult({
      agendaItems,
      createdCount,
      reusedCount: Math.max(agendaItems.length - createdCount, 0),
    });
  }

  /**
   * @param {string[]} idempotencyKeys
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async findAgendaItemsByIdempotencyKeys(idempotencyKeys = []) {
    const keys = Array.from(new Set(idempotencyKeys.map((key) => requiredText(key, "key", 191))));

    if (keys.length === 0) {
      return [];
    }

    const placeholders = keys.map(() => "?").join(", ");
    const rows = await this.query(
      `${SELECT_AGENDA_ITEMS_BY_IDEMPOTENCY_KEYS_SQL_PREFIX} (${placeholders})
       ORDER BY class_id ASC, day_of_week ASC, start_time ASC`,
      keys,
    );

    return readRows(rows).map(toAgendaItemData);
  }
}

/**
 * @param {Record<string, unknown>|null} row
 * @returns {Record<string, unknown>}
 */
function toAgendaScheduleData(row) {
  const classId = normalizeOptionalInteger(row?.class_id);
  const enrollmentId = nullableText(row?.enrollment_id, 64);
  const daysOfWeek = parseDaysOfWeek(row?.dias_semana_json, row?.dias_semana);
  const startTime = nullableText(row?.horario_inicio ?? row?.horario, 20);
  const endTime = nullableText(row?.horario_fim, 20);
  const scheduleMapped = Boolean(daysOfWeek.length > 0 || startTime || endTime);

  return {
    activeEnrollment: enrollmentId
      ? nullableText(row?.enrollment_status, 32) === ACTIVE_ENROLLMENT_STATUS
      : null,
    agendaSource: AGENDA_SOURCE,
    attendanceCreated: false,
    classId,
    classLinkId: nullableText(row?.class_link_id, 64),
    classLinkStatus: nullableText(row?.class_link_status, 32),
    className: nullableText(row?.class_name, 191),
    classStatus: nullableText(row?.class_status, 32),
    createdAt: row?.created_at ?? null,
    daysOfWeek,
    derivedFromClass: true,
    endTime,
    enrollmentId,
    enrollmentStatus: nullableText(row?.enrollment_status, 32),
    id: buildDerivedScheduleId({ classId, enrollmentId }),
    limitations: [
      "Dedicated Agenda table is not implemented.",
      "This schedule is derived from j12_turmas fields.",
      "No attendance, recurrence, cancellation or replacement row was created.",
    ],
    modality: nullableText(row?.modalidade, 191),
    modalityId: row?.modalidade_id == null ? null : String(row.modalidade_id),
    persistedSchedule: false,
    professorId: row?.professor_id == null ? null : String(row.professor_id),
    professorName: nullableText(row?.professor_name, 191),
    readOnly: true,
    recurrencePersisted: false,
    scheduleCreated: false,
    scheduleMapped,
    sourceTables: ["enrollment_class_links", "enrollments", "j12_turmas"],
    startTime,
    studentPersonId: nullableText(row?.student_person_id, 64),
    studentProfileId: nullableText(row?.student_profile_id, 64),
    unit: nullableText(row?.unidade, 191),
    unitId: row?.unidade_id == null ? null : String(row.unidade_id),
  };
}

/**
 * @param {Object} input
 * @param {string} input.enrollmentId
 * @param {number} input.classId
 * @param {string} input.studentPersonId
 * @param {string} input.studentProfileId
 * @param {Record<string, unknown>[]} [input.scheduleCandidates]
 * @param {string|null} [input.requestedBy]
 * @returns {Record<string, unknown>[]}
 */
function buildInitialAgendaItems({
  enrollmentId,
  classId,
  studentPersonId,
  studentProfileId,
  scheduleCandidates = [],
  requestedBy = null,
}) {
  const items = [];

  for (const schedule of normalizeScheduleCandidates(scheduleCandidates)) {
    const scheduleClassId = normalizeOptionalInteger(schedule.classId ?? schedule.class_id);

    if (scheduleClassId !== classId) {
      continue;
    }

    const daysOfWeek = normalizeDaysOfWeek(schedule.daysOfWeek);
    const startTime = nullableText(schedule.startTime ?? schedule.start_time, 20);
    const endTime = nullableText(schedule.endTime ?? schedule.end_time, 20);
    const classLinkId = nullableText(schedule.classLinkId ?? schedule.class_link_id, 64);

    if (daysOfWeek.length === 0 || !startTime) {
      continue;
    }

    for (const dayOfWeek of daysOfWeek) {
      const idempotencyKey = buildAgendaItemIdempotencyKey({
        classId,
        dayOfWeek,
        endTime,
        enrollmentId,
        startTime,
      });

      items.push({
        classId,
        classLinkId,
        createdBy: requestedBy,
        dayOfWeek,
        endTime,
        enrollmentId,
        id: buildAgendaItemId(idempotencyKey),
        idempotencyKey,
        metadataJson: JSON.stringify({
          agendaSource: AGENDA_SOURCE,
          derivedFromClass: true,
          scheduleCandidateId: nullableText(schedule.id, 191),
          sourceTables: Array.isArray(schedule.sourceTables) ? schedule.sourceTables : [],
        }),
        recurrenceType: WEEKLY_RECURRENCE_TYPE,
        source: INITIAL_AGENDA_SOURCE,
        startTime,
        status: ACTIVE_AGENDA_STATUS,
        studentPersonId,
        studentProfileId,
        timezone: "America/Sao_Paulo",
      });
    }
  }

  return Array.from(new Map(items.map((item) => [item.idempotencyKey, item])).values());
}

/**
 * @param {Record<string, unknown>} item
 * @returns {unknown[]}
 */
function toInsertParams(item) {
  return [
    item.id,
    item.enrollmentId,
    item.classId,
    item.classLinkId,
    item.studentPersonId,
    item.studentProfileId,
    item.dayOfWeek,
    item.startTime,
    item.endTime,
    item.recurrenceType,
    item.timezone,
    item.status,
    item.source,
    item.idempotencyKey,
    item.createdBy,
    item.metadataJson,
  ];
}

/**
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
function toAgendaItemData(row) {
  return {
    attendanceCreated: false,
    classId: normalizeOptionalInteger(row?.class_id),
    classLinkId: nullableText(row?.class_link_id, 64),
    createdAt: row?.created_at ?? null,
    createdBy: nullableText(row?.created_by, 191),
    dayOfWeek: nullableText(row?.day_of_week, 32),
    endTime: nullableText(row?.end_time, 20),
    enrollmentId: nullableText(row?.enrollment_id, 64),
    financialSideEffects: false,
    id: nullableText(row?.id, 64),
    idempotencyKey: nullableText(row?.idempotency_key, 191),
    metadata: parseJsonObject(row?.metadata_json),
    notificationSideEffects: false,
    persistedAgenda: true,
    recurrencePersisted: true,
    recurrenceType: nullableText(row?.recurrence_type, 32),
    source: nullableText(row?.source, 50),
    startTime: nullableText(row?.start_time, 20),
    status: nullableText(row?.status, 32),
    studentPersonId: nullableText(row?.student_person_id, 64),
    studentProfileId: nullableText(row?.student_profile_id, 64),
    timezone: nullableText(row?.timezone, 64),
    updatedAt: row?.updated_at ?? null,
  };
}

/**
 * @param {{ agendaItems: Record<string, unknown>[], createdCount: number, reusedCount: number }} input
 * @returns {Record<string, unknown>}
 */
function buildAgendaPersistenceResult({ agendaItems = [], createdCount = 0, reusedCount = 0 } = {}) {
  const persistedItems = normalizeScheduleCandidates(agendaItems);

  return {
    agendaCreated: createdCount > 0,
    agendaItems: persistedItems,
    attendanceCreated: false,
    createdCount,
    duplicateAgendaReusedOrBlocked: true,
    financialSideEffects: false,
    noAttendanceCreated: true,
    noFinancialSideEffects: true,
    noNotificationSideEffects: true,
    noTestDataLeft: true,
    notificationSideEffects: false,
    persistedAgendaCount: persistedItems.length,
    reusedCount,
  };
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>[]}
 */
function normalizeScheduleCandidates(value) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item))
    : [];
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeDaysOfWeek(value) {
  return uniqueStrings(Array.isArray(value) ? value : [])
    .map((day) => day.toLowerCase())
    .filter(Boolean);
}

/**
 * @param {Object} input
 * @param {string} input.enrollmentId
 * @param {number} input.classId
 * @param {string} input.dayOfWeek
 * @param {string} input.startTime
 * @param {string|null} input.endTime
 * @returns {string}
 */
function buildAgendaItemIdempotencyKey({
  enrollmentId,
  classId,
  dayOfWeek,
  startTime,
  endTime = null,
}) {
  return [
    "enrollment",
    enrollmentId,
    "class",
    classId,
    "weekly",
    dayOfWeek,
    startTime,
    endTime || "",
  ].join(":");
}

/**
 * @param {string} idempotencyKey
 * @returns {string}
 */
function buildAgendaItemId(idempotencyKey) {
  return `agenda_${crypto.createHash("sha1").update(idempotencyKey).digest("hex").slice(0, 24)}`;
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function parseJsonObject(value) {
  const raw = nullableText(value, 65535);

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {{ schedules: Record<string, unknown>[], scopeResolved: boolean, studentPersonId: string, studentProfileId: string }} input
 * @returns {Record<string, unknown>}
 */
function buildAgendaSummary({
  schedules = [],
  scopeResolved = false,
  studentPersonId,
  studentProfileId,
} = {}) {
  const scheduleList = Array.isArray(schedules) ? schedules : [];
  const classIds = Array.from(
    new Set(
      scheduleList
        .map((schedule) => schedule.classId)
        .filter((classId) => classId !== null && classId !== undefined)
        .map((classId) => String(classId)),
    ),
  );

  return {
    agendaSource: AGENDA_SOURCE,
    classCount: classIds.length,
    classIds,
    hasSchedules: scheduleList.length > 0,
    limitations: [
      "Dedicated Agenda table is not implemented.",
      "Schedules are derived from active Enrollment -> Turma links.",
      "Attendance is not created or updated by this repository.",
      "Recurrence, cancellation and replacement workflows are not implemented.",
    ],
    noAttendanceCreated: true,
    noFinancialSideEffects: true,
    noNotificationSideEffects: true,
    noScheduleCreated: true,
    readOnly: true,
    scheduleCount: scheduleList.length,
    schedules: scheduleList,
    scopeResolved,
    studentPersonId,
    studentProfileId,
  };
}

/**
 * @param {{ classId: number|null, enrollmentId: string|null }} input
 * @returns {string}
 */
function buildDerivedScheduleId({ classId, enrollmentId }) {
  if (enrollmentId && classId) {
    return `enrollment:${enrollmentId}:class:${classId}`;
  }

  if (classId) {
    return `class:${classId}`;
  }

  return "agenda:unmapped";
}

/**
 * @param {unknown} value
 * @param {unknown} fallback
 * @returns {string[]}
 */
function parseDaysOfWeek(value, fallback = null) {
  if (Array.isArray(value)) {
    return uniqueStrings(value);
  }

  const raw = nullableText(value, 65535);

  if (raw) {
    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        return uniqueStrings(parsed);
      }
    } catch {
      return uniqueStrings(raw.replace(/\./g, "").split(/[\/,;|]/g));
    }
  }

  return uniqueStrings(
    String(fallback ?? "")
      .replace(/\./g, "")
      .split(/[\/,;|]/g),
  );
}

/**
 * Accepts both the project query wrapper shape (`rows`) and mysql2
 * connection.execute shape (`[rows, fields]`).
 *
 * @param {unknown} result
 * @returns {Record<string, unknown>[]}
 */
function readRows(result) {
  if (!Array.isArray(result) || result.length === 0) {
    return [];
  }

  const rows = Array.isArray(result[0]) ? result[0] : result;

  return rows.filter((row) => row && typeof row === "object" && !Array.isArray(row));
}

/**
 * @param {unknown[]} values
 * @returns {string[]}
 */
function uniqueStrings(values) {
  return Array.from(
    new Set(values.map((value) => nullableText(value, 64)).filter(Boolean)),
  );
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requiredInteger(value, field) {
  const normalized = String(value ?? "").trim();

  if (!/^\d+$/.test(normalized)) {
    throw new TypeError(`MySqlAgendaRepository requires ${field}.`);
  }

  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TypeError(`MySqlAgendaRepository requires ${field}.`);
  }

  return parsed;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {number} [max]
 * @returns {string}
 */
function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);

  if (!normalized) {
    throw new TypeError(`MySqlAgendaRepository requires ${field}.`);
  }

  return normalized;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizeOptionalInteger(value) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
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
 * Loads the current mysql2 query wrapper lazily to avoid database side effects
 * when the domain is imported for architecture discovery or tests.
 *
 * @returns {(sql: string, params?: unknown[]) => Promise<unknown>}
 */
function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

module.exports = {
  ACTIVE_CLASS_LINK_STATUS,
  ACTIVE_AGENDA_STATUS,
  ACTIVE_ENROLLMENT_STATUS,
  AGENDA_ITEMS_TABLE,
  AGENDA_SOURCE,
  INITIAL_AGENDA_SOURCE,
  INSERT_INITIAL_AGENDA_ITEM_SQL,
  MySqlAgendaRepository,
  SELECT_AGENDA_ITEMS_BY_IDEMPOTENCY_KEYS_SQL_PREFIX,
  SELECT_SCHEDULES_BY_CLASS_SQL,
  SELECT_SCHEDULES_BY_ENROLLMENT_SQL,
  SELECT_SCHEDULES_BY_STUDENT_SQL,
  WEEKLY_RECURRENCE_TYPE,
  buildAgendaItemId,
  buildAgendaItemIdempotencyKey,
  buildAgendaSummary,
  buildInitialAgendaItems,
  parseDaysOfWeek,
  readRows,
  toAgendaItemData,
  toAgendaScheduleData,
};
