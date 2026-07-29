#!/usr/bin/env node

/**
 * Sprint 29.3B - Enforce unit-scoped current Enrollment identity.
 *
 * Manual execution only. No backfill is performed. Legacy rows with NULL
 * unit_id remain readable and outside the modern generated-key constraints.
 * Incompatible modern rows make `up` fail before any DDL.
 */

const TABLE_NAME = "enrollments";
const UNIT_TABLE_NAME = "j12_unidades";
const OLD_DRAFT_INDEX = "ux_enrollments_active_draft_student_profile";
const DRAFT_UNIT_COLUMN = "active_draft_unit_id";
const CURRENT_UNIT_COLUMN = "current_enrollment_unit_id";
const CURRENT_STUDENT_PERSON_COLUMN = "current_enrollment_student_person_id";
const CURRENT_STUDENT_PROFILE_COLUMN = "current_enrollment_student_profile_id";
const CURRENT_UNIQUE_INDEX = "ux_enrollments_current_unit_student_profile";
const DRAFT_STUDENT_PERSON_COLUMN = "active_draft_student_person_id";
const DRAFT_STUDENT_PROFILE_COLUMN = "active_draft_student_profile_id";

const ERROR_CODES = Object.freeze({
  DATA_UNSAFE: "ENROLLMENT_MULTIUNIT_DATA_UNSAFE",
  SCHEMA_UNSAFE: "ENROLLMENT_MULTIUNIT_SCHEMA_UNSAFE",
});

const ADD_DRAFT_UNIT_COLUMN_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD COLUMN ${DRAFT_UNIT_COLUMN} BIGINT
      GENERATED ALWAYS AS (
        CASE WHEN status = 'DRAFT' AND deleted_at IS NULL THEN unit_id ELSE NULL END
      ) VIRTUAL
`;
const ADD_CURRENT_UNIT_COLUMN_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD COLUMN ${CURRENT_UNIT_COLUMN} BIGINT
      GENERATED ALWAYS AS (
        CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN unit_id ELSE NULL END
      ) VIRTUAL
`;
const ADD_CURRENT_STUDENT_PERSON_COLUMN_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD COLUMN ${CURRENT_STUDENT_PERSON_COLUMN} VARCHAR(64)
      GENERATED ALWAYS AS (
        CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN student_person_id ELSE NULL END
      ) VIRTUAL
`;
const ADD_CURRENT_STUDENT_PROFILE_COLUMN_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD COLUMN ${CURRENT_STUDENT_PROFILE_COLUMN} VARCHAR(64)
      GENERATED ALWAYS AS (
        CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN student_profile_id ELSE NULL END
      ) VIRTUAL
`;
const DROP_OLD_DRAFT_INDEX_SQL = `ALTER TABLE ${TABLE_NAME} DROP INDEX ${OLD_DRAFT_INDEX}`;
const ADD_UNIT_DRAFT_INDEX_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD UNIQUE INDEX ${OLD_DRAFT_INDEX} (
      ${DRAFT_UNIT_COLUMN},
      ${DRAFT_STUDENT_PERSON_COLUMN},
      ${DRAFT_STUDENT_PROFILE_COLUMN}
    )
`;
const ADD_CURRENT_UNIQUE_INDEX_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD UNIQUE INDEX ${CURRENT_UNIQUE_INDEX} (
      ${CURRENT_UNIT_COLUMN},
      ${CURRENT_STUDENT_PERSON_COLUMN},
      ${CURRENT_STUDENT_PROFILE_COLUMN}
    )
`;
const ADD_LEGACY_DRAFT_INDEX_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD UNIQUE INDEX ${OLD_DRAFT_INDEX} (
      ${DRAFT_STUDENT_PERSON_COLUMN},
      ${DRAFT_STUDENT_PROFILE_COLUMN}
    )
`;

const DIAGNOSTIC_QUERIES = Object.freeze({
  activeDuplicateGroups: `
    SELECT COUNT(*) total FROM (
      SELECT unit_id, student_person_id, student_profile_id
      FROM enrollments
      WHERE unit_id IS NOT NULL AND status = 'ACTIVE' AND deleted_at IS NULL
      GROUP BY unit_id, student_person_id, student_profile_id
      HAVING COUNT(*) > 1
    ) duplicated
  `,
  currentConflictGroups: `
    SELECT COUNT(*) total FROM (
      SELECT unit_id, student_person_id, student_profile_id
      FROM enrollments
      WHERE unit_id IS NOT NULL AND status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL
      GROUP BY unit_id, student_person_id, student_profile_id
      HAVING COUNT(*) > 1
    ) conflicted
  `,
  draftDuplicateGroups: `
    SELECT COUNT(*) total FROM (
      SELECT unit_id, student_person_id, student_profile_id
      FROM enrollments
      WHERE unit_id IS NOT NULL AND status = 'DRAFT' AND deleted_at IS NULL
      GROUP BY unit_id, student_person_id, student_profile_id
      HAVING COUNT(*) > 1
    ) duplicated
  `,
  incompleteModernOwnership: `
    SELECT COUNT(*) total
    FROM enrollments
    WHERE unit_id IS NOT NULL
      AND status IN ('DRAFT','ACTIVE')
      AND deleted_at IS NULL
      AND (
        responsible_person_id IS NULL OR responsible_profile_id IS NULL OR
        responsible_relationship_id IS NULL OR student_person_id IS NULL OR
        student_profile_id IS NULL
      )
  `,
  legacyWithoutUnit: `SELECT COUNT(*) total FROM enrollments WHERE unit_id IS NULL`,
  modernWithValidUnit: `
    SELECT COUNT(*) total
    FROM enrollments enrollment
    INNER JOIN j12_unidades unit_scope ON unit_scope.id = enrollment.unit_id
    WHERE enrollment.unit_id IS NOT NULL
  `,
  orphanOwnership: `
    SELECT COUNT(*) total
    FROM enrollments enrollment
    LEFT JOIN people responsible_person
      ON responsible_person.id = enrollment.responsible_person_id
    LEFT JOIN person_profiles responsible_profile
      ON responsible_profile.id = enrollment.responsible_profile_id
     AND responsible_profile.person_id = enrollment.responsible_person_id
     AND LOWER(responsible_profile.profile_type) = 'responsavel'
    LEFT JOIN people student_person ON student_person.id = enrollment.student_person_id
    LEFT JOIN person_profiles student_profile
      ON student_profile.id = enrollment.student_profile_id
     AND student_profile.person_id = enrollment.student_person_id
     AND LOWER(student_profile.profile_type) = 'aluno'
    LEFT JOIN person_relationships responsible_relationship
      ON responsible_relationship.id = enrollment.responsible_relationship_id
     AND responsible_relationship.person_id = enrollment.responsible_person_id
     AND responsible_relationship.related_person_id = enrollment.student_person_id
    WHERE enrollment.unit_id IS NOT NULL
      AND enrollment.status IN ('DRAFT','ACTIVE')
      AND enrollment.deleted_at IS NULL
      AND (
        responsible_person.id IS NULL OR responsible_profile.id IS NULL OR
        student_person.id IS NULL OR student_profile.id IS NULL OR
        responsible_relationship.id IS NULL
      )
  `,
  orphanUnits: `
    SELECT COUNT(*) total
    FROM enrollments enrollment
    LEFT JOIN j12_unidades unit_scope ON unit_scope.id = enrollment.unit_id
    WHERE enrollment.unit_id IS NOT NULL AND unit_scope.id IS NULL
  `,
});

function createEnrollmentMultiunitInvariantMigration({ queryRunner, tableExists } = {}) {
  if (typeof queryRunner !== "function" || typeof tableExists !== "function") {
    throw new TypeError("Migration requires queryRunner and tableExists.");
  }

  async function up() {
    await assertSchemaReady(queryRunner, tableExists);
    const diagnostics = await readDiagnostics(queryRunner);
    assertSafeDiagnostics(diagnostics);

    await ensureGeneratedColumn(queryRunner, DRAFT_UNIT_COLUMN, ADD_DRAFT_UNIT_COLUMN_SQL);
    await ensureGeneratedColumn(queryRunner, CURRENT_UNIT_COLUMN, ADD_CURRENT_UNIT_COLUMN_SQL);
    await ensureGeneratedColumn(
      queryRunner,
      CURRENT_STUDENT_PERSON_COLUMN,
      ADD_CURRENT_STUDENT_PERSON_COLUMN_SQL,
    );
    await ensureGeneratedColumn(
      queryRunner,
      CURRENT_STUDENT_PROFILE_COLUMN,
      ADD_CURRENT_STUDENT_PROFILE_COLUMN_SQL,
    );
    await ensureUnitAwareDraftIndex(queryRunner);
    await ensureIndex(
      queryRunner,
      CURRENT_UNIQUE_INDEX,
      [CURRENT_UNIT_COLUMN, CURRENT_STUDENT_PERSON_COLUMN, CURRENT_STUDENT_PROFILE_COLUMN],
      ADD_CURRENT_UNIQUE_INDEX_SQL,
    );

    return status();
  }

  async function down() {
    await assertSchemaReady(queryRunner, tableExists);
    const diagnostics = await readDiagnostics(queryRunner);
    if (diagnostics.draftDuplicateGroupsAcrossUnits > 0) {
      throw migrationError(
        ERROR_CODES.DATA_UNSAFE,
        "Cannot restore the legacy global DRAFT index while cross-unit DRAFT identities exist.",
        diagnostics,
      );
    }
    await dropIndexIfExists(queryRunner, CURRENT_UNIQUE_INDEX);
    for (const column of [
      CURRENT_STUDENT_PROFILE_COLUMN,
      CURRENT_STUDENT_PERSON_COLUMN,
      CURRENT_UNIT_COLUMN,
    ]) {
      await dropColumnIfExists(queryRunner, column);
    }
    await dropIndexIfExists(queryRunner, OLD_DRAFT_INDEX);
    await queryRunner(ADD_LEGACY_DRAFT_INDEX_SQL);
    await dropColumnIfExists(queryRunner, DRAFT_UNIT_COLUMN);
    return status();
  }

  async function status() {
    await assertSchemaReady(queryRunner, tableExists);
    return Object.freeze({
      diagnostics: await readDiagnostics(queryRunner),
      draftIndex: await readIndex(queryRunner, OLD_DRAFT_INDEX),
      currentIndex: await readIndex(queryRunner, CURRENT_UNIQUE_INDEX),
      generatedColumns: Object.freeze({
        [DRAFT_UNIT_COLUMN]: Boolean(await readColumn(queryRunner, DRAFT_UNIT_COLUMN)),
        [CURRENT_UNIT_COLUMN]: Boolean(await readColumn(queryRunner, CURRENT_UNIT_COLUMN)),
        [CURRENT_STUDENT_PERSON_COLUMN]: Boolean(
          await readColumn(queryRunner, CURRENT_STUDENT_PERSON_COLUMN),
        ),
        [CURRENT_STUDENT_PROFILE_COLUMN]: Boolean(
          await readColumn(queryRunner, CURRENT_STUDENT_PROFILE_COLUMN),
        ),
      }),
    });
  }

  return Object.freeze({ down, status, up });
}

async function assertSchemaReady(queryRunner, tableExists) {
  for (const table of [
    TABLE_NAME,
    UNIT_TABLE_NAME,
    "people",
    "person_profiles",
    "person_relationships",
  ]) {
    if (!(await tableExists(table))) {
      throw migrationError(ERROR_CODES.SCHEMA_UNSAFE, `Required table ${table} does not exist.`);
    }
  }
  const required = Object.freeze({
    unit_id: "bigint",
    student_person_id: "varchar(64)",
    student_profile_id: "varchar(64)",
    responsible_person_id: "varchar(64)",
    responsible_profile_id: "varchar(64)",
    responsible_relationship_id: "varchar(64)",
    status: "varchar(32)",
    deleted_at: "datetime",
  });
  for (const [columnName, expectedType] of Object.entries(required)) {
    const column = await readColumn(queryRunner, columnName);
    const actualType = String(column?.COLUMN_TYPE ?? "").toLowerCase();
    if (!column || actualType !== expectedType || actualType.includes("unsigned")) {
      throw migrationError(
        ERROR_CODES.SCHEMA_UNSAFE,
        `Incompatible ${TABLE_NAME}.${columnName}; expected ${expectedType}.`,
      );
    }
  }
  const unitColumn = await readTableColumn(queryRunner, UNIT_TABLE_NAME, "id");
  if (
    String(unitColumn?.COLUMN_TYPE ?? "").toLowerCase() !== "bigint" ||
    String(unitColumn?.IS_NULLABLE ?? "").toUpperCase() !== "NO"
  ) {
    throw migrationError(
      ERROR_CODES.SCHEMA_UNSAFE,
      "j12_unidades.id must be signed BIGINT NOT NULL.",
    );
  }
  const foreignKeys = await readForeignKeys(queryRunner);
  const requiredForeignKeys = Object.freeze({
    responsible_person_id: "people",
    responsible_profile_id: "person_profiles",
    responsible_relationship_id: "person_relationships",
    student_person_id: "people",
    student_profile_id: "person_profiles",
    unit_id: "j12_unidades",
  });
  for (const [column, referencedTable] of Object.entries(requiredForeignKeys)) {
    if (
      !foreignKeys.some(
        (foreignKey) =>
          foreignKey.column === column &&
          foreignKey.referencedTable === referencedTable &&
          foreignKey.referencedColumn === "id",
      )
    ) {
      throw migrationError(
        ERROR_CODES.SCHEMA_UNSAFE,
        `Missing canonical foreign key for ${TABLE_NAME}.${column}.`,
      );
    }
  }
  for (const columnName of [DRAFT_STUDENT_PERSON_COLUMN, DRAFT_STUDENT_PROFILE_COLUMN]) {
    if (!(await readColumn(queryRunner, columnName))) {
      throw migrationError(
        ERROR_CODES.SCHEMA_UNSAFE,
        `Missing legacy generated DRAFT column ${TABLE_NAME}.${columnName}.`,
      );
    }
  }
}

async function readDiagnostics(queryRunner) {
  const entries = await Promise.all(
    Object.entries(DIAGNOSTIC_QUERIES).map(async ([name, sql]) => [
      name,
      readCount(await queryRunner(sql)),
    ]),
  );
  const draftAcrossUnits = await queryRunner(`
    SELECT COUNT(*) total FROM (
      SELECT student_person_id, student_profile_id
      FROM enrollments
      WHERE unit_id IS NOT NULL AND status = 'DRAFT' AND deleted_at IS NULL
      GROUP BY student_person_id, student_profile_id
      HAVING COUNT(DISTINCT unit_id) > 1
    ) cross_unit
  `);
  return Object.freeze({
    ...Object.fromEntries(entries),
    draftDuplicateGroupsAcrossUnits: readCount(draftAcrossUnits),
  });
}

function assertSafeDiagnostics(diagnostics) {
  const blockers = [
    "activeDuplicateGroups",
    "currentConflictGroups",
    "draftDuplicateGroups",
    "incompleteModernOwnership",
    "orphanOwnership",
    "orphanUnits",
  ].filter((name) => diagnostics[name] > 0);
  if (blockers.length > 0) {
    throw migrationError(
      ERROR_CODES.DATA_UNSAFE,
      `Enrollment data requires assisted review before migration: ${blockers.join(", ")}.`,
      diagnostics,
    );
  }
}

async function ensureUnitAwareDraftIndex(queryRunner) {
  const expected = [DRAFT_UNIT_COLUMN, DRAFT_STUDENT_PERSON_COLUMN, DRAFT_STUDENT_PROFILE_COLUMN];
  const existing = await readIndex(queryRunner, OLD_DRAFT_INDEX);
  if (existing && existing.columns.join(",") === expected.join(",") && existing.nonUnique === 0) {
    return;
  }
  if (existing) {
    const legacy = [DRAFT_STUDENT_PERSON_COLUMN, DRAFT_STUDENT_PROFILE_COLUMN];
    if (existing.nonUnique !== 0 || existing.columns.join(",") !== legacy.join(",")) {
      throw migrationError(ERROR_CODES.SCHEMA_UNSAFE, `Incompatible ${OLD_DRAFT_INDEX}.`);
    }
    await queryRunner(DROP_OLD_DRAFT_INDEX_SQL);
  }
  await queryRunner(ADD_UNIT_DRAFT_INDEX_SQL);
}

async function ensureGeneratedColumn(queryRunner, columnName, sql) {
  const existing = await readColumn(queryRunner, columnName);
  if (existing) {
    if (
      !String(existing.EXTRA ?? "")
        .toUpperCase()
        .includes("GENERATED")
    ) {
      throw migrationError(
        ERROR_CODES.SCHEMA_UNSAFE,
        `Incompatible generated column ${columnName}.`,
      );
    }
    return;
  }
  await queryRunner(sql);
}

async function ensureIndex(queryRunner, indexName, columns, sql) {
  const existing = await readIndex(queryRunner, indexName);
  if (existing) {
    if (existing.nonUnique !== 0 || existing.columns.join(",") !== columns.join(",")) {
      throw migrationError(ERROR_CODES.SCHEMA_UNSAFE, `Incompatible index ${indexName}.`);
    }
    return;
  }
  await queryRunner(sql);
}

async function readColumn(queryRunner, columnName) {
  return readTableColumn(queryRunner, TABLE_NAME, columnName);
}

async function readTableColumn(queryRunner, tableName, columnName) {
  const rows = await queryRunner(
    "SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,EXTRA,GENERATION_EXPRESSION FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=? LIMIT 1",
    [tableName, columnName],
  );
  return rows?.[0] ?? null;
}

async function readIndex(queryRunner, indexName) {
  const rows = await queryRunner(
    "SELECT INDEX_NAME,NON_UNIQUE,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') columns FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=? GROUP BY INDEX_NAME,NON_UNIQUE",
    [TABLE_NAME, indexName],
  );
  const row = rows?.[0];
  return row
    ? {
        columns: String(row.columns ?? "")
          .split(",")
          .filter(Boolean),
        name: row.INDEX_NAME,
        nonUnique: Number(row.NON_UNIQUE),
      }
    : null;
}

async function readForeignKeys(queryRunner) {
  const rows = await queryRunner(
    "SELECT COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.key_column_usage WHERE table_schema=DATABASE() AND table_name=? AND REFERENCED_TABLE_NAME IS NOT NULL",
    [TABLE_NAME],
  );
  return rows.map((row) => ({
    column: row.COLUMN_NAME,
    referencedColumn: row.REFERENCED_COLUMN_NAME,
    referencedTable: row.REFERENCED_TABLE_NAME,
  }));
}

async function dropIndexIfExists(queryRunner, indexName) {
  if (!(await readIndex(queryRunner, indexName))) return;
  await queryRunner(`ALTER TABLE ${TABLE_NAME} DROP INDEX ${indexName}`);
}

async function dropColumnIfExists(queryRunner, columnName) {
  if (!(await readColumn(queryRunner, columnName))) return;
  await queryRunner(`ALTER TABLE ${TABLE_NAME} DROP COLUMN ${columnName}`);
}

function readCount(rows) {
  const value = Number(rows?.[0]?.total ?? 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function migrationError(code, message, diagnostics = null) {
  const error = new Error(message);
  error.code = code;
  error.diagnostics = diagnostics;
  return error;
}

let defaultMigration;
function getDefaultMigration() {
  if (!defaultMigration) {
    const database = require("../../config/db.js");
    defaultMigration = createEnrollmentMultiunitInvariantMigration({
      queryRunner: database.query,
      tableExists: database.tableExists,
    });
  }
  return defaultMigration;
}

async function main() {
  const command = process.argv[2] || "status";
  const operation = getDefaultMigration()[command];
  if (typeof operation !== "function") throw new Error(`Unknown command: ${command}.`);
  console.log(JSON.stringify(await operation(), null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(
        JSON.stringify({ code: error.code || "MIGRATION_FAILED", message: error.message }),
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      const database = require("../../config/db.js");
      await database.pool?.end?.();
    });
}

module.exports = Object.freeze({
  ADD_CURRENT_STUDENT_PERSON_COLUMN_SQL,
  ADD_CURRENT_STUDENT_PROFILE_COLUMN_SQL,
  ADD_CURRENT_UNIQUE_INDEX_SQL,
  ADD_CURRENT_UNIT_COLUMN_SQL,
  ADD_DRAFT_UNIT_COLUMN_SQL,
  ADD_UNIT_DRAFT_INDEX_SQL,
  CURRENT_STUDENT_PERSON_COLUMN,
  CURRENT_STUDENT_PROFILE_COLUMN,
  CURRENT_UNIQUE_INDEX,
  CURRENT_UNIT_COLUMN,
  DIAGNOSTIC_QUERIES,
  DRAFT_UNIT_COLUMN,
  ERROR_CODES,
  OLD_DRAFT_INDEX,
  createEnrollmentMultiunitInvariantMigration,
  readDiagnostics,
});
