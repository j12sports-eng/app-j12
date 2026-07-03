const crypto = require("node:crypto");

const {
  ACTIVE_RECURRENCE_STATUS,
  CANCELLED_RECURRENCE_STATUS,
  DEFAULT_TIMEZONE,
  RECURRENCE_EXCEPTION_TYPES,
  RECURRENCE_OPERATION_SCOPES,
  buildRecurrenceIdempotencyKey,
  buildRecurrenceOccurrenceKey,
  buildStableId,
  normalizeOccurrenceReference,
  normalizeRecurrenceRule,
  normalizeRecurrenceRuleChanges,
} = require("../../application/services/agenda-recurrence.service.js");

const AGENDA_SOURCE = "j12_turmas via enrollment_class_links ACTIVE";
const AGENDA_ITEMS_TABLE = "enrollment_agenda_items";
const AGENDA_RECURRENCE_SERIES_TABLE = "agenda_recurrence_series";
const AGENDA_RECURRENCE_EXCEPTIONS_TABLE = "agenda_recurrence_exceptions";
const AGENDA_RECURRENCE_HISTORY_TABLE = "agenda_recurrence_history";
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

const SELECT_AGENDA_ITEM_BY_ID_SQL = `
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
  WHERE id = ?
  LIMIT 1
`;

const SELECT_AGENDA_CONFLICT_CANDIDATES_SQL_PREFIX = `
  SELECT
    item.id AS agenda_item_id,
    item.enrollment_id,
    item.class_id,
    item.class_link_id,
    item.student_person_id,
    item.student_profile_id,
    item.day_of_week,
    item.start_time,
    item.end_time,
    item.recurrence_type,
    item.status AS agenda_status,
    item.metadata_json,
    turma.nome AS class_name,
    turma.status AS class_status,
    turma.capacidade,
    turma.unidade,
    turma.unidade_id,
    turma.professor_id,
    COALESCE(professor.nome, turma.professor_nome) AS professor_name,
    enrollment_record.status AS enrollment_status
  FROM enrollment_agenda_items item
  LEFT JOIN j12_turmas turma ON turma.id = item.class_id
  LEFT JOIN j12_professores professor ON professor.id = turma.professor_id
  LEFT JOIN enrollments enrollment_record ON enrollment_record.id = item.enrollment_id
  WHERE item.status NOT IN ('CANCELLED', 'CANCELADO', 'CANCELADA', 'COMPLETED', 'ENCERRADO', 'ENCERRADA')
    AND LOWER(item.day_of_week) IN
`;

const SELECT_AGENDA_ADMIN_BLOCKS_SQL_PREFIX = `
  SELECT
    id,
    block_type,
    block_date,
    day_of_week,
    start_time,
    end_time,
    resource_type,
    resource_id,
    resource_name,
    severity,
    message,
    active
  FROM agenda_admin_blocks
  WHERE active = 1
    AND (
      block_date = ?
      OR LOWER(day_of_week) IN
`;

const UPDATE_AGENDA_ITEM_SCHEDULE_SQL = `
  UPDATE enrollment_agenda_items
  SET
    day_of_week = ?,
    start_time = ?,
    end_time = ?,
    metadata_json = COALESCE(?, metadata_json),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
    AND status NOT IN ('CANCELLED', 'CANCELADO', 'CANCELADA', 'COMPLETED', 'ENCERRADO', 'ENCERRADA')
`;

const INSERT_RECURRENCE_SERIES_SQL = `
  INSERT INTO agenda_recurrence_series (
    id,
    agenda_item_id,
    parent_series_id,
    enrollment_id,
    class_id,
    class_link_id,
    student_person_id,
    student_profile_id,
    frequency,
    interval_value,
    interval_unit,
    days_of_week_json,
    start_date,
    end_date,
    max_occurrences,
    start_time,
    end_time,
    timezone,
    professor_id,
    professor_name,
    court_id,
    court_name,
    status,
    source,
    idempotency_key,
    metadata_json,
    created_by,
    updated_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SELECT_RECURRENCE_SERIES_BY_ID_SQL = `
  SELECT
    id,
    agenda_item_id,
    parent_series_id,
    enrollment_id,
    class_id,
    class_link_id,
    student_person_id,
    student_profile_id,
    frequency,
    interval_value,
    interval_unit,
    days_of_week_json,
    start_date,
    end_date,
    max_occurrences,
    start_time,
    end_time,
    timezone,
    professor_id,
    professor_name,
    court_id,
    court_name,
    status,
    source,
    idempotency_key,
    metadata_json,
    created_by,
    updated_by,
    cancelled_at,
    cancelled_by,
    cancel_reason,
    created_at,
    updated_at
  FROM agenda_recurrence_series
  WHERE id = ?
  LIMIT 1
`;

const SELECT_RECURRENCE_SERIES_BY_IDEMPOTENCY_KEY_SQL = `
  SELECT
    id,
    agenda_item_id,
    parent_series_id,
    enrollment_id,
    class_id,
    class_link_id,
    student_person_id,
    student_profile_id,
    frequency,
    interval_value,
    interval_unit,
    days_of_week_json,
    start_date,
    end_date,
    max_occurrences,
    start_time,
    end_time,
    timezone,
    professor_id,
    professor_name,
    court_id,
    court_name,
    status,
    source,
    idempotency_key,
    metadata_json,
    created_by,
    updated_by,
    cancelled_at,
    cancelled_by,
    cancel_reason,
    created_at,
    updated_at
  FROM agenda_recurrence_series
  WHERE idempotency_key = ?
  LIMIT 1
`;

const SELECT_RECURRENCE_EXCEPTIONS_SQL = `
  SELECT
    id,
    series_id,
    occurrence_key,
    occurrence_date,
    occurrence_start_time,
    exception_type,
    override_json,
    reason,
    created_by,
    created_at
  FROM agenda_recurrence_exceptions
  WHERE series_id = ?
    AND (? IS NULL OR occurrence_date >= ?)
    AND (? IS NULL OR occurrence_date <= ?)
  ORDER BY occurrence_date ASC, occurrence_start_time ASC, id ASC
`;

const SELECT_RECURRENCE_EXCEPTION_BY_KEY_SQL = `
  SELECT
    id,
    series_id,
    occurrence_key,
    occurrence_date,
    occurrence_start_time,
    exception_type,
    override_json,
    reason,
    created_by,
    created_at
  FROM agenda_recurrence_exceptions
  WHERE series_id = ?
    AND occurrence_key = ?
  LIMIT 1
`;

const INSERT_RECURRENCE_EXCEPTION_SQL = `
  INSERT INTO agenda_recurrence_exceptions (
    id,
    series_id,
    occurrence_key,
    occurrence_date,
    occurrence_start_time,
    exception_type,
    override_json,
    reason,
    created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const CANCEL_RECURRENCE_SERIES_SQL = `
  UPDATE agenda_recurrence_series
  SET
    status = ?,
    cancelled_at = CURRENT_TIMESTAMP,
    cancelled_by = ?,
    cancel_reason = ?,
    updated_by = ?,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
    AND status <> ?
`;

const INSERT_RECURRENCE_HISTORY_SQL = `
  INSERT INTO agenda_recurrence_history (
    id,
    series_id,
    exception_id,
    action,
    scope,
    occurrence_key,
    before_json,
    after_json,
    reason,
    created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

/**
 * MySQL repository for the Agenda domain.
 *
 * This adapter derives schedule candidates from active Enrollment -> Turma
 * links and persists only initial planned Agenda items in
 * enrollment_agenda_items. It does not touch attendance, finance,
 * notification or public API state.
 */
class MySqlAgendaRepository {
  /**
   * @param {Object} [options]
   * @param {(sql: string, params?: unknown[]) => Promise<unknown>} [options.queryRunner]
   */
  constructor({ queryRunner = null } = {}) {
    this.query = queryRunner || getDefaultQueryRunner();
    this.usesDefaultQueryRunner = !queryRunner;
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

  /**
   * @param {Object} input
   * @param {string|number|null} [input.dayOfWeek]
   * @param {string|null} [input.endTime]
   * @param {boolean} [input.lockForUpdate]
   * @param {string|null} [input.startTime]
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async findAgendaConflictCandidates(input = {}) {
    const dayVariants = readDayOfWeekVariants(input.dayOfWeek);
    const startTime = requiredText(input.startTime, "startTime", 20);
    const endTime = nullableText(input.endTime, 20) || addMinutesToTime(startTime, 60);

    if (dayVariants.length === 0) {
      return [];
    }

    const placeholders = dayVariants.map(() => "?").join(", ");
    const lockClause = input.lockForUpdate === true ? " FOR UPDATE" : "";
    const rows = await this.query(
      `${SELECT_AGENDA_CONFLICT_CANDIDATES_SQL_PREFIX} (${placeholders})
       AND item.start_time < ?
       AND COALESCE(NULLIF(item.end_time, ''), '23:59') > ?
       ORDER BY item.start_time ASC, item.id ASC${lockClause}`,
      [...dayVariants, endTime, startTime],
    );

    return readRows(rows).map(toAgendaConflictCandidateData);
  }

  /**
   * @param {Object} input
   * @param {string|null} [input.date]
   * @param {string|number|null} [input.dayOfWeek]
   * @param {string|null} [input.endTime]
   * @param {string|null} [input.startTime]
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async findAgendaAdministrativeBlocks(input = {}) {
    const date = nullableText(input.date, 10);
    const dayVariants = readDayOfWeekVariants(input.dayOfWeek);
    const startTime = requiredText(input.startTime, "startTime", 20);
    const endTime = nullableText(input.endTime, 20) || addMinutesToTime(startTime, 60);

    if (!date && dayVariants.length === 0) {
      return [];
    }

    const placeholders = dayVariants.length > 0 ? dayVariants.map(() => "?").join(", ") : "''";

    try {
      const rows = await this.query(
        `${SELECT_AGENDA_ADMIN_BLOCKS_SQL_PREFIX} (${placeholders})
        )
        AND (
          block_type = 'UNAVAILABLE_DATE'
          OR (start_time < ? AND COALESCE(NULLIF(end_time, ''), '23:59') > ?)
        )
        ORDER BY block_date ASC, start_time ASC, id ASC`,
        [date || "", ...dayVariants, endTime, startTime],
      );

      return readRows(rows).map(toAgendaAdministrativeBlockData);
    } catch (error) {
      if (error?.code === "ER_NO_SUCH_TABLE" || error?.errno === 1146) {
        return [];
      }

      throw error;
    }
  }

  /**
   * @param {{ agendaItemId?: string|null }} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findAgendaItemById(input = {}) {
    const agendaItemId = requiredText(input.agendaItemId, "agendaItemId", 64);
    const rows = await this.query(SELECT_AGENDA_ITEM_BY_ID_SQL, [agendaItemId]);
    const [item] = readRows(rows).map(toAgendaItemData);

    return item || null;
  }

  /**
   * @param {Object} input
   * @param {string|null} [input.agendaItemId]
   * @param {string|number|null} [input.dayOfWeek]
   * @param {string|null} [input.endTime]
   * @param {string|null} [input.startTime]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async updateAgendaItemSchedule(input = {}) {
    const agendaItemId = requiredText(input.agendaItemId, "agendaItemId", 64);
    const dayOfWeek = requiredText(readPrimaryDayLabel(input.dayOfWeek), "dayOfWeek", 32);
    const startTime = requiredText(input.startTime, "startTime", 20);
    const endTime = nullableText(input.endTime, 20);
    const metadataJson = buildRescheduleMetadataJson(input);
    const result = await this.query(UPDATE_AGENDA_ITEM_SCHEDULE_SQL, [
      dayOfWeek,
      startTime,
      endTime,
      metadataJson,
      agendaItemId,
    ]);

    if (Number(readMutationResult(result)?.affectedRows || 0) === 0) {
      return null;
    }

    return this.findAgendaItemById({ agendaItemId });
  }

  /**
   * @param {Record<string, unknown>} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async createRecurrenceSeries(input = {}) {
    const rule = normalizeRecurrenceRule(input);
    const idempotencyKey =
      nullableText(input.idempotencyKey, 191) || buildRecurrenceIdempotencyKey(rule);
    const existing = await this.findRecurrenceSeriesByIdempotencyKey({ idempotencyKey });

    if (existing) {
      return existing;
    }

    const series = {
      ...rule,
      id: rule.id || buildStableId("agenda_series", idempotencyKey),
      idempotencyKey,
      requestedBy: nullableText(input.requestedBy, 191),
      source: nullableText(input.source, 50) || rule.source || "AGENDA_ADMIN",
    };

    await this.query(INSERT_RECURRENCE_SERIES_SQL, toRecurrenceSeriesInsertParams(series));

    const created = await this.findRecurrenceSeriesById({ seriesId: series.id });
    await this.recordRecurrenceHistory({
      action: "CREATE_SERIES",
      after: created,
      requestedBy: series.requestedBy,
      seriesId: series.id,
    });

    return created || series;
  }

  /**
   * @param {{ seriesId?: string|null }} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findRecurrenceSeriesById(input = {}) {
    const seriesId = requiredText(input.seriesId, "seriesId", 64);
    const rows = await this.query(SELECT_RECURRENCE_SERIES_BY_ID_SQL, [seriesId]);
    const [series] = readRows(rows).map(toRecurrenceSeriesData);

    return series || null;
  }

  /**
   * @param {{ idempotencyKey?: string|null }} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findRecurrenceSeriesByIdempotencyKey(input = {}) {
    const idempotencyKey = requiredText(input.idempotencyKey, "idempotencyKey", 191);
    const rows = await this.query(SELECT_RECURRENCE_SERIES_BY_IDEMPOTENCY_KEY_SQL, [
      idempotencyKey,
    ]);
    const [series] = readRows(rows).map(toRecurrenceSeriesData);

    return series || null;
  }

  /**
   * @param {{ endDate?: string|null, seriesId?: string|null, startDate?: string|null }} input
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async findRecurrenceExceptions(input = {}) {
    const seriesId = requiredText(input.seriesId, "seriesId", 64);
    const startDate = normalizeDateString(input.startDate);
    const endDate = normalizeDateString(input.endDate);
    const rows = await this.query(SELECT_RECURRENCE_EXCEPTIONS_SQL, [
      seriesId,
      startDate,
      startDate,
      endDate,
      endDate,
    ]);

    return readRows(rows).map(toRecurrenceExceptionData);
  }

  /**
   * @param {{ seriesId?: string|null, occurrenceKey?: string|null }} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findRecurrenceExceptionByKey(input = {}) {
    const seriesId = requiredText(input.seriesId, "seriesId", 64);
    const occurrenceKey = requiredText(input.occurrenceKey, "occurrenceKey", 191);
    const rows = await this.query(SELECT_RECURRENCE_EXCEPTION_BY_KEY_SQL, [
      seriesId,
      occurrenceKey,
    ]);
    const [exception] = readRows(rows).map(toRecurrenceExceptionData);

    return exception || null;
  }

  /**
   * @param {Record<string, unknown>} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async createRecurrenceException(input = {}) {
    const seriesId = requiredText(input.seriesId, "seriesId", 64);
    const occurrence = normalizeOccurrenceReference({
      ...readObject(input.occurrence),
      occurrenceDate: input.occurrenceDate,
      occurrenceKey: input.occurrenceKey,
      occurrenceStartTime: input.occurrenceStartTime,
      seriesId,
    });
    const exceptionType =
      normalizeUpperText(input.exceptionType) === RECURRENCE_EXCEPTION_TYPES.CANCELLED
        ? RECURRENCE_EXCEPTION_TYPES.CANCELLED
        : RECURRENCE_EXCEPTION_TYPES.MODIFIED;
    const existing = await this.findRecurrenceExceptionByKey({
      occurrenceKey: occurrence.key,
      seriesId,
    });

    if (existing) {
      return existing;
    }

    const exceptionId = buildStableId(
      "agenda_exception",
      [seriesId, occurrence.key, exceptionType].join(":"),
    );
    const override = readObject(input.override);
    const requestedBy = nullableText(input.requestedBy, 191);

    await this.query(INSERT_RECURRENCE_EXCEPTION_SQL, [
      exceptionId,
      seriesId,
      occurrence.key,
      occurrence.date,
      occurrence.startTime,
      exceptionType,
      JSON.stringify(override),
      nullableText(input.reason, 500),
      requestedBy,
    ]);

    const created = await this.findRecurrenceExceptionByKey({
      occurrenceKey: occurrence.key,
      seriesId,
    });

    await this.recordRecurrenceHistory({
      action:
        exceptionType === RECURRENCE_EXCEPTION_TYPES.CANCELLED
          ? "CANCEL_OCCURRENCE"
          : "UPDATE_OCCURRENCE",
      after: created,
      exceptionId: created?.id || exceptionId,
      occurrenceKey: occurrence.key,
      reason: input.reason,
      requestedBy,
      scope: input.scope || RECURRENCE_OPERATION_SCOPES.THIS_OCCURRENCE,
      seriesId,
    });

    return created || {
      exceptionType,
      id: exceptionId,
      occurrenceDate: occurrence.date,
      occurrenceKey: occurrence.key,
      occurrenceStartTime: occurrence.startTime,
      override,
      seriesId,
    };
  }

  /**
   * @param {Record<string, unknown>} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async cancelRecurrenceSeries(input = {}) {
    const seriesId = requiredText(input.seriesId, "seriesId", 64);
    const before = await this.findRecurrenceSeriesById({ seriesId });

    if (!before) {
      return null;
    }

    const requestedBy = nullableText(input.requestedBy, 191);
    await this.query(CANCEL_RECURRENCE_SERIES_SQL, [
      CANCELLED_RECURRENCE_STATUS,
      requestedBy,
      nullableText(input.reason, 500),
      requestedBy,
      seriesId,
      CANCELLED_RECURRENCE_STATUS,
    ]);

    const after = await this.findRecurrenceSeriesById({ seriesId });
    await this.recordRecurrenceHistory({
      action: "CANCEL_SERIES",
      after,
      before,
      reason: input.reason,
      requestedBy,
      scope: RECURRENCE_OPERATION_SCOPES.SERIES,
      seriesId,
    });

    return after;
  }

  /**
   * @param {Record<string, unknown>} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async updateRecurrenceSeries(input = {}) {
    const seriesId = requiredText(input.seriesId, "seriesId", 64);
    const before = await this.findRecurrenceSeriesById({ seriesId });

    if (!before) {
      return null;
    }

    const changes = normalizeRecurrenceRuleChanges(input.changes || input);
    const normalized = normalizeRecurrenceRule({
      ...before,
      ...changes,
      id: seriesId,
    });
    const update = buildRecurrenceSeriesUpdate(changes, normalized);

    if (update.assignments.length === 0) {
      return before;
    }

    const requestedBy = nullableText(input.requestedBy, 191);
    await this.query(
      `
        UPDATE ${AGENDA_RECURRENCE_SERIES_TABLE}
        SET ${update.assignments.join(", ")},
            updated_by = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status <> ?
      `,
      [...update.params, requestedBy, seriesId, CANCELLED_RECURRENCE_STATUS],
    );

    const after = await this.findRecurrenceSeriesById({ seriesId });
    await this.recordRecurrenceHistory({
      action: "UPDATE_SERIES",
      after,
      before,
      reason: input.reason,
      requestedBy,
      scope: input.scope || RECURRENCE_OPERATION_SCOPES.SERIES,
      seriesId,
    });

    return after;
  }

  /**
   * @param {Record<string, unknown>} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async splitRecurrenceSeries(input = {}) {
    const seriesId = requiredText(input.seriesId, "seriesId", 64);
    const occurrence = normalizeOccurrenceReference({
      ...readObject(input.occurrence),
      seriesId,
    });
    const before = await this.findRecurrenceSeriesById({ seriesId });

    if (!before) {
      return {
        nextSeries: null,
        previousSeries: null,
      };
    }

    const requestedBy = nullableText(input.requestedBy, 191);
    const previousEndDate = addDaysToDateKey(occurrence.date, -1);
    const previousSeries = await this.updateRecurrenceSeries({
      changes: { endDate: previousEndDate },
      reason: input.reason || "Split recurrence series before following update.",
      requestedBy,
      scope: RECURRENCE_OPERATION_SCOPES.THIS_AND_FOLLOWING,
      seriesId,
    });
    const nextSeries = await this.createRecurrenceSeries({
      ...before,
      ...readObject(input.changes),
      id: null,
      parentSeriesId: seriesId,
      requestedBy,
      source: before.source || "AGENDA_ADMIN",
      startDate: occurrence.date,
    });

    await this.recordRecurrenceHistory({
      action: "SPLIT_SERIES",
      after: { nextSeries, previousSeries },
      before,
      occurrenceKey: occurrence.key,
      reason: input.reason,
      requestedBy,
      scope: RECURRENCE_OPERATION_SCOPES.THIS_AND_FOLLOWING,
      seriesId,
    });

    return {
      nextSeries,
      previousSeries,
    };
  }

  /**
   * @param {Record<string, unknown>} input
   * @returns {Promise<void>}
   */
  async recordRecurrenceHistory(input = {}) {
    const seriesId = requiredText(input.seriesId, "seriesId", 64);
    const action = requiredText(input.action, "action", 50);
    const historyId = buildStableId(
      "agenda_recur_hist",
      [
        seriesId,
        input.exceptionId || "",
        action,
        input.scope || "",
        input.occurrenceKey || "",
        Date.now(),
        Math.random(),
      ].join(":"),
    );

    await this.query(INSERT_RECURRENCE_HISTORY_SQL, [
      historyId,
      seriesId,
      nullableText(input.exceptionId, 64),
      action,
      nullableText(input.scope, 32),
      nullableText(input.occurrenceKey, 191),
      stringifyJsonOrNull(input.before),
      stringifyJsonOrNull(input.after),
      nullableText(input.reason, 500),
      nullableText(input.requestedBy, 191),
    ]);
  }

  /**
   * @param {(repository: MySqlAgendaRepository) => Promise<unknown>} work
   * @returns {Promise<unknown>}
   */
  async withAgendaTransaction(work) {
    if (typeof work !== "function") {
      throw new TypeError("MySqlAgendaRepository.withAgendaTransaction requires work.");
    }

    if (!this.usesDefaultQueryRunner) {
      return work(this);
    }

    const { transaction } = require("../../../../config/db.js");

    return transaction(async (connection) => {
      const transactionalRepository = new MySqlAgendaRepository({
        queryRunner(sql, params) {
          return connection.execute(sql, params);
        },
      });

      return work(transactionalRepository);
    });
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
      "This schedule is derived from j12_turmas fields.",
      "No attendance, recurrence, cancellation or replacement row was created.",
      "Initial planned Agenda persistence is handled separately in enrollment_agenda_items.",
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
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
function toAgendaConflictCandidateData(row) {
  const metadata = parseJsonObject(row?.metadata_json);
  const courtId = nullableText(
    row?.court_id ?? row?.quadra_id ?? metadata.courtId ?? metadata.quadraId,
    64,
  );
  const courtName = nullableText(
    row?.court_name ??
      row?.quadra_name ??
      metadata.courtName ??
      metadata.quadraName ??
      row?.unidade,
    191,
  );

  return {
    agendaItemId: nullableText(row?.agenda_item_id ?? row?.id, 64),
    capacity: normalizeOptionalInteger(row?.capacidade),
    classId: normalizeOptionalInteger(row?.class_id),
    classLinkId: nullableText(row?.class_link_id, 64),
    className: nullableText(row?.class_name, 191),
    classStatus: nullableText(row?.class_status, 32),
    courtId,
    courtName,
    dayOfWeek: nullableText(row?.day_of_week, 32),
    endTime: nullableText(row?.end_time, 20),
    enrollmentId: nullableText(row?.enrollment_id, 64),
    enrollmentStatus: nullableText(row?.enrollment_status, 32),
    eventId: nullableText(row?.agenda_item_id ?? row?.id, 191),
    metadata,
    professorId: row?.professor_id == null ? null : String(row.professor_id),
    professorName: nullableText(row?.professor_name, 191),
    recurrenceType: nullableText(row?.recurrence_type, 32),
    scheduleStatus: nullableText(row?.agenda_status, 32),
    startTime: nullableText(row?.start_time, 20),
    status: nullableText(row?.agenda_status, 32),
    studentPersonId: nullableText(row?.student_person_id, 64),
    studentProfileId: nullableText(row?.student_profile_id, 64),
  };
}

/**
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
function toAgendaAdministrativeBlockData(row) {
  return {
    active: Number(row?.active ?? 1) === 1,
    date: nullableText(row?.block_date, 10),
    dayOfWeek: nullableText(row?.day_of_week, 32),
    endTime: nullableText(row?.end_time, 20),
    id: nullableText(row?.id, 64),
    message: nullableText(row?.message, 500),
    resourceId: nullableText(row?.resource_id, 191),
    resourceName: nullableText(row?.resource_name, 191),
    resourceType: nullableText(row?.resource_type, 32),
    severity: nullableText(row?.severity, 32),
    startTime: nullableText(row?.start_time, 20),
    type: nullableText(row?.block_type, 32),
  };
}

/**
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
function toRecurrenceSeriesData(row) {
  const metadata = parseJsonObject(row?.metadata_json);

  return {
    agendaItemId: nullableText(row?.agenda_item_id, 64),
    cancelReason: nullableText(row?.cancel_reason, 500),
    cancelledAt: row?.cancelled_at ?? null,
    cancelledBy: nullableText(row?.cancelled_by, 191),
    classId: row?.class_id == null ? null : String(row.class_id),
    classLinkId: nullableText(row?.class_link_id, 64),
    courtId: nullableText(row?.court_id, 64),
    courtName: nullableText(row?.court_name, 191),
    createdAt: row?.created_at ?? null,
    createdBy: nullableText(row?.created_by, 191),
    daysOfWeek: parseJsonArray(row?.days_of_week_json).map((value) =>
      Number.isFinite(Number(value)) ? Number(value) : value,
    ),
    endDate: normalizeDateString(row?.end_date),
    endTime: nullableText(row?.end_time, 20),
    enrollmentId: nullableText(row?.enrollment_id, 64),
    frequency: nullableText(row?.frequency, 32),
    id: nullableText(row?.id, 64),
    idempotencyKey: nullableText(row?.idempotency_key, 191),
    intervalUnit: nullableText(row?.interval_unit, 16),
    intervalValue: normalizeOptionalInteger(row?.interval_value) || 1,
    maxOccurrences: normalizeOptionalInteger(row?.max_occurrences),
    metadata,
    parentSeriesId: nullableText(row?.parent_series_id, 64),
    professorId: nullableText(row?.professor_id, 64),
    professorName: nullableText(row?.professor_name, 191),
    recurrencePersisted: true,
    source: nullableText(row?.source, 50),
    startDate: normalizeDateString(row?.start_date),
    startTime: nullableText(row?.start_time, 20),
    status: nullableText(row?.status, 32),
    studentPersonId: nullableText(row?.student_person_id, 64),
    studentProfileId: nullableText(row?.student_profile_id, 64),
    timezone: nullableText(row?.timezone, 64) || DEFAULT_TIMEZONE,
    updatedAt: row?.updated_at ?? null,
    updatedBy: nullableText(row?.updated_by, 191),
  };
}

/**
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
function toRecurrenceExceptionData(row) {
  return {
    createdAt: row?.created_at ?? null,
    createdBy: nullableText(row?.created_by, 191),
    exceptionType: nullableText(row?.exception_type, 32),
    id: nullableText(row?.id, 64),
    occurrenceDate: normalizeDateString(row?.occurrence_date),
    occurrenceKey: nullableText(row?.occurrence_key, 191),
    occurrenceStartTime: nullableText(row?.occurrence_start_time, 20),
    override: parseJsonObject(row?.override_json),
    reason: nullableText(row?.reason, 500),
    seriesId: nullableText(row?.series_id, 64),
  };
}

/**
 * @param {Record<string, unknown>} series
 * @returns {unknown[]}
 */
function toRecurrenceSeriesInsertParams(series) {
  const daysOfWeekJson = JSON.stringify(Array.isArray(series.daysOfWeek) ? series.daysOfWeek : []);
  const metadataJson = stringifyJsonOrNull({
    ...readObject(series.metadata),
    noAttendanceCreated: true,
    noFinancialSideEffects: true,
    noNotificationSideEffects: true,
  });

  return [
    series.id,
    series.agendaItemId || null,
    series.parentSeriesId || null,
    series.enrollmentId || null,
    normalizeOptionalInteger(series.classId),
    series.classLinkId || null,
    series.studentPersonId || null,
    series.studentProfileId || null,
    series.frequency,
    series.intervalValue || 1,
    series.intervalUnit || "WEEK",
    daysOfWeekJson,
    series.startDate,
    series.endDate || null,
    series.maxOccurrences || null,
    series.startTime,
    series.endTime || null,
    series.timezone || DEFAULT_TIMEZONE,
    series.professorId || null,
    series.professorName || null,
    series.courtId || null,
    series.courtName || null,
    series.status || ACTIVE_RECURRENCE_STATUS,
    series.source || "AGENDA_ADMIN",
    series.idempotencyKey,
    metadataJson,
    series.requestedBy || null,
    series.requestedBy || null,
  ];
}

/**
 * @param {Record<string, unknown>} changes
 * @param {Record<string, unknown>} normalized
 * @returns {{ assignments: string[], params: unknown[] }}
 */
function buildRecurrenceSeriesUpdate(changes, normalized) {
  const assignments = [];
  const params = [];
  const append = (column, value) => {
    assignments.push(`${column} = ?`);
    params.push(value);
  };

  if (hasOwn(changes, "frequency")) append("frequency", normalized.frequency);
  if (hasOwn(changes, "intervalValue")) append("interval_value", normalized.intervalValue);
  if (hasOwn(changes, "intervalUnit")) append("interval_unit", normalized.intervalUnit);
  if (hasOwn(changes, "daysOfWeek")) append("days_of_week_json", JSON.stringify(normalized.daysOfWeek));
  if (hasOwn(changes, "startDate")) append("start_date", normalized.startDate);
  if (hasOwn(changes, "endDate")) append("end_date", normalized.endDate || null);
  if (hasOwn(changes, "maxOccurrences")) append("max_occurrences", normalized.maxOccurrences || null);
  if (hasOwn(changes, "startTime")) append("start_time", normalized.startTime);
  if (hasOwn(changes, "endTime")) append("end_time", normalized.endTime || null);
  if (hasOwn(changes, "professorId")) append("professor_id", normalized.professorId || null);
  if (hasOwn(changes, "professorName")) append("professor_name", normalized.professorName || null);
  if (hasOwn(changes, "courtId")) append("court_id", normalized.courtId || null);
  if (hasOwn(changes, "courtName")) append("court_name", normalized.courtName || null);

  return { assignments, params };
}

function parseJsonArray(value) {
  const raw = nullableText(value, 65535);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
 * @param {unknown} value
 * @returns {string[]}
 */
function readDayOfWeekVariants(value) {
  const normalized = normalizeDayOfWeekIndex(value);

  if (!Number.isInteger(normalized)) {
    return [];
  }

  const labels = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

  return uniqueStrings([
    String(normalized),
    normalized === 0 ? "7" : null,
    labels[normalized],
  ]);
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizeDayOfWeekIndex(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value === 7) return 0;
    return value >= 0 && value <= 6 ? value : null;
  }

  const normalized = String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const aliases = {
    "0": 0,
    "7": 0,
    dom: 0,
    domingo: 0,
    "1": 1,
    seg: 1,
    segunda: 1,
    "segunda-feira": 1,
    "2": 2,
    ter: 2,
    terca: 2,
    "terca-feira": 2,
    "3": 3,
    qua: 3,
    quarta: 3,
    "quarta-feira": 3,
    "4": 4,
    qui: 4,
    quinta: 4,
    "quinta-feira": 4,
    "5": 5,
    sex: 5,
    sexta: 5,
    "sexta-feira": 5,
    "6": 6,
    sab: 6,
    sabado: 6,
  };

  return aliases[normalized] ?? null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function readPrimaryDayLabel(value) {
  const normalized = normalizeDayOfWeekIndex(value);

  if (!Number.isInteger(normalized)) {
    return nullableText(value, 32);
  }

  return ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"][normalized];
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
 * @param {string} time
 * @param {number} amount
 * @returns {string}
 */
function addMinutesToTime(time, amount) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(time || ""));

  if (!match) {
    return "23:59";
  }

  const total = Math.min(Number(match[1]) * 60 + Number(match[2]) + amount, 23 * 60 + 59);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * @param {Record<string, unknown>} input
 * @returns {string|null}
 */
function buildRescheduleMetadataJson(input = {}) {
  const metadata = {
    courtId: nullableText(input.courtId ?? input.quadraId, 64),
    courtName: nullableText(input.courtName ?? input.quadraName, 191),
    professorId: nullableText(input.professorId, 64),
    professorName: nullableText(input.professorName, 191),
    rescheduleReason: nullableText(input.reason, 500),
    rescheduledAt: new Date().toISOString(),
  };
  const compact = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== null && value !== undefined),
  );

  return Object.keys(compact).length > 0 ? JSON.stringify(compact) : null;
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

function stringifyJsonOrNull(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value !== "object") {
    return JSON.stringify(value);
  }

  const object = readObject(value);

  if (Object.keys(object).length === 0) {
    return null;
  }

  return JSON.stringify(object);
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(readObject(source), key);
}

function normalizeUpperText(value) {
  const normalized = nullableText(value, 64);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeDateString(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }

  const normalized = nullableText(value, 32);

  if (!normalized) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);

  if (!match) {
    return null;
  }

  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== Number(match[1]) ||
    parsed.getMonth() + 1 !== Number(match[2]) ||
    parsed.getDate() !== Number(match[3])
  ) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function addDaysToDateKey(value, amount) {
  const normalized = normalizeDateString(value);

  if (!normalized) {
    return null;
  }

  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
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
      "Read summaries are derived from active Enrollment -> Turma links.",
      "Initial planned Agenda items are persisted separately in enrollment_agenda_items.",
      "Attendance is not created or updated by this repository.",
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
 * @param {unknown} result
 * @returns {Record<string, unknown>|null}
 */
function readMutationResult(result) {
  if (Array.isArray(result)) {
    const [first] = result;
    return first && typeof first === "object" && !Array.isArray(first) ? first : null;
  }

  return result && typeof result === "object" && !Array.isArray(result) ? result : null;
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
  AGENDA_RECURRENCE_EXCEPTIONS_TABLE,
  AGENDA_RECURRENCE_HISTORY_TABLE,
  AGENDA_RECURRENCE_SERIES_TABLE,
  AGENDA_SOURCE,
  CANCEL_RECURRENCE_SERIES_SQL,
  INITIAL_AGENDA_SOURCE,
  INSERT_INITIAL_AGENDA_ITEM_SQL,
  INSERT_RECURRENCE_EXCEPTION_SQL,
  INSERT_RECURRENCE_HISTORY_SQL,
  INSERT_RECURRENCE_SERIES_SQL,
  MySqlAgendaRepository,
  SELECT_AGENDA_ADMIN_BLOCKS_SQL_PREFIX,
  SELECT_AGENDA_CONFLICT_CANDIDATES_SQL_PREFIX,
  SELECT_AGENDA_ITEM_BY_ID_SQL,
  SELECT_AGENDA_ITEMS_BY_IDEMPOTENCY_KEYS_SQL_PREFIX,
  SELECT_RECURRENCE_EXCEPTIONS_SQL,
  SELECT_RECURRENCE_EXCEPTION_BY_KEY_SQL,
  SELECT_RECURRENCE_SERIES_BY_IDEMPOTENCY_KEY_SQL,
  SELECT_RECURRENCE_SERIES_BY_ID_SQL,
  SELECT_SCHEDULES_BY_CLASS_SQL,
  SELECT_SCHEDULES_BY_ENROLLMENT_SQL,
  SELECT_SCHEDULES_BY_STUDENT_SQL,
  UPDATE_AGENDA_ITEM_SCHEDULE_SQL,
  WEEKLY_RECURRENCE_TYPE,
  buildAgendaItemId,
  buildAgendaItemIdempotencyKey,
  buildAgendaSummary,
  buildInitialAgendaItems,
  readDayOfWeekVariants,
  parseDaysOfWeek,
  readRows,
  toAgendaAdministrativeBlockData,
  toAgendaConflictCandidateData,
  toAgendaItemData,
  toAgendaScheduleData,
};
