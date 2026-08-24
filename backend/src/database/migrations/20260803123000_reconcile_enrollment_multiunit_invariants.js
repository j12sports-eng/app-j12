#!/usr/bin/env node
"use strict";

const {
  normalizeGenerationExpression: normalizeExpression,
} = require("../generation-expression.js");
const legacyMigration = require("./20260729180000_enforce_enrollment_multiunit_invariants.js");

const TABLE_NAME = "enrollments";
const ERROR_CODES = Object.freeze({
  DOWN_UNSAFE: "ENROLLMENT_MULTIUNIT_RECONCILE_DOWN_UNSAFE",
  SCHEMA_UNSAFE: "ENROLLMENT_MULTIUNIT_RECONCILE_SCHEMA_UNSAFE",
});
const GENERATED_COLUMNS = Object.freeze({
  [legacyMigration.DRAFT_UNIT_COLUMN]: Object.freeze({
    type: "bigint",
    expression: "CASE WHEN status = 'DRAFT' AND deleted_at IS NULL THEN unit_id ELSE NULL END",
  }),
  [legacyMigration.CURRENT_UNIT_COLUMN]: Object.freeze({
    type: "bigint",
    expression:
      "CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN unit_id ELSE NULL END",
  }),
  [legacyMigration.CURRENT_STUDENT_PERSON_COLUMN]: Object.freeze({
    type: "varchar(64)",
    expression:
      "CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN student_person_id ELSE NULL END",
  }),
  [legacyMigration.CURRENT_STUDENT_PROFILE_COLUMN]: Object.freeze({
    type: "varchar(64)",
    expression:
      "CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN student_profile_id ELSE NULL END",
  }),
});
const EXPECTED_DRAFT_INDEX = Object.freeze([
  legacyMigration.DRAFT_UNIT_COLUMN,
  "active_draft_student_person_id",
  "active_draft_student_profile_id",
]);
const LEGACY_DRAFT_INDEX = Object.freeze([
  "active_draft_student_person_id",
  "active_draft_student_profile_id",
]);
const EXPECTED_CURRENT_INDEX = Object.freeze([
  legacyMigration.CURRENT_UNIT_COLUMN,
  legacyMigration.CURRENT_STUDENT_PERSON_COLUMN,
  legacyMigration.CURRENT_STUDENT_PROFILE_COLUMN,
]);

function createEnrollmentMultiunitReconciliation({ queryRunner, tableExists } = {}) {
  if (typeof queryRunner !== "function" || typeof tableExists !== "function") {
    throw new TypeError("Migration requires queryRunner and tableExists.");
  }
  const canonical = legacyMigration.createEnrollmentMultiunitInvariantMigration({
    queryRunner,
    tableExists,
  });

  async function up() {
    await assertExistingArtifactsAreSafe(queryRunner);
    const result = await canonical.up();
    await assertFinalArtifacts(queryRunner);
    return result;
  }

  async function status() {
    const result = await canonical.status();
    return Object.freeze({
      ...result,
      reconciliationReady:
        Object.values(result.generatedColumns).every(Boolean) &&
        sameIndex(result.draftIndex, EXPECTED_DRAFT_INDEX) &&
        sameIndex(result.currentIndex, EXPECTED_CURRENT_INDEX),
    });
  }

  async function down() {
    throw migrationError(
      ERROR_CODES.DOWN_UNSAFE,
      "Automatic rollback is unsafe because MySQL DDL is not transactional and artifact ownership predates this reconciliation.",
    );
  }

  return Object.freeze({ down, status, up });
}

async function assertExistingArtifactsAreSafe(queryRunner) {
  for (const [columnName, expected] of Object.entries(GENERATED_COLUMNS)) {
    const column = await readColumn(queryRunner, columnName);
    if (column) assertGeneratedColumn(columnName, column, expected);
  }
  const draftIndex = await readIndex(queryRunner, legacyMigration.OLD_DRAFT_INDEX);
  if (
    draftIndex &&
    !sameIndex(draftIndex, LEGACY_DRAFT_INDEX) &&
    !sameIndex(draftIndex, EXPECTED_DRAFT_INDEX)
  ) {
    throw migrationError(
      ERROR_CODES.SCHEMA_UNSAFE,
      `Refusing to replace incompatible index ${legacyMigration.OLD_DRAFT_INDEX}.`,
    );
  }
  const currentIndex = await readIndex(queryRunner, legacyMigration.CURRENT_UNIQUE_INDEX);
  if (currentIndex && !sameIndex(currentIndex, EXPECTED_CURRENT_INDEX)) {
    throw migrationError(
      ERROR_CODES.SCHEMA_UNSAFE,
      `Existing index ${legacyMigration.CURRENT_UNIQUE_INDEX} is incompatible.`,
    );
  }
}

async function assertFinalArtifacts(queryRunner) {
  for (const [columnName, expected] of Object.entries(GENERATED_COLUMNS)) {
    assertGeneratedColumn(columnName, await readColumn(queryRunner, columnName), expected);
  }
  const draftIndex = await readIndex(queryRunner, legacyMigration.OLD_DRAFT_INDEX);
  const currentIndex = await readIndex(queryRunner, legacyMigration.CURRENT_UNIQUE_INDEX);
  if (!sameIndex(draftIndex, EXPECTED_DRAFT_INDEX)) {
    throw migrationError(ERROR_CODES.SCHEMA_UNSAFE, "Unit-aware DRAFT index was not reconciled.");
  }
  if (!sameIndex(currentIndex, EXPECTED_CURRENT_INDEX)) {
    throw migrationError(ERROR_CODES.SCHEMA_UNSAFE, "Current enrollment index was not reconciled.");
  }
}

function assertGeneratedColumn(columnName, column, expected) {
  const expression = normalizeExpression(column?.GENERATION_EXPRESSION);
  if (
    !column ||
    !hasCompatibleColumnType(column, expected.type) ||
    String(column.IS_NULLABLE || "").toUpperCase() !== "YES" ||
    !String(column.EXTRA || "")
      .toUpperCase()
      .includes("GENERATED") ||
    expression !== normalizeExpression(expected.expression)
  ) {
    throw migrationError(
      ERROR_CODES.SCHEMA_UNSAFE,
      `Generated column ${TABLE_NAME}.${columnName} is incompatible.`,
    );
  }
}

function sameIndex(index, expectedColumns) {
  return (
    Number(index?.nonUnique) === 0 &&
    Array.isArray(index?.columns) &&
    index.columns.join(",") === expectedColumns.join(",")
  );
}

function hasCompatibleColumnType(column, expectedType) {
  const dataType = String(column?.DATA_TYPE ?? "").toLowerCase();
  const columnType = String(column?.COLUMN_TYPE ?? "").toLowerCase();
  if (expectedType === "bigint") {
    return (
      dataType === "bigint" &&
      /^bigint(?:\(\d+\))?$/u.test(columnType) &&
      !columnType.includes("unsigned")
    );
  }
  return columnType === expectedType;
}

async function readColumn(queryRunner, columnName) {
  const rows = await queryRunner(
    "SELECT DATA_TYPE,COLUMN_TYPE,IS_NULLABLE,EXTRA,GENERATION_EXPRESSION FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=? LIMIT 1",
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
    ? {
        nonUnique: Number(row.NON_UNIQUE),
        columns: String(row.columns || "")
          .split(",")
          .filter(Boolean),
      }
    : null;
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
    defaultMigration = createEnrollmentMultiunitReconciliation({
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
  EXPECTED_CURRENT_INDEX,
  EXPECTED_DRAFT_INDEX,
  GENERATED_COLUMNS,
  LEGACY_DRAFT_INDEX,
  createEnrollmentMultiunitReconciliation,
  down,
  status,
  up,
});
