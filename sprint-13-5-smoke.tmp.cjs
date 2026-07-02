const assert = require("node:assert/strict");

const { pool } = require("./backend/src/config/db.js");
const {
  AgendaApplicationService,
} = require("./backend/src/domains/agenda/application/services/agenda-application.service.js");
const {
  MySqlAgendaRepository,
} = require("./backend/src/domains/agenda/infrastructure/repositories/mysql-agenda.repository.js");

async function main() {
  const suffix = String(Date.now()).slice(-10);
  const personId = `s135_person_${suffix}`;
  const profileId = `s135_profile_${suffix}`;
  const enrollmentId = `s135_enroll_${suffix}`;
  const linkId = `s135_link_${suffix}`;
  const requestedBy = "sprint-13-5-smoke";
  let classId = null;
  let connection = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      "INSERT INTO people (id, nome, ativo) VALUES (?, ?, 1)",
      [personId, "Sprint 13.5 Smoke"],
    );
    await connection.execute(
      "INSERT INTO person_profiles (id, person_id, profile_type, status) VALUES (?, ?, 'aluno', 'ativo')",
      [profileId, personId],
    );
    await connection.execute(
      "INSERT INTO enrollments (id, student_person_id, student_profile_id, status, start_date, confirmed_at, confirmed_by) VALUES (?, ?, ?, 'ACTIVE', CURRENT_DATE, NOW(), ?)",
      [enrollmentId, personId, profileId, requestedBy],
    );
    const [classResult] = await connection.execute(
      "INSERT INTO j12_turmas (nome, dias_semana, dias_semana_json, horario, horario_inicio, horario_fim, status) VALUES (?, 'segunda/quarta', ?, '08:00', '08:00', '09:00', 'ativa')",
      [`Sprint 13.5 Smoke ${suffix}`, JSON.stringify(["segunda", "quarta"])],
    );
    classId = classResult.insertId;
    await connection.execute(
      "INSERT INTO enrollment_class_links (id, enrollment_id, class_id, status, linked_at, linked_by, origin) VALUES (?, ?, ?, 'ACTIVE', NOW(), ?, 'SMOKE')",
      [linkId, enrollmentId, classId, requestedBy],
    );

    const queryRunner = async (sql, params = []) => {
      const [rows] = await connection.execute(sql, params);
      return rows;
    };
    const agendaRepository = new MySqlAgendaRepository({ queryRunner });
    const service = new AgendaApplicationService({
      agendaRepository,
      classFacade: {
        async findActiveClassById(input = {}) {
          const [rows] = await connection.execute(
            "SELECT id, status FROM j12_turmas WHERE id = ? AND status = 'ativa' LIMIT 1",
            [input.classId],
          );
          return rows[0] || null;
        },
      },
      enrollmentFacade: {
        async findEnrollmentById(id) {
          const [rows] = await connection.execute(
            "SELECT id, student_person_id, student_profile_id, status FROM enrollments WHERE id = ? LIMIT 1",
            [id],
          );
          return rows[0] || null;
        },
      },
    });

    const created = await service.createInitialAgendaForEnrollment({
      enrollmentId,
      requestedBy,
    });

    assert.equal(created.agendaCreated, true);
    assert.equal(created.createdCount, 2);
    assert.equal(created.persistedAgendaCount, 2);
    assert.equal(created.noAttendanceCreated, true);
    assert.equal(created.noFinancialSideEffects, true);
    assert.equal(created.noNotificationSideEffects, true);

    const reused = await service.createInitialAgendaForEnrollment({
      enrollmentId,
      requestedBy,
    });

    assert.equal(reused.agendaCreated, false);
    assert.equal(reused.agendaReused, true);
    assert.equal(reused.reusedCount, 2);
    assert.equal(reused.duplicateAgendaReusedOrBlocked, true);

    await connection.rollback();
    connection.release();
    connection = null;

    const [agendaRows] = await pool.execute(
      "SELECT COUNT(*) AS total FROM enrollment_agenda_items WHERE enrollment_id = ?",
      [enrollmentId],
    );
    const [enrollmentRows] = await pool.execute(
      "SELECT COUNT(*) AS total FROM enrollments WHERE id = ?",
      [enrollmentId],
    );
    const [classRows] = await pool.execute(
      "SELECT COUNT(*) AS total FROM j12_turmas WHERE id = ?",
      [classId],
    );

    assert.equal(Number(agendaRows[0]?.total || 0), 0);
    assert.equal(Number(enrollmentRows[0]?.total || 0), 0);
    assert.equal(Number(classRows[0]?.total || 0), 0);

    console.log("INITIAL_ENROLLMENT_AGENDA_PERSISTENCE_ENABLED=true");
    console.log("ACTIVE_ENROLLMENT_AGENDA_CREATED=true");
    console.log("CLASS_SCHEDULES_USED=true");
    console.log("DUPLICATE_AGENDA_REUSED_OR_BLOCKED=true");
    console.log("NO_ATTENDANCE_CREATED=true");
    console.log("NO_FINANCIAL_SIDE_EFFECTS=true");
    console.log("NO_NOTIFICATION_SIDE_EFFECTS=true");
    console.log("NO_TEST_DATA_LEFT=true");
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
      connection.release();
    }
    throw error;
  } finally {
    await pool.end();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
