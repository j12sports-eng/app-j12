#!/usr/bin/env node

/**
 * Sprint 9.30 - Add physical protection against duplicated active DRAFT
 * enrollments for the same student/profile pair.
 *
 * Manual execution only. Do not run from build, startup or deploy scripts.
 *
 * Usage:
 *   node backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js status
 *   node backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js up
 *   node backend/src/database/migrations/20260629190607_add_active_draft_unique_constraint_to_enrollments.js down
 */

const { pool, query, tableExists } = require("../../config/db.js");

const TABLE_NAME = "enrollments";
const ACTIVE_DRAFT_STUDENT_PERSON_COLUMN = "active_draft_student_person_id";
const ACTIVE_DRAFT_STUDENT_PROFILE_COLUMN = "active_draft_student_profile_id";
const ACTIVE_DRAFT_UNIQUE_INDEX = "ux_enrollments_active_draft_student_profile";

const REQUIRED_COLUMNS = {
  deleted_at: "datetime",
  status: "varchar(32)",
  student_person_id: "varchar(64)",
  student_profile_id: "varchar(64)",
};

const ADD_ACTIVE_DRAFT_STUDENT_PERSON_COLUMN_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD COLUMN ${ACTIVE_DRAFT_STUDENT_PERSON_COLUMN} VARCHAR(64)
      GENERATED ALWAYS AS (
        CASE
          WHEN status = 'DRAFT' AND deleted_at IS NULL THEN student_person_id
          ELSE NULL
        END
      ) VIRTUAL
`;

const ADD_ACTIVE_DRAFT_STUDENT_PROFILE_COLUMN_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD COLUMN ${ACTIVE_DRAFT_STUDENT_PROFILE_COLUMN} VARCHAR(64)
      GENERATED ALWAYS AS (
        CASE
          WHEN status = 'DRAFT' AND deleted_at IS NULL THEN student_profile_id
          ELSE NULL
        END
      ) VIRTUAL
`;

const ADD_ACTIVE_DRAFT_UNIQUE_INDEX_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD UNIQUE INDEX ${ACTIVE_DRAFT_UNIQUE_INDEX} (
      ${ACTIVE_DRAFT_STUDENT_PERSON_COLUMN},
      ${ACTIVE_DRAFT_STUDENT_PROFILE_COLUMN}
    )
`;

const DROP_ACTIVE_DRAFT_UNIQUE_INDEX_SQL = `
  ALTER TABLE ${TABLE_NAME}
    DROP INDEX ${ACTIVE_DRAFT_UNIQUE_INDEX}
`;

const DROP_ACTIVE_DRAFT_STUDENT_PROFILE_COLUMN_SQL = `
  ALTER TABLE ${TABLE_NAME}
    DROP COLUMN ${ACTIVE_DRAFT_STUDENT_PROFILE_COLUMN}
`;

const DROP_ACTIVE_DRAFT_STUDENT_PERSON_COLUMN_SQL = `
  ALTER TABLE ${TABLE_NAME}
    DROP COLUMN ${ACTIVE_DRAFT_STUDENT_PERSON_COLUMN}
`;

async function up() {
  await assertTableReady();
  await assertNoDuplicateDrafts();
  await addGeneratedColumnIfMissing(
    ACTIVE_DRAFT_STUDENT_PERSON_COLUMN,
    ADD_ACTIVE_DRAFT_STUDENT_PERSON_COLUMN_SQL,
  );
  await addGeneratedColumnIfMissing(
    ACTIVE_DRAFT_STUDENT_PROFILE_COLUMN,
    ADD_ACTIVE_DRAFT_STUDENT_PROFILE_COLUMN_SQL,
  );
  await addUniqueIndexIfMissing();

  const state = await readState();
  printState(state);
  console.log("DRAFT_UNIQUE_CONSTRAINT_CREATED=true");
}

async function down() {
  await assertEnrollmentsTableExists();
  await dropUniqueIndexIfExists();
  await dropGeneratedColumnIfExists(
    ACTIVE_DRAFT_STUDENT_PROFILE_COLUMN,
    DROP_ACTIVE_DRAFT_STUDENT_PROFILE_COLUMN_SQL,
  );
  await dropGeneratedColumnIfExists(
    ACTIVE_DRAFT_STUDENT_PERSON_COLUMN,
    DROP_ACTIVE_DRAFT_STUDENT_PERSON_COLUMN_SQL,
  );

  const state = await readState();
  printState(state);
}

async function status() {
  await assertEnrollmentsTableExists();
  const duplicateCount = await countDuplicateDraftGroups();
  const state = await readState();
  printState(state);
  console.log(`NO_DUPLICATE_DRAFTS_FOUND=${duplicateCount === 0}`);
}

async function assertTableReady() {
  await assertEnrollmentsTableExists();
  const columns = await readColumns(Object.keys(REQUIRED_COLUMNS));
  const byName = new Map(columns.map((column) => [column.COLUMN_NAME, column]));

  for (const [columnName, expectedType] of Object.entries(REQUIRED_COLUMNS)) {
    const column = byName.get(columnName);

    if (!column) {
      throw new Error(`Missing required column ${TABLE_NAME}.${columnName}.`);
    }

    if (String(column.COLUMN_TYPE).toLowerCase() !== expectedType) {
      throw new Error(
        `Unexpected type for ${TABLE_NAME}.${columnName}: ${column.COLUMN_TYPE}; expected ${expectedType}.`,
      );
    }
  }
}

async function assertEnrollmentsTableExists() {
  const exists = await tableExists(TABLE_NAME);

  if (!exists) {
    throw new Error(`Required table ${TABLE_NAME} does not exist.`);
  }
}

async function assertNoDuplicateDrafts() {
  const duplicateCount = await countDuplicateDraftGroups();

  if (duplicateCount > 0) {
    throw new Error(
      `Cannot apply ${ACTIVE_DRAFT_UNIQUE_INDEX}: found ${duplicateCount} duplicated active DRAFT group(s).`,
    );
  }
}

async function countDuplicateDraftGroups() {
  const rows = await query(`
    SELECT COUNT(*) AS total
    FROM (
      SELECT student_person_id, student_profile_id
      FROM ${TABLE_NAME}
      WHERE status = 'DRAFT'
        AND deleted_at IS NULL
      GROUP BY student_person_id, student_profile_id
      HAVING COUNT(*) > 1
    ) duplicated_drafts
  `);

  return Number(rows[0]?.total ?? 0);
}

async function addGeneratedColumnIfMissing(columnName, sql) {
  const column = await readColumn(columnName);

  if (column) {
    console.log(`SKIP_COLUMN_EXISTS=${columnName}`);
    return;
  }

  await query(sql);
  console.log(`CREATED_COLUMN=${columnName}`);
}

async function dropGeneratedColumnIfExists(columnName, sql) {
  const column = await readColumn(columnName);

  if (!column) {
    console.log(`SKIP_COLUMN_MISSING=${columnName}`);
    return;
  }

  await query(sql);
  console.log(`DROPPED_COLUMN=${columnName}`);
}

async function addUniqueIndexIfMissing() {
  const index = await readIndex(ACTIVE_DRAFT_UNIQUE_INDEX);

  if (index) {
    validateUniqueIndex(index);
    console.log(`SKIP_INDEX_EXISTS=${ACTIVE_DRAFT_UNIQUE_INDEX}`);
    return;
  }

  await query(ADD_ACTIVE_DRAFT_UNIQUE_INDEX_SQL);
  console.log(`CREATED_INDEX=${ACTIVE_DRAFT_UNIQUE_INDEX}`);
}

async function dropUniqueIndexIfExists() {
  const index = await readIndex(ACTIVE_DRAFT_UNIQUE_INDEX);

  if (!index) {
    console.log(`SKIP_INDEX_MISSING=${ACTIVE_DRAFT_UNIQUE_INDEX}`);
    return;
  }

  await query(DROP_ACTIVE_DRAFT_UNIQUE_INDEX_SQL);
  console.log(`DROPPED_INDEX=${ACTIVE_DRAFT_UNIQUE_INDEX}`);
}

function validateUniqueIndex(index) {
  const expectedColumns = `${ACTIVE_DRAFT_STUDENT_PERSON_COLUMN},${ACTIVE_DRAFT_STUDENT_PROFILE_COLUMN}`;
  const columns = String(index.columns ?? "");
  const nonUnique = Number(index.NON_UNIQUE);

  if (nonUnique !== 0 || columns !== expectedColumns) {
    throw new Error(
      `Existing index ${ACTIVE_DRAFT_UNIQUE_INDEX} is not compatible. NON_UNIQUE=${index.NON_UNIQUE}; columns=${columns}.`,
    );
  }
}

async function readState() {
  const [versionRows, generatedColumns, uniqueIndexRows, duplicateDraftRows] = await Promise.all([
    query("SELECT VERSION() AS version, @@version_comment AS versionComment"),
    readColumns([
      ACTIVE_DRAFT_STUDENT_PERSON_COLUMN,
      ACTIVE_DRAFT_STUDENT_PROFILE_COLUMN,
    ]),
    readIndexes([ACTIVE_DRAFT_UNIQUE_INDEX]),
    query(`
      SELECT student_person_id, student_profile_id, COUNT(*) AS total
      FROM ${TABLE_NAME}
      WHERE status = 'DRAFT'
        AND deleted_at IS NULL
      GROUP BY student_person_id, student_profile_id
      HAVING COUNT(*) > 1
      LIMIT 5
    `),
  ]);

  return {
    duplicateDraftGroups: duplicateDraftRows,
    generatedColumns,
    uniqueIndexes: uniqueIndexRows,
    version: versionRows[0]?.version ?? null,
    versionComment: versionRows[0]?.versionComment ?? null,
  };
}

function printState(state) {
  console.log(JSON.stringify(state, null, 2));
}

async function readColumn(columnName) {
  const rows = await readColumns([columnName]);
  return rows[0] ?? null;
}

async function readColumns(columnNames) {
  if (!Array.isArray(columnNames) || columnNames.length === 0) return [];

  const placeholders = columnNames.map(() => "?").join(", ");

  return query(`
    SELECT COLUMN_NAME, COLUMN_TYPE, EXTRA, GENERATION_EXPRESSION
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ?
      AND COLUMN_NAME IN (${placeholders})
    ORDER BY ORDINAL_POSITION
  `, [TABLE_NAME, ...columnNames]);
}

async function readIndex(indexName) {
  const rows = await readIndexes([indexName]);
  return rows[0] ?? null;
}

async function readIndexes(indexNames) {
  if (!Array.isArray(indexNames) || indexNames.length === 0) return [];

  const placeholders = indexNames.map(() => "?").join(", ");

  return query(`
    SELECT INDEX_NAME, NON_UNIQUE,
           GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = ?
      AND INDEX_NAME IN (${placeholders})
    GROUP BY INDEX_NAME, NON_UNIQUE
    ORDER BY INDEX_NAME
  `, [TABLE_NAME, ...indexNames]);
}

async function main() {
  const command = process.argv[2] || "status";

  if (command === "up") {
    await up();
    return;
  }

  if (command === "down") {
    await down();
    return;
  }

  if (command === "status") {
    await status();
    return;
  }

  throw new Error(`Unknown command: ${command}. Use status, up or down.`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (pool && typeof pool.end === "function") {
        await pool.end();
      }
      process.exit(process.exitCode || 0);
    });
}

module.exports = {
  ACTIVE_DRAFT_STUDENT_PERSON_COLUMN,
  ACTIVE_DRAFT_STUDENT_PROFILE_COLUMN,
  ACTIVE_DRAFT_UNIQUE_INDEX,
  ADD_ACTIVE_DRAFT_STUDENT_PERSON_COLUMN_SQL,
  ADD_ACTIVE_DRAFT_STUDENT_PROFILE_COLUMN_SQL,
  ADD_ACTIVE_DRAFT_UNIQUE_INDEX_SQL,
  DROP_ACTIVE_DRAFT_STUDENT_PERSON_COLUMN_SQL,
  DROP_ACTIVE_DRAFT_STUDENT_PROFILE_COLUMN_SQL,
  DROP_ACTIVE_DRAFT_UNIQUE_INDEX_SQL,
  countDuplicateDraftGroups,
  down,
  status,
  up,
};
