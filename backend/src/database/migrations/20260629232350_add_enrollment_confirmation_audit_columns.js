#!/usr/bin/env node

/**
 * Sprint 9.34 - Add confirmation audit columns to enrollments.
 *
 * Manual execution only. Do not run from build, startup or deploy scripts.
 *
 * Usage:
 *   node backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js status
 *   node backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js up
 *   node backend/src/database/migrations/20260629232350_add_enrollment_confirmation_audit_columns.js down
 */

const { pool, query, tableExists } = require("../../config/db.js");

const TABLE_NAME = "enrollments";
const CONFIRMED_AT_COLUMN = "confirmed_at";
const CONFIRMED_BY_COLUMN = "confirmed_by";

const REQUIRED_BASE_COLUMNS = Object.freeze({
  id: "varchar(64)",
  status: "varchar(32)",
  updated_at: "datetime",
});

const EXPECTED_COLUMNS = Object.freeze({
  [CONFIRMED_AT_COLUMN]: "datetime",
  [CONFIRMED_BY_COLUMN]: "varchar(191)",
});

const ADD_CONFIRMED_AT_COLUMN_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD COLUMN ${CONFIRMED_AT_COLUMN} DATETIME NULL AFTER end_date
`;

const ADD_CONFIRMED_BY_COLUMN_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD COLUMN ${CONFIRMED_BY_COLUMN} VARCHAR(191) NULL AFTER ${CONFIRMED_AT_COLUMN}
`;

const DROP_CONFIRMED_BY_COLUMN_SQL = `
  ALTER TABLE ${TABLE_NAME}
    DROP COLUMN ${CONFIRMED_BY_COLUMN}
`;

const DROP_CONFIRMED_AT_COLUMN_SQL = `
  ALTER TABLE ${TABLE_NAME}
    DROP COLUMN ${CONFIRMED_AT_COLUMN}
`;

async function up() {
  await assertTableReady();
  await addColumnIfMissing(CONFIRMED_AT_COLUMN, ADD_CONFIRMED_AT_COLUMN_SQL);
  await addColumnIfMissing(CONFIRMED_BY_COLUMN, ADD_CONFIRMED_BY_COLUMN_SQL);
  await assertConfirmationAuditColumns();

  const state = await readState();
  printState(state);
  console.log("CONFIRMATION_AUDIT_COLUMNS_CREATED=true");
}

async function down() {
  await assertEnrollmentsTableExists();
  await dropColumnIfExists(CONFIRMED_BY_COLUMN, DROP_CONFIRMED_BY_COLUMN_SQL);
  await dropColumnIfExists(CONFIRMED_AT_COLUMN, DROP_CONFIRMED_AT_COLUMN_SQL);

  const state = await readState();
  printState(state);
}

async function status() {
  await assertEnrollmentsTableExists();
  const state = await readState();
  printState(state);
  console.log(`CONFIRMATION_AUDIT_COLUMNS_CREATED=${hasConfirmationAuditColumns(state.columns)}`);
}

async function assertTableReady() {
  await assertEnrollmentsTableExists();
  const columns = await readColumns(Object.keys(REQUIRED_BASE_COLUMNS));
  const byName = new Map(columns.map((column) => [column.COLUMN_NAME, column]));

  for (const [columnName, expectedType] of Object.entries(REQUIRED_BASE_COLUMNS)) {
    const column = byName.get(columnName);

    if (!column) {
      throw new Error(`Missing required column ${TABLE_NAME}.${columnName}.`);
    }

    assertColumnType(column, expectedType);
  }
}

async function assertEnrollmentsTableExists() {
  const exists = await tableExists(TABLE_NAME);

  if (!exists) {
    throw new Error(`Missing required table ${TABLE_NAME}.`);
  }
}

async function addColumnIfMissing(columnName, sql) {
  const column = await readColumn(columnName);

  if (column) {
    assertColumnType(column, EXPECTED_COLUMNS[columnName]);
    console.log(`SKIP_COLUMN_EXISTS=${columnName}`);
    return;
  }

  await query(sql);
  console.log(`CREATED_COLUMN=${columnName}`);
}

async function dropColumnIfExists(columnName, sql) {
  const column = await readColumn(columnName);

  if (!column) {
    console.log(`SKIP_COLUMN_MISSING=${columnName}`);
    return;
  }

  await query(sql);
  console.log(`DROPPED_COLUMN=${columnName}`);
}

async function assertConfirmationAuditColumns() {
  const columns = await readColumns([CONFIRMED_AT_COLUMN, CONFIRMED_BY_COLUMN]);

  if (!hasConfirmationAuditColumns(columns)) {
    throw new Error("Confirmation audit columns were not created.");
  }
}

async function readState() {
  const [versionRows, columns] = await Promise.all([
    query("SELECT VERSION() AS version, @@version_comment AS versionComment"),
    readColumns([CONFIRMED_AT_COLUMN, CONFIRMED_BY_COLUMN]),
  ]);

  return {
    columns,
    version: versionRows[0]?.version ?? null,
    versionComment: versionRows[0]?.versionComment ?? null,
  };
}

function hasConfirmationAuditColumns(columns) {
  const byName = new Map((columns || []).map((column) => [column.COLUMN_NAME, column]));
  const confirmedAt = byName.get(CONFIRMED_AT_COLUMN);
  const confirmedBy = byName.get(CONFIRMED_BY_COLUMN);

  if (!confirmedAt || !confirmedBy) {
    return false;
  }

  assertColumnType(confirmedAt, EXPECTED_COLUMNS[CONFIRMED_AT_COLUMN]);
  assertColumnType(confirmedBy, EXPECTED_COLUMNS[CONFIRMED_BY_COLUMN]);
  return true;
}

function assertColumnType(column, expectedType) {
  const actualType = String(column?.COLUMN_TYPE ?? "").toLowerCase();

  if (actualType !== expectedType) {
    throw new Error(
      `Unexpected type for ${TABLE_NAME}.${column?.COLUMN_NAME}: ${column?.COLUMN_TYPE}; expected ${expectedType}.`,
    );
  }
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
    SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ?
      AND COLUMN_NAME IN (${placeholders})
    ORDER BY ORDINAL_POSITION
  `, [TABLE_NAME, ...columnNames]);
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
  ADD_CONFIRMED_AT_COLUMN_SQL,
  ADD_CONFIRMED_BY_COLUMN_SQL,
  CONFIRMED_AT_COLUMN,
  CONFIRMED_BY_COLUMN,
  DROP_CONFIRMED_AT_COLUMN_SQL,
  DROP_CONFIRMED_BY_COLUMN_SQL,
  down,
  status,
  up,
};
