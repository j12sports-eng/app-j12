#!/usr/bin/env node
"use strict";

const TABLE_NAME = "enrollment_digital_invitations";
const UNIT_TABLE = "j12_unidades";
const UNIT_COLUMN = "unit_id";
const UNIT_INDEX = "idx_edi_unit";
const UNIT_FOREIGN_KEY = "fk_edi_unit";
const ERROR_CODES = Object.freeze({
  DATA_UNSAFE: "ENROLLMENT_INVITATION_UNIT_DATA_UNSAFE",
  DOWN_UNSAFE: "ENROLLMENT_INVITATION_UNIT_DOWN_UNSAFE",
  SCHEMA_UNSAFE: "ENROLLMENT_INVITATION_UNIT_SCHEMA_UNSAFE",
});

function createInvitationUnitTypeReconciliation({ queryRunner, tableExists } = {}) {
  if (typeof queryRunner !== "function" || typeof tableExists !== "function") {
    throw new TypeError("Migration requires queryRunner and tableExists.");
  }

  async function up() {
    for (const table of [TABLE_NAME, UNIT_TABLE]) {
      if (!(await tableExists(table))) {
        throw migrationError(ERROR_CODES.SCHEMA_UNSAFE, `Required table ${table} is missing.`);
      }
    }
    assertCanonicalParent(await readColumn(queryRunner, UNIT_TABLE, "id"));
    const before = await readState(queryRunner);
    assertConvertibleColumn(before.column);
    assertExistingIndex(before.index);
    assertExistingForeignKeys(before);
    if (!isCanonicalBigInt(before.column)) {
      await assertConvertibleData(queryRunner);
      await queryRunner(`ALTER TABLE ${TABLE_NAME} MODIFY COLUMN ${UNIT_COLUMN} BIGINT NOT NULL`);
    }
    await ensureIndex(queryRunner);
    await ensureForeignKey(queryRunner);
    const after = await readState(queryRunner);
    assertCanonicalState(after);
    return after;
  }

  async function status() {
    return readState(queryRunner);
  }

  async function down() {
    throw migrationError(
      ERROR_CODES.DOWN_UNSAFE,
      "Automatic rollback to VARCHAR is intentionally unavailable.",
    );
  }

  return Object.freeze({ down, status, up });
}

function assertCanonicalParent(column) {
  if (
    String(column?.DATA_TYPE || "").toLowerCase() !== "bigint" ||
    String(column?.COLUMN_TYPE || "").toLowerCase() !== "bigint" ||
    String(column?.IS_NULLABLE || "").toUpperCase() !== "NO"
  ) {
    throw migrationError(
      ERROR_CODES.SCHEMA_UNSAFE,
      "j12_unidades.id must be signed BIGINT NOT NULL before invitation reconciliation.",
    );
  }
}

function assertExistingIndex(index) {
  if (index && (Number(index.nonUnique) !== 1 || index.columns.join(",") !== UNIT_COLUMN)) {
    throw migrationError(ERROR_CODES.SCHEMA_UNSAFE, `Incompatible index ${UNIT_INDEX}.`);
  }
}

function assertExistingForeignKeys(state) {
  if (!state.foreignKeys.length) return;
  const canonical = state.foreignKeys.find((item) => item.name === UNIT_FOREIGN_KEY);
  if (!canonical || state.foreignKeys.length !== 1 || !isCanonicalBigInt(state.column)) {
    throw migrationError(
      ERROR_CODES.SCHEMA_UNSAFE,
      `Foreign keys on ${TABLE_NAME}.${UNIT_COLUMN} must be reviewed before type conversion.`,
    );
  }
  assertForeignKey(canonical);
}

async function assertConvertibleData(queryRunner) {
  const invalid = await queryRunner(
    `SELECT COUNT(*) total FROM ${TABLE_NAME} WHERE ${UNIT_COLUMN} IS NULL OR TRIM(${UNIT_COLUMN}) NOT REGEXP '^[1-9][0-9]{0,18}$' OR CAST(${UNIT_COLUMN} AS DECIMAL(20,0)) > 9223372036854775807`,
  );
  const invalidTotal = Number(invalid?.[0]?.total || 0);
  if (invalidTotal > 0) {
    throw migrationError(
      ERROR_CODES.DATA_UNSAFE,
      `Found ${invalidTotal} invitation unit value(s) incompatible with signed BIGINT.`,
    );
  }
  const orphan = await queryRunner(
    `SELECT COUNT(*) total FROM ${TABLE_NAME} invitation LEFT JOIN ${UNIT_TABLE} unit_scope ON unit_scope.id = CAST(invitation.${UNIT_COLUMN} AS SIGNED) WHERE unit_scope.id IS NULL`,
  );
  const orphanTotal = Number(orphan?.[0]?.total || 0);
  if (orphanTotal > 0) {
    throw migrationError(
      ERROR_CODES.DATA_UNSAFE,
      `Found ${orphanTotal} invitation unit value(s) without a canonical unit.`,
    );
  }
}

function assertConvertibleColumn(column) {
  const type = String(column?.COLUMN_TYPE || "").toLowerCase();
  if (!column || !["varchar(64)", "bigint"].includes(type)) {
    throw migrationError(
      ERROR_CODES.SCHEMA_UNSAFE,
      `Unexpected ${TABLE_NAME}.${UNIT_COLUMN} type: ${type || "<missing>"}.`,
    );
  }
  if (String(column.IS_NULLABLE || "").toUpperCase() !== "NO") {
    throw migrationError(ERROR_CODES.SCHEMA_UNSAFE, "Invitation unit_id must be NOT NULL.");
  }
}

function isCanonicalBigInt(column) {
  return (
    String(column?.DATA_TYPE || "").toLowerCase() === "bigint" &&
    String(column?.COLUMN_TYPE || "").toLowerCase() === "bigint"
  );
}

async function ensureIndex(queryRunner) {
  const index = await readIndex(queryRunner);
  if (index) {
    if (Number(index.nonUnique) !== 1 || index.columns.join(",") !== UNIT_COLUMN) {
      throw migrationError(ERROR_CODES.SCHEMA_UNSAFE, `Incompatible index ${UNIT_INDEX}.`);
    }
    return false;
  }
  await queryRunner(`ALTER TABLE ${TABLE_NAME} ADD INDEX ${UNIT_INDEX} (${UNIT_COLUMN})`);
  return true;
}

async function ensureForeignKey(queryRunner) {
  const foreignKeys = await readForeignKeys(queryRunner);
  const canonical = foreignKeys.find((item) => item.name === UNIT_FOREIGN_KEY);
  if (canonical) {
    assertForeignKey(canonical);
    return false;
  }
  if (foreignKeys.length > 0) {
    throw migrationError(
      ERROR_CODES.SCHEMA_UNSAFE,
      `Unexpected foreign key already owns ${TABLE_NAME}.${UNIT_COLUMN}.`,
    );
  }
  await queryRunner(
    `ALTER TABLE ${TABLE_NAME} ADD CONSTRAINT ${UNIT_FOREIGN_KEY} FOREIGN KEY (${UNIT_COLUMN}) REFERENCES ${UNIT_TABLE}(id) ON UPDATE CASCADE ON DELETE RESTRICT`,
  );
  return true;
}

function assertForeignKey(foreignKey) {
  if (
    foreignKey.column !== UNIT_COLUMN ||
    foreignKey.referencedTable !== UNIT_TABLE ||
    foreignKey.referencedColumn !== "id"
  ) {
    throw migrationError(ERROR_CODES.SCHEMA_UNSAFE, `Incompatible ${UNIT_FOREIGN_KEY}.`);
  }
}

function assertCanonicalState(state) {
  if (!isCanonicalBigInt(state.column)) {
    throw migrationError(ERROR_CODES.SCHEMA_UNSAFE, "Invitation unit_id was not converted.");
  }
  if (Number(state.index?.nonUnique) !== 1 || state.index?.columns?.join(",") !== UNIT_COLUMN) {
    throw migrationError(ERROR_CODES.SCHEMA_UNSAFE, "Invitation unit index is not canonical.");
  }
  assertForeignKey(state.foreignKeys.find((item) => item.name === UNIT_FOREIGN_KEY));
}

async function readState(queryRunner) {
  const rows = await readColumn(queryRunner, TABLE_NAME, UNIT_COLUMN);
  return Object.freeze({
    column: rows,
    index: await readIndex(queryRunner),
    foreignKeys: Object.freeze(await readForeignKeys(queryRunner)),
  });
}

async function readColumn(queryRunner, tableName, columnName) {
  const rows = await queryRunner(
    "SELECT DATA_TYPE,COLUMN_TYPE,IS_NULLABLE FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=? LIMIT 1",
    [tableName, columnName],
  );
  return rows?.[0] || null;
}

async function readIndex(queryRunner) {
  const rows = await queryRunner(
    "SELECT NON_UNIQUE,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') columns FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=? GROUP BY NON_UNIQUE",
    [TABLE_NAME, UNIT_INDEX],
  );
  return rows?.[0]
    ? {
        nonUnique: Number(rows[0].NON_UNIQUE),
        columns: String(rows[0].columns || "").split(","),
      }
    : null;
}

async function readForeignKeys(queryRunner) {
  const rows = await queryRunner(
    "SELECT CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.key_column_usage WHERE table_schema=DATABASE() AND table_name=? AND column_name=? AND referenced_table_name IS NOT NULL",
    [TABLE_NAME, UNIT_COLUMN],
  );
  return (rows || []).map((row) => ({
    name: row.CONSTRAINT_NAME,
    column: row.COLUMN_NAME,
    referencedTable: row.REFERENCED_TABLE_NAME,
    referencedColumn: row.REFERENCED_COLUMN_NAME,
  }));
}

function migrationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

let defaultMigration;
function getDefaultMigration() {
  if (!defaultMigration) {
    const database = require("../../config/db.js");
    defaultMigration = createInvitationUnitTypeReconciliation({
      queryRunner: database.query,
      tableExists: database.tableExists,
    });
  }
  return defaultMigration;
}

const up = (...args) => getDefaultMigration().up(...args);
const down = (...args) => getDefaultMigration().down(...args);
const status = (...args) => getDefaultMigration().status(...args);

module.exports = Object.freeze({
  ERROR_CODES,
  TABLE_NAME,
  UNIT_COLUMN,
  UNIT_FOREIGN_KEY,
  UNIT_INDEX,
  createInvitationUnitTypeReconciliation,
  down,
  status,
  up,
});
