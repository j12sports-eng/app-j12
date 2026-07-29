#!/usr/bin/env node

/**
 * Sprint 29.2A - Add canonical physical integrity for Enrollment unit ownership.
 *
 * Manual execution only. This migration adds or removes only the foreign key;
 * the nullable unit_id column and its support index belong to the prior
 * ownership-foundation migration.
 *
 * Usage:
 *   node backend/src/database/migrations/20260729150000_add_enrollment_unit_foreign_key.js status
 *   node backend/src/database/migrations/20260729150000_add_enrollment_unit_foreign_key.js up
 *   node backend/src/database/migrations/20260729150000_add_enrollment_unit_foreign_key.js down
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
const UNIT_TABLE_NAME = "j12_unidades";
const UNIT_ID_COLUMN = "unit_id";
const REFERENCED_ID_COLUMN = "id";
const FOREIGN_KEY_NAME = "fk_enrollments_unit";

const ADD_FOREIGN_KEY_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT ${FOREIGN_KEY_NAME}
    FOREIGN KEY (${UNIT_ID_COLUMN})
    REFERENCES ${UNIT_TABLE_NAME} (${REFERENCED_ID_COLUMN})
`;

const DROP_FOREIGN_KEY_SQL = `
  ALTER TABLE ${TABLE_NAME}
    DROP FOREIGN KEY ${FOREIGN_KEY_NAME}
`;

async function up() {
  await assertRequiredTablesExist();
  const state = await readState();

  assertCompatibleSchema(state);
  const existing = resolveExistingForeignKey(state.foreignKeys);

  if (existing) {
    console.log(`SKIP_FOREIGN_KEY_EXISTS=${TABLE_NAME}.${existing.name}`);
    printState(state);
    console.log("ENROLLMENT_UNIT_FOREIGN_KEY_CREATED=true");
    return state;
  }

  await dbQuery(ADD_FOREIGN_KEY_SQL);
  console.log(`CREATED_FOREIGN_KEY=${TABLE_NAME}.${FOREIGN_KEY_NAME}`);

  const migratedState = await readState();
  assertCompatibleSchema(migratedState);
  assertCanonicalForeignKey(migratedState.foreignKeys);
  printState(migratedState);
  console.log("ENROLLMENT_UNIT_FOREIGN_KEY_CREATED=true");

  return migratedState;
}

async function down() {
  await assertRequiredTablesExist();
  const state = await readState();

  assertCompatibleSchema(state);
  const canonical = state.foreignKeys.find((foreignKey) => foreignKey.name === FOREIGN_KEY_NAME);

  if (!canonical) {
    console.log(`SKIP_FOREIGN_KEY_MISSING=${TABLE_NAME}.${FOREIGN_KEY_NAME}`);
    printState(state);
    console.log("ENROLLMENT_UNIT_FOREIGN_KEY_REMOVED=true");
    return state;
  }

  assertExpectedForeignKey(canonical);
  await dbQuery(DROP_FOREIGN_KEY_SQL);
  console.log(`DROPPED_FOREIGN_KEY=${TABLE_NAME}.${FOREIGN_KEY_NAME}`);

  const migratedState = await readState();
  if (migratedState.foreignKeys.some((foreignKey) => foreignKey.name === FOREIGN_KEY_NAME)) {
    throw migrationError(
      `Foreign key ${TABLE_NAME}.${FOREIGN_KEY_NAME} still exists after rollback.`,
      "ENROLLMENT_UNIT_FOREIGN_KEY_ROLLBACK_FAILED",
    );
  }
  printState(migratedState);
  console.log("ENROLLMENT_UNIT_FOREIGN_KEY_REMOVED=true");

  return migratedState;
}

async function status() {
  await assertRequiredTablesExist();
  const state = await readState();

  assertCompatibleSchema(state);
  const existing = resolveExistingForeignKey(state.foreignKeys);
  printState(state);
  console.log(`ENROLLMENT_UNIT_FOREIGN_KEY_READY=${Boolean(existing)}`);

  return state;
}

async function assertRequiredTablesExist() {
  for (const tableName of [TABLE_NAME, UNIT_TABLE_NAME]) {
    if (!(await dbTableExists(tableName))) {
      throw migrationError(
        `Required table ${tableName} does not exist.`,
        "ENROLLMENT_UNIT_FOREIGN_KEY_TABLE_MISSING",
        { tableName },
      );
    }
  }
}

function assertCompatibleSchema(state) {
  assertCompatibleColumn(state.unitColumn, {
    columnName: UNIT_ID_COLUMN,
    nullable: "YES",
    tableName: TABLE_NAME,
  });
  assertCompatibleColumn(state.referencedColumn, {
    columnName: REFERENCED_ID_COLUMN,
    nullable: "NO",
    tableName: UNIT_TABLE_NAME,
  });

  const unitType = normalizedColumnType(state.unitColumn);
  const referencedType = normalizedColumnType(state.referencedColumn);
  if (unitType !== referencedType) {
    throw migrationError(
      `Incompatible foreign key types: ${TABLE_NAME}.${UNIT_ID_COLUMN}=${unitType || "<unknown>"}; ${UNIT_TABLE_NAME}.${REFERENCED_ID_COLUMN}=${referencedType || "<unknown>"}.`,
      "ENROLLMENT_UNIT_FOREIGN_KEY_TYPE_MISMATCH",
      { referencedType, unitType },
    );
  }

  const supportIndex = state.enrollmentIndexes.find((index) => index.columns[0] === UNIT_ID_COLUMN);
  if (!supportIndex) {
    throw migrationError(
      `Missing reusable index beginning with ${TABLE_NAME}.${UNIT_ID_COLUMN}.`,
      "ENROLLMENT_UNIT_FOREIGN_KEY_SUPPORT_INDEX_MISSING",
    );
  }

  const referencedIndex = state.unitIndexes.find(
    (index) => index.nonUnique === 0 && index.columns[0] === REFERENCED_ID_COLUMN,
  );
  if (!referencedIndex) {
    throw migrationError(
      `Missing unique referenced index beginning with ${UNIT_TABLE_NAME}.${REFERENCED_ID_COLUMN}.`,
      "ENROLLMENT_UNIT_FOREIGN_KEY_REFERENCED_INDEX_MISSING",
    );
  }
}

function assertCompatibleColumn(column, { columnName, nullable, tableName }) {
  if (!column) {
    throw migrationError(
      `Required column ${tableName}.${columnName} does not exist.`,
      "ENROLLMENT_UNIT_FOREIGN_KEY_COLUMN_MISSING",
      { columnName, tableName },
    );
  }

  const columnType = normalizedColumnType(column);
  const dataType = String(readField(column, "DATA_TYPE") ?? "").toLowerCase();
  const actualNullable = String(readField(column, "IS_NULLABLE") ?? "").toUpperCase();
  const characterSet = readField(column, "CHARACTER_SET_NAME");
  const collation = readField(column, "COLLATION_NAME");
  const signedBigInt =
    dataType === "bigint" &&
    /^bigint(?:\(\d+\))?$/u.test(columnType) &&
    !columnType.includes("unsigned");

  if (!signedBigInt || actualNullable !== nullable || characterSet != null || collation != null) {
    throw migrationError(
      `Incompatible ${tableName}.${columnName}: type=${columnType || "<unknown>"}; nullable=${actualNullable || "<unknown>"}. Expected signed BIGINT with nullable=${nullable}; charset and collation must not apply.`,
      "ENROLLMENT_UNIT_FOREIGN_KEY_COLUMN_INCOMPATIBLE",
      {
        characterSet,
        collation,
        columnName,
        columnType,
        dataType,
        nullable: actualNullable,
        tableName,
      },
    );
  }
}

function resolveExistingForeignKey(foreignKeys) {
  const canonical = foreignKeys.find((foreignKey) => foreignKey.name === FOREIGN_KEY_NAME);
  if (canonical) {
    assertExpectedForeignKey(canonical);
    return canonical;
  }

  const equivalent = foreignKeys.find(isExpectedForeignKey);
  if (equivalent) return equivalent;

  if (foreignKeys.length > 0) {
    throw migrationError(
      `Incompatible foreign key already uses ${TABLE_NAME}.${UNIT_ID_COLUMN}.`,
      "ENROLLMENT_UNIT_FOREIGN_KEY_CONFLICT",
      { foreignKeys: foreignKeys.map((foreignKey) => foreignKey.name) },
    );
  }

  return null;
}

function assertCanonicalForeignKey(foreignKeys) {
  const canonical = foreignKeys.find((foreignKey) => foreignKey.name === FOREIGN_KEY_NAME);
  if (!canonical) {
    throw migrationError(
      `Missing foreign key ${TABLE_NAME}.${FOREIGN_KEY_NAME} after migration.`,
      "ENROLLMENT_UNIT_FOREIGN_KEY_CREATION_FAILED",
    );
  }
  assertExpectedForeignKey(canonical);
}

function assertExpectedForeignKey(foreignKey) {
  if (!isExpectedForeignKey(foreignKey)) {
    throw migrationError(
      `Incompatible foreign key ${TABLE_NAME}.${foreignKey?.name || FOREIGN_KEY_NAME}.`,
      "ENROLLMENT_UNIT_FOREIGN_KEY_INCOMPATIBLE",
      { foreignKey },
    );
  }
}

function isExpectedForeignKey(foreignKey) {
  return (
    foreignKey?.column === UNIT_ID_COLUMN &&
    foreignKey?.referencedTable === UNIT_TABLE_NAME &&
    foreignKey?.referencedColumn === REFERENCED_ID_COLUMN
  );
}

async function readState() {
  const [unitColumn, referencedColumn, enrollmentIndexes, unitIndexes, foreignKeys] =
    await Promise.all([
      readColumn(TABLE_NAME, UNIT_ID_COLUMN),
      readColumn(UNIT_TABLE_NAME, REFERENCED_ID_COLUMN),
      readIndexes(TABLE_NAME),
      readIndexes(UNIT_TABLE_NAME),
      readForeignKeys(),
    ]);

  return {
    enrollmentIndexes,
    foreignKeys,
    referencedColumn,
    unitColumn,
    unitIndexes,
  };
}

async function readColumn(tableName, columnName) {
  const rows = await dbQuery(
    `
      SELECT
        COLUMN_NAME,
        COLUMN_TYPE,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_SET_NAME,
        COLLATION_NAME
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1
    `,
    [tableName, columnName],
  );

  return rows[0] ?? null;
}

async function readIndexes(tableName) {
  const rows = await dbQuery(
    `
      SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `,
    [tableName],
  );
  const grouped = new Map();

  for (const row of rows) {
    const name = String(readField(row, "INDEX_NAME") ?? "");
    if (!name) continue;
    const index = grouped.get(name) || {
      columns: [],
      name,
      nonUnique: Number(readField(row, "NON_UNIQUE")),
    };
    index.columns.push({
      name: String(readField(row, "COLUMN_NAME") ?? ""),
      sequence: Number(readField(row, "SEQ_IN_INDEX")),
    });
    grouped.set(name, index);
  }

  return [...grouped.values()].map((index) => ({
    columns: index.columns
      .sort((left, right) => left.sequence - right.sequence)
      .map((column) => column.name),
    name: index.name,
    nonUnique: index.nonUnique,
  }));
}

async function readForeignKeys() {
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

function normalizedColumnType(column) {
  return String(readField(column, "COLUMN_TYPE") ?? "").toLowerCase();
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
  ADD_FOREIGN_KEY_SQL,
  DROP_FOREIGN_KEY_SQL,
  FOREIGN_KEY_NAME,
  REFERENCED_ID_COLUMN,
  TABLE_NAME,
  UNIT_ID_COLUMN,
  UNIT_TABLE_NAME,
  down,
  status,
  up,
};
