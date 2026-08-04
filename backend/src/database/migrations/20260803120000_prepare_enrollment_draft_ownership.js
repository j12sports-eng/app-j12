#!/usr/bin/env node
"use strict";

const TABLE_NAME = "enrollments";
const ERROR_CODES = Object.freeze({
  DATA_UNSAFE: "ENROLLMENT_DRAFT_OWNERSHIP_DATA_UNSAFE",
  DOWN_UNSAFE: "ENROLLMENT_DRAFT_OWNERSHIP_DOWN_UNSAFE",
  SCHEMA_UNSAFE: "ENROLLMENT_DRAFT_OWNERSHIP_SCHEMA_UNSAFE",
});
const OWNERSHIP = Object.freeze({
  responsible_person_id: Object.freeze({
    table: "people",
    index: "idx_enrollments_responsible_person_id",
    foreignKey: "fk_enrollments_responsible_person_id",
  }),
  responsible_profile_id: Object.freeze({
    table: "person_profiles",
    index: "idx_enrollments_responsible_profile_id",
    foreignKey: "fk_enrollments_responsible_profile_id",
  }),
  responsible_relationship_id: Object.freeze({
    table: "person_relationships",
    index: "idx_enrollments_responsible_relationship_id",
    foreignKey: "fk_enrollments_responsible_relationship_id",
  }),
});

function createEnrollmentDraftOwnershipMigration({ queryRunner, tableExists } = {}) {
  if (typeof queryRunner !== "function" || typeof tableExists !== "function") {
    throw new TypeError("Migration requires queryRunner and tableExists.");
  }

  async function up() {
    await assertRequiredTables(tableExists);
    await assertExistingArtifactsAreSafe(queryRunner);
    for (const [columnName, contract] of Object.entries(OWNERSHIP)) {
      await ensureColumn(queryRunner, columnName);
      await assertNoOrphans(queryRunner, columnName, contract.table);
      await ensureIndex(queryRunner, columnName, contract.index);
      await ensureForeignKey(queryRunner, columnName, contract);
    }
    return status();
  }

  async function status() {
    await assertRequiredTables(tableExists);
    const result = {};
    for (const [columnName, contract] of Object.entries(OWNERSHIP)) {
      const column = await readColumn(queryRunner, columnName);
      const index = await readIndex(queryRunner, contract.index);
      const foreignKey = await readForeignKey(queryRunner, contract.foreignKey);
      if (column) assertCompatibleColumn(columnName, column);
      if (index) assertCompatibleIndex(contract.index, columnName, index);
      if (foreignKey) assertCompatibleForeignKey(columnName, contract, foreignKey);
      result[columnName] = Object.freeze({
        column: Boolean(column),
        index: Boolean(index),
        foreignKey: Boolean(foreignKey),
      });
    }
    return Object.freeze(result);
  }

  async function down() {
    throw migrationError(
      ERROR_CODES.DOWN_UNSAFE,
      "Automatic rollback is unsafe because ownership columns may contain production data.",
    );
  }

  return Object.freeze({ down, status, up });
}

async function assertExistingArtifactsAreSafe(queryRunner) {
  for (const [columnName, contract] of Object.entries(OWNERSHIP)) {
    const column = await readColumn(queryRunner, columnName);
    if (column) {
      assertCompatibleColumn(columnName, column);
      await assertNoOrphans(queryRunner, columnName, contract.table);
    }
    const index = await readIndex(queryRunner, contract.index);
    if (index) assertCompatibleIndex(contract.index, columnName, index);
    const foreignKeys = await readForeignKeysForColumn(queryRunner, columnName);
    const named = foreignKeys.find((item) => item.name === contract.foreignKey);
    if (named) assertCompatibleForeignKey(columnName, contract, named);
    if (foreignKeys.length > Number(Boolean(named))) {
      throw migrationError(
        ERROR_CODES.SCHEMA_UNSAFE,
        `Unexpected foreign key already owns ${TABLE_NAME}.${columnName}.`,
      );
    }
  }
}

async function assertRequiredTables(tableExists) {
  for (const table of [
    TABLE_NAME,
    ...new Set(Object.values(OWNERSHIP).map((item) => item.table)),
  ]) {
    if (!(await tableExists(table))) {
      throw migrationError(ERROR_CODES.SCHEMA_UNSAFE, `Required table ${table} does not exist.`);
    }
  }
}

async function ensureColumn(queryRunner, columnName) {
  const existing = await readColumn(queryRunner, columnName);
  if (existing) {
    assertCompatibleColumn(columnName, existing);
    return false;
  }
  await queryRunner(`ALTER TABLE ${TABLE_NAME} ADD COLUMN ${columnName} VARCHAR(64) NULL`);
  assertCompatibleColumn(columnName, await readColumn(queryRunner, columnName));
  return true;
}

async function ensureIndex(queryRunner, columnName, indexName) {
  const existing = await readIndex(queryRunner, indexName);
  if (existing) {
    assertCompatibleIndex(indexName, columnName, existing);
    return false;
  }
  await queryRunner(`ALTER TABLE ${TABLE_NAME} ADD INDEX ${indexName} (${columnName})`);
  assertCompatibleIndex(indexName, columnName, await readIndex(queryRunner, indexName));
  return true;
}

async function ensureForeignKey(queryRunner, columnName, contract) {
  const foreignKeys = await readForeignKeysForColumn(queryRunner, columnName);
  const named = foreignKeys.find((item) => item.name === contract.foreignKey);
  if (named) {
    assertCompatibleForeignKey(columnName, contract, named);
    return false;
  }
  if (foreignKeys.length > 0) {
    throw migrationError(
      ERROR_CODES.SCHEMA_UNSAFE,
      `Unexpected foreign key already owns ${TABLE_NAME}.${columnName}.`,
    );
  }
  await queryRunner(
    `ALTER TABLE ${TABLE_NAME} ADD CONSTRAINT ${contract.foreignKey} FOREIGN KEY (${columnName}) REFERENCES ${contract.table}(id) ON UPDATE CASCADE ON DELETE RESTRICT`,
  );
  assertCompatibleForeignKey(
    columnName,
    contract,
    await readForeignKey(queryRunner, contract.foreignKey),
  );
  return true;
}

async function assertNoOrphans(queryRunner, columnName, referencedTable) {
  const rows = await queryRunner(
    `SELECT COUNT(*) total FROM ${TABLE_NAME} source LEFT JOIN ${referencedTable} target ON target.id = source.${columnName} WHERE source.${columnName} IS NOT NULL AND target.id IS NULL`,
  );
  const total = Number(rows?.[0]?.total || 0);
  if (total > 0) {
    throw migrationError(
      ERROR_CODES.DATA_UNSAFE,
      `Found ${total} orphan value(s) in ${TABLE_NAME}.${columnName}.`,
      { columnName, total },
    );
  }
}

function assertCompatibleColumn(columnName, column) {
  if (
    String(column?.COLUMN_TYPE || "").toLowerCase() !== "varchar(64)" ||
    String(column?.IS_NULLABLE || "").toUpperCase() !== "YES" ||
    String(column?.EXTRA || "").length > 0
  ) {
    throw migrationError(
      ERROR_CODES.SCHEMA_UNSAFE,
      `Incompatible ownership column ${TABLE_NAME}.${columnName}.`,
    );
  }
}

function assertCompatibleIndex(indexName, columnName, index) {
  if (Number(index?.nonUnique) !== 1 || index?.columns?.join(",") !== columnName) {
    throw migrationError(ERROR_CODES.SCHEMA_UNSAFE, `Incompatible index ${indexName}.`);
  }
}

function assertCompatibleForeignKey(columnName, contract, foreignKey) {
  if (
    !foreignKey ||
    foreignKey.column !== columnName ||
    foreignKey.referencedTable !== contract.table ||
    foreignKey.referencedColumn !== "id"
  ) {
    throw migrationError(
      ERROR_CODES.SCHEMA_UNSAFE,
      `Incompatible foreign key ${contract.foreignKey}.`,
    );
  }
}

async function readColumn(queryRunner, columnName) {
  const rows = await queryRunner(
    "SELECT COLUMN_TYPE,IS_NULLABLE,EXTRA FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=? LIMIT 1",
    [TABLE_NAME, columnName],
  );
  return rows?.[0] || null;
}

async function readIndex(queryRunner, indexName) {
  const rows = await queryRunner(
    "SELECT NON_UNIQUE,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') columns FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=? GROUP BY NON_UNIQUE",
    [TABLE_NAME, indexName],
  );
  const row = rows?.[0];
  return row
    ? { nonUnique: Number(row.NON_UNIQUE), columns: String(row.columns || "").split(",") }
    : null;
}

async function readForeignKey(queryRunner, constraintName) {
  const rows = await queryRunner(
    "SELECT CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.key_column_usage WHERE table_schema=DATABASE() AND table_name=? AND constraint_name=? AND referenced_table_name IS NOT NULL LIMIT 1",
    [TABLE_NAME, constraintName],
  );
  return mapForeignKey(rows?.[0]);
}

async function readForeignKeysForColumn(queryRunner, columnName) {
  const rows = await queryRunner(
    "SELECT CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.key_column_usage WHERE table_schema=DATABASE() AND table_name=? AND column_name=? AND referenced_table_name IS NOT NULL",
    [TABLE_NAME, columnName],
  );
  return (rows || []).map(mapForeignKey);
}

function mapForeignKey(row) {
  if (!row) return null;
  return {
    name: row.CONSTRAINT_NAME,
    column: row.COLUMN_NAME,
    referencedTable: row.REFERENCED_TABLE_NAME,
    referencedColumn: row.REFERENCED_COLUMN_NAME,
  };
}

function migrationError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

let defaultMigration;
function getDefaultMigration() {
  if (!defaultMigration) {
    const database = require("../../config/db.js");
    defaultMigration = createEnrollmentDraftOwnershipMigration({
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
  OWNERSHIP,
  TABLE_NAME,
  createEnrollmentDraftOwnershipMigration,
  down,
  status,
  up,
});
