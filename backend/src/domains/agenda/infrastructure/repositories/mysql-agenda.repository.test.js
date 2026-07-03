const assert = require("node:assert/strict");
const test = require("node:test");

const {
  INSERT_INITIAL_AGENDA_ITEM_SQL,
  INSERT_RECURRENCE_EXCEPTION_SQL,
  INSERT_RECURRENCE_HISTORY_SQL,
  INSERT_RECURRENCE_SERIES_SQL,
  MySqlAgendaRepository,
  SELECT_AGENDA_CONFLICT_CANDIDATES_SQL_PREFIX,
  SELECT_AGENDA_ITEM_BY_ID_SQL,
  SELECT_AGENDA_ITEMS_BY_IDEMPOTENCY_KEYS_SQL_PREFIX,
  SELECT_RECURRENCE_EXCEPTION_BY_KEY_SQL,
  SELECT_RECURRENCE_SERIES_BY_IDEMPOTENCY_KEY_SQL,
  SELECT_RECURRENCE_SERIES_BY_ID_SQL,
  SELECT_SCHEDULES_BY_CLASS_SQL,
  SELECT_SCHEDULES_BY_ENROLLMENT_SQL,
  SELECT_SCHEDULES_BY_STUDENT_SQL,
  UPDATE_AGENDA_ITEM_SCHEDULE_SQL,
  buildAgendaItemIdempotencyKey,
  parseDaysOfWeek,
} = require("./mysql-agenda.repository.js");

function createScheduleRow(overrides = {}) {
  return {
    class_id: 7,
    class_link_id: "link-1",
    class_link_status: "ACTIVE",
    class_name: "Sub-13",
    class_status: "ativa",
    created_at: "2026-07-02 10:00:00",
    dias_semana: "segunda/quarta",
    dias_semana_json: '["segunda","quarta"]',
    enrollment_id: "enr-1",
    enrollment_status: "ACTIVE",
    horario: "08:00",
    horario_fim: "09:00",
    horario_inicio: "08:00",
    modalidade: "Futsal",
    modalidade_id: 2,
    professor_id: 3,
    professor_name: "Professor",
    student_person_id: "person-1",
    student_profile_id: "profile-1",
    unidade: "Unidade Centro",
    unidade_id: 4,
    ...overrides,
  };
}

test("MySqlAgendaRepository findSchedulesByClass uses a parameterized read-only query", async () => {
  const calls = [];
  const repository = new MySqlAgendaRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });
      return [createScheduleRow({ enrollment_id: null })];
    },
  });

  const schedules = await repository.findSchedulesByClass({ classId: "7" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, SELECT_SCHEDULES_BY_CLASS_SQL);
  assert.deepEqual(calls[0].params, [7]);
  assert.equal(schedules[0].id, "class:7");
  assert.equal(schedules[0].readOnly, true);
  assert.equal(schedules[0].scheduleCreated, false);
  assert.equal(schedules[0].attendanceCreated, false);
});

test("MySqlAgendaRepository findSchedulesByStudent scopes by person/profile and ACTIVE links", async () => {
  const calls = [];
  const repository = new MySqlAgendaRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });
      return [[createScheduleRow()], []];
    },
  });

  const schedules = await repository.findSchedulesByStudent({
    studentPersonId: "person-1",
    studentProfileId: "profile-1",
  });

  assert.equal(calls[0].sql, SELECT_SCHEDULES_BY_STUDENT_SQL);
  assert.deepEqual(calls[0].params, ["ACTIVE", "person-1", "profile-1", "ACTIVE"]);
  assert.equal(schedules[0].id, "enrollment:enr-1:class:7");
  assert.deepEqual(schedules[0].daysOfWeek, ["segunda", "quarta"]);
  assert.equal(schedules[0].studentPersonId, "person-1");
  assert.equal(schedules[0].studentProfileId, "profile-1");
});

test("MySqlAgendaRepository findSchedulesByEnrollment requires ACTIVE enrollment", async () => {
  const calls = [];
  const repository = new MySqlAgendaRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });
      return [createScheduleRow()];
    },
  });

  const schedules = await repository.findSchedulesByEnrollment({ enrollmentId: "enr-1" });

  assert.equal(calls[0].sql, SELECT_SCHEDULES_BY_ENROLLMENT_SQL);
  assert.deepEqual(calls[0].params, ["ACTIVE", "enr-1", "ACTIVE"]);
  assert.equal(schedules[0].enrollmentId, "enr-1");
  assert.equal(schedules[0].activeEnrollment, true);
});

test("MySqlAgendaRepository summary is read-only and reports class count", async () => {
  const repository = new MySqlAgendaRepository({
    async queryRunner() {
      return [createScheduleRow(), createScheduleRow({ class_id: 8, class_name: "Sub-15" })];
    },
  });

  const summary = await repository.getAgendaSummaryByStudent({
    studentPersonId: "person-1",
    studentProfileId: "profile-1",
  });

  assert.equal(summary.scheduleCount, 2);
  assert.equal(summary.classCount, 2);
  assert.deepEqual(summary.classIds, ["7", "8"]);
  assert.equal(summary.noScheduleCreated, true);
  assert.equal(summary.noAttendanceCreated, true);
  assert.equal(summary.readOnly, true);
});

test("MySqlAgendaRepository schedule lookup SQL constants stay read-only", () => {
  const sqlText = [
    SELECT_SCHEDULES_BY_CLASS_SQL,
    SELECT_SCHEDULES_BY_STUDENT_SQL,
    SELECT_SCHEDULES_BY_ENROLLMENT_SQL,
  ].join("\n");

  assert.match(sqlText, /\bSELECT\b/i);
  assert.doesNotMatch(sqlText, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
});

test("parseDaysOfWeek handles JSON and legacy separators", () => {
  assert.deepEqual(parseDaysOfWeek('["segunda","quarta"]'), ["segunda", "quarta"]);
  assert.deepEqual(parseDaysOfWeek(null, "terca/quinta"), ["terca", "quinta"]);
});

test("MySqlAgendaRepository creates initial agenda items idempotently", async () => {
  const calls = [];
  let selectCount = 0;
  const repository = new MySqlAgendaRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });

      if (sql.includes("FROM enrollment_agenda_items")) {
        selectCount += 1;

        if (selectCount === 1) {
          return [];
        }

        return [
          createAgendaItemRow({
            day_of_week: "segunda",
            idempotency_key: params[0],
          }),
          createAgendaItemRow({
            day_of_week: "quarta",
            idempotency_key: params[1],
          }),
        ];
      }

      if (sql === INSERT_INITIAL_AGENDA_ITEM_SQL) {
        return { affectedRows: 1 };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  const result = await repository.createInitialAgendaForEnrollment({
    classId: 7,
    enrollmentId: "enr-1",
    requestedBy: "admin-1",
    scheduleCandidates: [
      {
        classId: 7,
        classLinkId: "link-1",
        daysOfWeek: ["segunda", "quarta"],
        id: "enrollment:enr-1:class:7",
        sourceTables: ["enrollment_class_links", "enrollments", "j12_turmas"],
        startTime: "08:00",
      },
    ],
    studentPersonId: "person-1",
    studentProfileId: "profile-1",
  });

  const insertCalls = calls.filter((call) => call.sql === INSERT_INITIAL_AGENDA_ITEM_SQL);

  assert.equal(result.agendaCreated, true);
  assert.equal(result.createdCount, 2);
  assert.equal(result.reusedCount, 0);
  assert.equal(result.persistedAgendaCount, 2);
  assert.equal(result.noAttendanceCreated, true);
  assert.equal(result.noFinancialSideEffects, true);
  assert.equal(result.noNotificationSideEffects, true);
  assert.equal(insertCalls.length, 2);
  assert.equal(insertCalls[0].params[1], "enr-1");
  assert.equal(insertCalls[0].params[2], 7);
  assert.equal(insertCalls[0].params[6], "segunda");
  assert.equal(insertCalls[0].params[7], "08:00");
});

test("MySqlAgendaRepository reuses duplicate initial agenda items", async () => {
  const calls = [];
  const existingKey = buildAgendaItemIdempotencyKey({
    classId: 7,
    dayOfWeek: "segunda",
    enrollmentId: "enr-1",
    startTime: "08:00",
  });
  const repository = new MySqlAgendaRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });

      if (sql.includes("FROM enrollment_agenda_items")) {
        return [createAgendaItemRow({ idempotency_key: existingKey })];
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  const result = await repository.createInitialAgendaForEnrollment({
    classId: 7,
    enrollmentId: "enr-1",
    requestedBy: "admin-1",
    scheduleCandidates: [
      {
        classId: 7,
        daysOfWeek: ["segunda"],
        startTime: "08:00",
      },
    ],
    studentPersonId: "person-1",
    studentProfileId: "profile-1",
  });

  assert.equal(result.agendaCreated, false);
  assert.equal(result.createdCount, 0);
  assert.equal(result.reusedCount, 1);
  assert.equal(result.duplicateAgendaReusedOrBlocked, true);
  assert.equal(calls.some((call) => call.sql === INSERT_INITIAL_AGENDA_ITEM_SQL), false);
});

test("MySqlAgendaRepository persistence SQL is scoped to Agenda only", () => {
  const sqlText = [
    INSERT_INITIAL_AGENDA_ITEM_SQL,
    INSERT_RECURRENCE_EXCEPTION_SQL,
    INSERT_RECURRENCE_HISTORY_SQL,
    INSERT_RECURRENCE_SERIES_SQL,
    SELECT_AGENDA_ITEMS_BY_IDEMPOTENCY_KEYS_SQL_PREFIX,
    SELECT_AGENDA_CONFLICT_CANDIDATES_SQL_PREFIX,
    SELECT_RECURRENCE_EXCEPTION_BY_KEY_SQL,
    SELECT_RECURRENCE_SERIES_BY_IDEMPOTENCY_KEY_SQL,
    SELECT_RECURRENCE_SERIES_BY_ID_SQL,
    UPDATE_AGENDA_ITEM_SCHEDULE_SQL,
  ].join("\n");

  assert.match(sqlText, /enrollment_agenda_items|agenda_recurrence_series/);
  assert.doesNotMatch(sqlText, /\b(student_presencas|j12_presencas|financeiro|notificacoes)\b/i);
  assert.doesNotMatch(sqlText, /\b(ALTER|DROP|TRUNCATE)\b/i);
});

test("MySqlAgendaRepository finds conflict candidates with day and overlap filters", async () => {
  const calls = [];
  const repository = new MySqlAgendaRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });
      return [
        {
          agenda_item_id: "agenda-2",
          class_id: 7,
          day_of_week: "segunda",
          end_time: "09:30",
          professor_id: "3",
          professor_name: "Professor",
          start_time: "08:30",
          status: "ACTIVE",
          student_person_id: "person-1",
          student_profile_id: "profile-1",
        },
      ];
    },
  });

  const candidates = await repository.findAgendaConflictCandidates({
    dayOfWeek: 1,
    endTime: "09:00",
    startTime: "08:00",
  });

  assert.match(calls[0].sql, /FROM enrollment_agenda_items item/);
  assert.match(calls[0].sql, /item.start_time < \?/);
  assert.deepEqual(calls[0].params, ["1", "segunda", "09:00", "08:00"]);
  assert.equal(candidates[0].agendaItemId, "agenda-2");
  assert.equal(candidates[0].professorId, "3");
});

test("MySqlAgendaRepository updates only a persisted Agenda item schedule", async () => {
  const calls = [];
  const repository = new MySqlAgendaRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });

      if (sql === UPDATE_AGENDA_ITEM_SCHEDULE_SQL) {
        return { affectedRows: 1 };
      }

      if (sql === SELECT_AGENDA_ITEM_BY_ID_SQL) {
        return [
          createAgendaItemRow({
            day_of_week: "terca",
            end_time: "10:00",
            id: "agenda-1",
            start_time: "09:00",
          }),
        ];
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  const result = await repository.updateAgendaItemSchedule({
    agendaItemId: "agenda-1",
    dayOfWeek: 2,
    endTime: "10:00",
    startTime: "09:00",
  });

  assert.equal(calls[0].sql, UPDATE_AGENDA_ITEM_SCHEDULE_SQL);
  assert.deepEqual(calls[0].params.slice(0, 3), ["terca", "09:00", "10:00"]);
  assert.equal(result.id, "agenda-1");
  assert.equal(result.dayOfWeek, "terca");
});

test("MySqlAgendaRepository creates recurrence series idempotently", async () => {
  const calls = [];
  const repository = new MySqlAgendaRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });

      if (sql === SELECT_RECURRENCE_SERIES_BY_IDEMPOTENCY_KEY_SQL) {
        return [];
      }

      if (sql === INSERT_RECURRENCE_SERIES_SQL) {
        return { affectedRows: 1 };
      }

      if (sql === SELECT_RECURRENCE_SERIES_BY_ID_SQL) {
        return [
          createRecurrenceSeriesRow({
            id: params[0],
            idempotency_key: calls[0].params[0],
          }),
        ];
      }

      if (sql === INSERT_RECURRENCE_HISTORY_SQL) {
        return { affectedRows: 1 };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  const result = await repository.createRecurrenceSeries({
    classId: 7,
    daysOfWeek: [1, 3],
    enrollmentId: "enr-1",
    frequency: "WEEKLY",
    requestedBy: "admin-1",
    startDate: "2026-07-06",
    startTime: "08:00",
  });

  assert.equal(result.recurrencePersisted, true);
  assert.equal(result.frequency, "WEEKLY");
  assert.deepEqual(result.daysOfWeek, [1, 3]);
  assert.equal(calls[0].sql, SELECT_RECURRENCE_SERIES_BY_IDEMPOTENCY_KEY_SQL);
  assert.equal(calls[1].sql, INSERT_RECURRENCE_SERIES_SQL);
  assert.equal(calls[1].params[8], "WEEKLY");
  assert.equal(calls[1].params[10], "WEEK");
  assert.equal(calls[3].sql, INSERT_RECURRENCE_HISTORY_SQL);
});

test("MySqlAgendaRepository reuses existing recurrence series by idempotency key", async () => {
  const calls = [];
  const repository = new MySqlAgendaRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });

      if (sql === SELECT_RECURRENCE_SERIES_BY_IDEMPOTENCY_KEY_SQL) {
        return [createRecurrenceSeriesRow({ idempotency_key: params[0] })];
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  const result = await repository.createRecurrenceSeries({
    classId: 7,
    daysOfWeek: [1],
    enrollmentId: "enr-1",
    frequency: "WEEKLY",
    startDate: "2026-07-06",
    startTime: "08:00",
  });

  assert.equal(result.id, "series-1");
  assert.equal(calls.length, 1);
});

test("MySqlAgendaRepository creates one recurrence exception per occurrence key", async () => {
  const calls = [];
  let exceptionSelectCount = 0;
  const repository = new MySqlAgendaRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });

      if (sql === SELECT_RECURRENCE_EXCEPTION_BY_KEY_SQL) {
        exceptionSelectCount += 1;
        return exceptionSelectCount === 1
          ? []
          : [
              createRecurrenceExceptionRow({
                occurrence_key: params[1],
                series_id: params[0],
              }),
            ];
      }

      if (sql === INSERT_RECURRENCE_EXCEPTION_SQL) {
        return { affectedRows: 1 };
      }

      if (sql === INSERT_RECURRENCE_HISTORY_SQL) {
        return { affectedRows: 1 };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });

  const result = await repository.createRecurrenceException({
    exceptionType: "CANCELLED",
    occurrence: {
      date: "2026-07-13",
      key: "series-1:2026-07-13:08:00",
      startTime: "08:00",
    },
    reason: "feriado",
    requestedBy: "admin-1",
    seriesId: "series-1",
  });

  assert.equal(result.exceptionType, "CANCELLED");
  assert.equal(result.occurrenceKey, "series-1:2026-07-13:08:00");
  assert.equal(calls[1].sql, INSERT_RECURRENCE_EXCEPTION_SQL);
  assert.equal(calls[3].sql, INSERT_RECURRENCE_HISTORY_SQL);
});

function createAgendaItemRow(overrides = {}) {
  return {
    cancelled_at: null,
    cancelled_by: null,
    class_id: 7,
    class_link_id: "link-1",
    created_at: "2026-07-02 10:00:00",
    created_by: "admin-1",
    day_of_week: "segunda",
    end_time: "09:00",
    enrollment_id: "enr-1",
    id: "agenda-1",
    idempotency_key: "enrollment:enr-1:class:7:weekly:segunda:08:00:",
    metadata_json: "{}",
    recurrence_type: "WEEKLY",
    source: "ENROLLMENT_INITIAL",
    start_time: "08:00",
    status: "ACTIVE",
    student_person_id: "person-1",
    student_profile_id: "profile-1",
    timezone: "America/Sao_Paulo",
    updated_at: "2026-07-02 10:00:00",
    ...overrides,
  };
}

function createRecurrenceSeriesRow(overrides = {}) {
  return {
    agenda_item_id: "agenda-1",
    cancel_reason: null,
    cancelled_at: null,
    cancelled_by: null,
    class_id: 7,
    class_link_id: "link-1",
    court_id: "court-1",
    court_name: "Quadra 1",
    created_at: "2026-07-03 10:00:00",
    created_by: "admin-1",
    days_of_week_json: "[1,3]",
    end_date: "2026-08-31",
    end_time: "09:00",
    enrollment_id: "enr-1",
    frequency: "WEEKLY",
    id: "series-1",
    idempotency_key: "agenda-recurrence:key",
    interval_unit: "WEEK",
    interval_value: 1,
    max_occurrences: 10,
    metadata_json: "{}",
    parent_series_id: null,
    professor_id: "prof-1",
    professor_name: "Professor",
    source: "AGENDA_ADMIN",
    start_date: "2026-07-06",
    start_time: "08:00",
    status: "ACTIVE",
    student_person_id: "person-1",
    student_profile_id: "profile-1",
    timezone: "America/Sao_Paulo",
    updated_at: "2026-07-03 10:00:00",
    updated_by: "admin-1",
    ...overrides,
  };
}

function createRecurrenceExceptionRow(overrides = {}) {
  return {
    created_at: "2026-07-03 10:00:00",
    created_by: "admin-1",
    exception_type: "CANCELLED",
    id: "exception-1",
    occurrence_date: "2026-07-13",
    occurrence_key: "series-1:2026-07-13:08:00",
    occurrence_start_time: "08:00",
    override_json: "{}",
    reason: "feriado",
    series_id: "series-1",
    ...overrides,
  };
}
