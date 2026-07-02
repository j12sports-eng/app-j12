const { randomUUID } = require("node:crypto");

const { pool } = require("./backend/src/config/db.js");
const { EnrollmentApplicationService } = require("./backend/src/domains/enrollments/application/services/enrollment-application.service.js");
const { MySqlEnrollmentRepository } = require("./backend/src/domains/enrollments/infrastructure/repositories/mysql-enrollment.repository.js");

const CONFIRMED_AT_INPUT = "2026-06-29T20:30:00.000Z";
const CONFIRMED_AT_EXPECTED = "2026-06-29 20:30:00";
const CONFIRMED_BY = "sprint-9-34-smoke";

async function main() {
  const connection = await pool.getConnection();
  const personId = `s934-person-${randomUUID()}`.slice(0, 64);
  const profileId = `s934-profile-${randomUUID()}`.slice(0, 64);
  const enrollmentId = `s934-enrollment-${randomUUID()}`.slice(0, 64);

  try {
    await assertConfirmationColumns(connection);

    const watchedTables = await readWatchedTables(connection);
    const beforeCounts = await readCounts(connection, watchedTables);

    await connection.beginTransaction();

    try {
      await connection.execute(
        `
          INSERT INTO people (id, nome, email, ativo)
          VALUES (?, ?, ?, 1)
        `,
        [personId, "Sprint 9.34 Smoke Student", `${personId}@example.invalid`],
      );

      await connection.execute(
        `
          INSERT INTO person_profiles (id, person_id, profile_type, status)
          VALUES (?, ?, 'student', 'ativo')
        `,
        [profileId, personId],
      );

      const repository = new MySqlEnrollmentRepository({
        logger: silentLogger,
        queryRunner: (sql, params = []) => connection.execute(sql, params),
      });
      const service = new EnrollmentApplicationService({ enrollmentRepository: repository });

      const draftResult = await service.createDraftEnrollmentIdempotently({
        id: enrollmentId,
        startDate: "2026-06-29",
        studentPersonId: personId,
        studentProfileId: profileId,
      });

      assert(draftResult.created === true, "Draft enrollment was not created.");
      assert(draftResult.draftEnrollment?.status === "DRAFT", "Draft enrollment was not persisted as DRAFT.");

      const confirmationResult = await service.confirmDraftEnrollment({
        confirmedAt: CONFIRMED_AT_INPUT,
        confirmedBy: CONFIRMED_BY,
        enrollmentId,
      });

      assert(confirmationResult.confirmed === true, "Draft enrollment was not confirmed.");
      assert(confirmationResult.status === "ACTIVE", "Confirmation result status is not ACTIVE.");

      const [rows] = await connection.execute(
        `
          SELECT
            status,
            DATE_FORMAT(confirmed_at, '%Y-%m-%d %H:%i:%s') AS confirmed_at,
            confirmed_by
          FROM enrollments
          WHERE id = ?
          LIMIT 1
        `,
        [enrollmentId],
      );
      const row = rows[0];

      assert(row, "Confirmed enrollment row was not found.");
      assert(row.status === "ACTIVE", "Persisted enrollment status is not ACTIVE.");
      assert(row.confirmed_at === CONFIRMED_AT_EXPECTED, "confirmed_at was not persisted.");
      assert(row.confirmed_by === CONFIRMED_BY, "confirmed_by was not persisted.");
    } finally {
      await connection.rollback();
    }

    const afterCounts = await readCounts(connection, watchedTables);
    assert(equalCounts(beforeCounts, afterCounts), "Financial/class watched tables changed.");

    const leftovers = await readLeftovers(connection, { enrollmentId, personId, profileId });
    assert(leftovers.total === 0, "Smoke test data was left in the database.");

    console.log("CONFIRMATION_AUDIT_COLUMNS_CREATED=true");
    console.log("DRAFT_CAN_BE_CONFIRMED_WITH_AUDIT=true");
    console.log("CONFIRMED_AT_PERSISTED=true");
    console.log("CONFIRMED_BY_PERSISTED=true");
    console.log("NO_FINANCIAL_SIDE_EFFECTS=true");
    console.log("NO_CLASS_SIDE_EFFECTS=true");
    console.log("NO_TEST_DATA_LEFT=true");
  } finally {
    connection.release();
    await pool.end();
  }
}

async function assertConfirmationColumns(connection) {
  const [rows] = await connection.execute(
    `
      SELECT COLUMN_NAME, COLUMN_TYPE
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'enrollments'
        AND COLUMN_NAME IN ('confirmed_at', 'confirmed_by')
    `,
  );
  const byName = new Map(rows.map((row) => [row.COLUMN_NAME, String(row.COLUMN_TYPE).toLowerCase()]));

  assert(byName.get("confirmed_at") === "datetime", "confirmed_at column is missing or incompatible.");
  assert(byName.get("confirmed_by") === "varchar(191)", "confirmed_by column is missing or incompatible.");
}

async function readWatchedTables(connection) {
  const [rows] = await connection.execute(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
        AND (
          LOWER(table_name) LIKE '%finance%'
          OR LOWER(table_name) LIKE '%financ%'
          OR LOWER(table_name) LIKE '%mensal%'
          OR LOWER(table_name) LIKE '%turma%'
          OR LOWER(table_name) LIKE '%class%'
        )
      ORDER BY table_name
    `,
  );

  return rows.map((row) => row.table_name).filter(isSafeIdentifier);
}

async function readCounts(connection, tables) {
  const counts = {};

  for (const table of tables) {
    const [rows] = await connection.execute(`SELECT COUNT(*) AS total FROM \`${table}\``);
    counts[table] = Number(rows[0]?.total ?? 0);
  }

  return counts;
}

async function readLeftovers(connection, { enrollmentId, personId, profileId }) {
  const [rows] = await connection.execute(
    `
      SELECT
        (SELECT COUNT(*) FROM enrollments WHERE id = ?) AS enrollments,
        (SELECT COUNT(*) FROM person_profiles WHERE id = ?) AS person_profiles,
        (SELECT COUNT(*) FROM people WHERE id = ?) AS people
    `,
    [enrollmentId, profileId, personId],
  );
  const row = rows[0] || {};

  return {
    enrollments: Number(row.enrollments ?? 0),
    people: Number(row.people ?? 0),
    personProfiles: Number(row.person_profiles ?? 0),
    total: Number(row.enrollments ?? 0) + Number(row.person_profiles ?? 0) + Number(row.people ?? 0),
  };
}

function equalCounts(left, right) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

  for (const key of keys) {
    if (left[key] !== right[key]) {
      return false;
    }
  }

  return true;
}

function isSafeIdentifier(value) {
  return /^[a-zA-Z0-9_]+$/.test(String(value ?? ""));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const silentLogger = Object.freeze({
  error() {},
  info() {},
  warn() {},
});

main().catch(async (error) => {
  console.error(error);
  try {
    await pool.end();
  } catch {
    // Ignore pool shutdown errors from a failing smoke test.
  }
  process.exit(1);
});
