const assert = require("node:assert/strict");
const test = require("node:test");

const {
  INSERT_INITIAL_AGENDA_ITEM_SQL,
  MySqlAgendaRepository,
  SELECT_AGENDA_ITEMS_BY_IDEMPOTENCY_KEYS_SQL_PREFIX,
  SELECT_SCHEDULES_BY_CLASS_SQL,
  SELECT_SCHEDULES_BY_ENROLLMENT_SQL,
  SELECT_SCHEDULES_BY_STUDENT_SQL,
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
    SELECT_AGENDA_ITEMS_BY_IDEMPOTENCY_KEYS_SQL_PREFIX,
  ].join("\n");

  assert.match(sqlText, /enrollment_agenda_items/);
  assert.doesNotMatch(sqlText, /\b(student_presencas|j12_presencas|financeiro|notificacoes)\b/i);
  assert.doesNotMatch(sqlText, /\b(ALTER|DROP|TRUNCATE)\b/i);
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
