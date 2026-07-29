#!/usr/bin/env node

/**
 * Sprint 29.1F.4C.2A - Add the nullable unit ownership foundation to Enrollments.
 *
 * Manual execution only. This migration intentionally performs no backfill,
 * creates no foreign key and preserves the global active DRAFT unique index.
 *
 * Usage:
 *   node backend/src/database/migrations/20260729120000_add_enrollment_unit_ownership_to_enrollments.js status
 *   node backend/src/database/migrations/20260729120000_add_enrollment_unit_ownership_to_enrollments.js up
 *   node backend/src/database/migrations/20260729120000_add_enrollment_unit_ownership_to_enrollments.js down
 */

let dbModule = null;

function getDb() {
  if (!dbModule) dbModule = require("../../config/db.js");
  return dbModule;
}

function dbQuery(sql, params) {
  return getDb().query(sql, params);
}

function dbTableExists(tableName) {
  return getDb().tableExists(tableName);
}

const TABLE_NAME = "enrollments";
const UNIT_ID_COLUMN = "unit_id";
const SUPPORT_INDEX_NAME = "idx_enrollments_unit_student_status";
const EXPECTED_SUPPORT_INDEX_COLUMNS = Object.freeze([
  UNIT_ID_COLUMN,
  "student_person_id",
  "student_profile_id",
  "status",
  "deleted_at",
]);
const REQUIRED_BASE_COLUMNS = Object.freeze([
  "student_person_id",
  "student_profile_id",
  "status",
  "deleted_at",
]);

const ADD_UNIT_ID_COLUMN_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD COLUMN ${UNIT_ID_COLUMN} BIGINT NULL
    AFTER student_profile_id
`;

const ADD_SUPPORT_INDEX_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD INDEX ${SUPPORT_INDEX_NAME} (
      ${EXPECTED_SUPPORT_INDEX_COLUMNS.join(",\n      ")}
    )
`;

const DROP_SUPPORT_INDEX_SQL = `
  ALTER TABLE ${TABLE_NAME}
    DROP INDEX ${SUPPORT_INDEX_NAME}
`;

const DROP_UNIT_ID_COLUMN_SQL = `
  ALTER TABLE ${TABLE_NAME}
    DROP COLUMN ${UNIT_ID_COLUMN}
`;

async function up() {
  await assertEnrollmentsTableExists();

  const [baseColumns, unitColumn, supportIndex] = await Promise.all([
    readColumns(REQUIRED_BASE_COLUMNS),
    readColumn(UNIT_ID_COLUMN),
    readIndex(SUPPORT_INDEX_NAME),
  ]);

  assertRequiredBaseColumns(baseColumns);
  if (unitColumn) assertCompatibleUnitColumn(unitColumn);
  if (supportIndex) assertCompatibleSupportIndex(supportIndex);

  if (!unitColumn) {
    await dbQuery(ADD_UNIT_ID_COLUMN_SQL);
    console.log(`CREATED_COLUMN=${TABLE_NAME}.${UNIT_ID_COLUMN}`);
  } else {
    console.log(`SKIP_COLUMN_EXISTS=${TABLE_NAME}.${UNIT_ID_COLUMN}`);
  }

  if (!supportIndex) {
    await dbQuery(ADD_SUPPORT_INDEX_SQL);
    console.log(`CREATED_INDEX=${TABLE_NAME}.${SUPPORT_INDEX_NAME}`);
  } else {
    console.log(`SKIP_INDEX_EXISTS=${TABLE_NAME}.${SUPPORT_INDEX_NAME}`);
  }

  const state = await readState();
  assertCompatibleUnitColumn(state.unitColumn);
  assertCompatibleSupportIndex(state.supportIndex);
  printState(state);
  console.log("ENROLLMENT_UNIT_OWNERSHIP_SCHEMA_PREPARED=true");

  return state;
}

async function down() {
  await assertEnrollmentsTableExists();

  const [unitColumn, indexes, foreignKeys, generatedColumns] = await Promise.all([
    readColumn(UNIT_ID_COLUMN),
    readIndexesDependingOnUnit(),
    readForeignKeysDependingOnUnit(),
    readGeneratedColumnsDependingOnUnit(),
  ]);

  if (unitColumn) assertCompatibleUnitColumn(unitColumn);
  assertSafeDownDependencies({ foreignKeys, generatedColumns, indexes });

  const supportIndex = indexes.find((index) => index.name === SUPPORT_INDEX_NAME) ?? null;

  if (supportIndex) {
    await dbQuery(DROP_SUPPORT_INDEX_SQL);
    console.log(`DROPPED_INDEX=${TABLE_NAME}.${SUPPORT_INDEX_NAME}`);
  } else {
    console.log(`SKIP_INDEX_MISSING=${TABLE_NAME}.${SUPPORT_INDEX_NAME}`);
  }

  if (unitColumn) {
    await dbQuery(DROP_UNIT_ID_COLUMN_SQL);
    console.log(`DROPPED_COLUMN=${TABLE_NAME}.${UNIT_ID_COLUMN}`);
  } else {
    console.log(`SKIP_COLUMN_MISSING=${TABLE_NAME}.${UNIT_ID_COLUMN}`);
  }

  const state = await readState();
  printState(state);
  console.log("ENROLLMENT_UNIT_OWNERSHIP_SCHEMA_REMOVED=true");

  return state;
}

async function status() {
  await assertEnrollmentsTableExists();
  const state = await readState();

  if (state.unitColumn) assertCompatibleUnitColumn(state.unitColumn);
  if (state.supportIndex) assertCompatibleSupportIndex(state.supportIndex);

  printState(state);
  console.log(`UNIT_ID_COLUMN_READY=${Boolean(state.unitColumn)}`);
  console.log(`UNIT_SUPPORT_INDEX_READY=${Boolean(state.supportIndex)}`);

  return state;
}

async function assertEnrollmentsTableExists() {
  if (!(await dbTableExists(TABLE_NAME))) {
    throw migrationError(
      `Required table ${TABLE_NAME} does not exist.`,
      "ENROLLMENT_UNIT_OWNERSHIP_TABLE_MISSING",
    );
  }
}

function assertRequiredBaseColumns(columns) {
  const existing = new Set(columns.map((column) => readField(column, "COLUMN_NAME")));
  const missing = REQUIRED_BASE_COLUMNS.filter((columnName) => !existing.has(columnName));

  if (missing.length > 0) {
    throw migrationError(
      `Missing required ${TABLE_NAME} column(s): ${missing.join(", ")}.`,
      "ENROLLMENT_UNIT_OWNERSHIP_BASE_SCHEMA_INCOMPATIBLE",
      { missingColumns: missing },
    );
  }
}

function assertCompatibleUnitColumn(column) {
  if (!column) {
    throw migrationError(
      `Missing required column ${TABLE_NAME}.${UNIT_ID_COLUMN}.`,
      "ENROLLMENT_UNIT_OWNERSHIP_COLUMN_MISSING",
    );
  }

  const columnType = String(readField(column, "COLUMN_TYPE") ?? "").toLowerCase();
  const dataType = String(readField(column, "DATA_TYPE") ?? "").toLowerCase();
  const nullable = String(readField(column, "IS_NULLABLE") ?? "").toUpperCase();
  const columnDefault = readField(column, "COLUMN_DEFAULT");
  const extra = String(readField(column, "EXTRA") ?? "").trim();
  const signedBigInt =
    dataType === "bigint" &&
    /^bigint(?:\(\d+\))?$/u.test(columnType) &&
    !columnType.includes("unsigned");

  if (!signedBigInt || nullable !== "YES" || columnDefault !== null || extra.length > 0) {
    throw migrationError(
      `Incompatible ${TABLE_NAME}.${UNIT_ID_COLUMN}: type=${columnType || "<unknown>"}; nullable=${nullable || "<unknown>"}; default=${String(columnDefault)}; extra=${extra || "<none>"}. Expected signed BIGINT NULL without default or generated attributes.`,
      "ENROLLMENT_UNIT_OWNERSHIP_COLUMN_INCOMPATIBLE",
      {
        columnDefault,
        columnType,
        dataType,
        extra,
        nullable,
      },
    );
  }
}

function assertCompatibleSupportIndex(index) {
  const actualColumns = Array.isArray(index?.columns) ? index.columns : [];
  const nonUnique = Number(index?.nonUnique);

  if (nonUnique !== 1 || actualColumns.join(",") !== EXPECTED_SUPPORT_INDEX_COLUMNS.join(",")) {
    throw migrationError(
      `Incompatible ${TABLE_NAME}.${SUPPORT_INDEX_NAME}: NON_UNIQUE=${String(index?.nonUnique)}; columns=${actualColumns.join(",") || "<none>"}. Expected non-unique index (${EXPECTED_SUPPORT_INDEX_COLUMNS.join(",")}).`,
      "ENROLLMENT_UNIT_OWNERSHIP_INDEX_INCOMPATIBLE",
      {
        actualColumns,
        expectedColumns: [...EXPECTED_SUPPORT_INDEX_COLUMNS],
        nonUnique: index?.nonUnique ?? null,
      },
    );
  }
}

function assertSafeDownDependencies({ foreignKeys = [], generatedColumns = [], indexes = [] }) {
  const unexpectedIndexes = indexes.filter((index) => {
    if (index.name !== SUPPORT_INDEX_NAME) return true;
    assertCompatibleSupportIndex(index);
    return false;
  });

  if (unexpectedIndexes.length > 0 || foreignKeys.length > 0 || generatedColumns.length > 0) {
    throw migrationError(
      `Refusing to drop ${TABLE_NAME}.${UNIT_ID_COLUMN}: unexpected dependent structures exist.`,
      "ENROLLMENT_UNIT_OWNERSHIP_ROLLBACK_BLOCKED",
      {
        foreignKeys: foreignKeys.map((item) => item.name),
        generatedColumns: generatedColumns.map((item) => item.name),
        indexes: unexpectedIndexes.map((item) => item.name),
      },
    );
  }
}

async function readState() {
  const [unitColumn, supportIndex, foreignKeys, generatedColumns] = await Promise.all([
    readColumn(UNIT_ID_COLUMN),
    readIndex(SUPPORT_INDEX_NAME),
    readForeignKeysDependingOnUnit(),
    readGeneratedColumnsDependingOnUnit(),
  ]);

  return {
    foreignKeys,
    generatedColumns,
    supportIndex,
    unitColumn,
  };
}

async function readColumn(columnName) {
  const columns = await readColumns([columnName]);
  return columns[0] ?? null;
}

async function readColumns(columnNames) {
  if (!Array.isArray(columnNames) || columnNames.length === 0) return [];
  const placeholders = columnNames.map(() => "?").join(", ");

  return dbQuery(
    `
      SELECT
        COLUMN_NAME,
        COLUMN_TYPE,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        EXTRA,
        GENERATION_EXPRESSION
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND COLUMN_NAME IN (${placeholders})
      ORDER BY ORDINAL_POSITION
    `,
    [TABLE_NAME, ...columnNames],
  );
}

async function readIndex(indexName) {
  const indexes = await readIndexes();
  return indexes.find((index) => index.name === indexName) ?? null;
}

async function readIndexesDependingOnUnit() {
  const indexes = await readIndexes();
  return indexes.filter((index) => index.columns.includes(UNIT_ID_COLUMN));
}

async function readIndexes() {
  const rows = await dbQuery(
    `
      SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `,
    [TABLE_NAME],
  );
  const grouped = new Map();

  for (const row of rows) {
    const name = String(readField(row, "INDEX_NAME") ?? "");
    if (!name) continue;
    const entry = grouped.get(name) || {
      columns: [],
      name,
      nonUnique: Number(readField(row, "NON_UNIQUE")),
    };
    entry.columns.push({
      name: String(readField(row, "COLUMN_NAME") ?? ""),
      sequence: Number(readField(row, "SEQ_IN_INDEX")),
    });
    grouped.set(name, entry);
  }

  return [...grouped.values()].map((index) => ({
    columns: index.columns
      .sort((left, right) => left.sequence - right.sequence)
      .map((column) => column.name),
    name: index.name,
    nonUnique: index.nonUnique,
  }));
}

async function readForeignKeysDependingOnUnit() {
  const rows = await dbQuery(
    `
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.key_column_usage
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION
    `,
    [TABLE_NAME, UNIT_ID_COLUMN],
  );

  return rows.map((row) => ({
    column: readField(row, "COLUMN_NAME") ?? null,
    name: readField(row, "CONSTRAINT_NAME") ?? null,
    referencedColumn: readField(row, "REFERENCED_COLUMN_NAME") ?? null,
    referencedTable: readField(row, "REFERENCED_TABLE_NAME") ?? null,
  }));
}

async function readGeneratedColumnsDependingOnUnit() {
  const rows = await dbQuery(
    `
      SELECT COLUMN_NAME, GENERATION_EXPRESSION
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND COLUMN_NAME <> ?
        AND GENERATION_EXPRESSION IS NOT NULL
        AND GENERATION_EXPRESSION <> ''
      ORDER BY ORDINAL_POSITION
    `,
    [TABLE_NAME, UNIT_ID_COLUMN],
  );

  return rows
    .filter((row) =>
      String(readField(row, "GENERATION_EXPRESSION") ?? "")
        .toLowerCase()
        .includes(UNIT_ID_COLUMN),
    )
    .map((row) => ({
      expression: readField(row, "GENERATION_EXPRESSION") ?? null,
      name: readField(row, "COLUMN_NAME") ?? null,
    }));
}

function readField(row, field) {
  if (!row || typeof row !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(row, field)) return row[field];
  return row[field.toLowerCase()];
}

function printState(state) {
  console.log(JSON.stringify(state, null, 2));
}

function migrationError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

async function main() {
  const command = process.argv[2] || "status";

  if (command === "up") return up();
  if (command === "down") return down();
  if (command === "status") return status();

  throw new Error(`Unknown command: ${command}. Use status, up or down.`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (dbModule?.pool && typeof dbModule.pool.end === "function") {
        await dbModule.pool.end();
      }
    });
}

module.exports = {
  ADD_SUPPORT_INDEX_SQL,
  ADD_UNIT_ID_COLUMN_SQL,
  DROP_SUPPORT_INDEX_SQL,
  DROP_UNIT_ID_COLUMN_SQL,
  EXPECTED_SUPPORT_INDEX_COLUMNS,
  SUPPORT_INDEX_NAME,
  TABLE_NAME,
  UNIT_ID_COLUMN,
  down,
  status,
  up,
};
