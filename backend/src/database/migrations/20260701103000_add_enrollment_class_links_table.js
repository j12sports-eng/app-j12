#!/usr/bin/env node

/**
 * Sprint 10.3 - Add/validate the structural table for Enrollment -> Turma links.
 *
 * Manual execution only. Do not run from build, startup or deploy scripts.
 *
 * Usage:
 *   node backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js status
 *   node backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js up
 *   node backend/src/database/migrations/20260701103000_add_enrollment_class_links_table.js down
 */

const { pool, query, tableExists } = require("../../config/db.js");

const TABLE_NAME = "enrollment_class_links";
const ENROLLMENTS_TABLE_NAME = "enrollments";
const CLASS_TABLE_NAME = "j12_turmas";
const ACTIVE_LINK_UNIQUE_INDEX = "ux_enrollment_class_links_active";
const ENROLLMENT_FK = "fk_enrollment_class_links_enrollment";
const CLASS_FK = "fk_enrollment_class_links_class";

const REQUIRED_BASE_COLUMNS = Object.freeze({
  class_id: "integer",
  created_at: "datetime",
  enrollment_id: "varchar(64)",
  id: "varchar(64)",
  linked_at: "datetime",
  linked_by: "varchar(191)",
  status: "varchar(32)",
  unlinked_at: "datetime",
  unlinked_by: "varchar(191)",
  updated_at: "datetime",
});

const SAFE_EXTENSION_COLUMNS = Object.freeze({
  metadata_json: "LONGTEXT NULL",
  origin: "VARCHAR(50) NOT NULL DEFAULT 'MANUAL'",
});

const REQUIRED_INDEXES = Object.freeze({
  idx_enrollment_class_links_class_id: "class_id",
  idx_enrollment_class_links_enrollment_id: "enrollment_id",
  idx_enrollment_class_links_status: "status",
  [ACTIVE_LINK_UNIQUE_INDEX]: "enrollment_id,class_id,status",
});

async function up() {
  const prerequisites = await assertPrerequisites();

  if (await tableExists(TABLE_NAME)) {
    console.log(`SKIP_TABLE_EXISTS=${TABLE_NAME}`);
  } else {
    await query(buildCreateTableSql(prerequisites.classIdColumnType));
    console.log(`CREATED_TABLE=${TABLE_NAME}`);
  }

  await addSafeExtensionColumnsIfMissing();
  await assertEnrollmentClassLinksTable();

  const state = await readState();
  printState(state);
  console.log("ENROLLMENT_CLASS_LINK_TABLE_CREATED=true");
  console.log("FOREIGN_KEYS_CREATED=true");
  console.log("INDEXES_CREATED=true");
  console.log("UNIQUE_STRATEGY_DEFINED=true");
}

async function down() {
  if (!(await tableExists(TABLE_NAME))) {
    console.log(`SKIP_TABLE_MISSING=${TABLE_NAME}`);
    return;
  }

  const rowCount = await countRows(TABLE_NAME);

  if (rowCount > 0) {
    throw new Error(
      `Refusing to drop ${TABLE_NAME}: table contains ${rowCount} row(s). Remove data through an approved rollback plan first.`,
    );
  }

  await query(`DROP TABLE ${TABLE_NAME}`);
  console.log(`DROPPED_TABLE=${TABLE_NAME}`);
}

async function status() {
  const state = await readState();
  printState(state);
  console.log(`ENROLLMENT_CLASS_LINK_TABLE_CREATED=${state.tableExists}`);
  console.log(`FOREIGN_KEYS_CREATED=${state.foreignKeysCreated}`);
  console.log(`INDEXES_CREATED=${state.indexesCreated}`);
  console.log(`UNIQUE_STRATEGY_DEFINED=${state.uniqueStrategyDefined}`);
}

async function assertPrerequisites() {
  for (const tableName of [ENROLLMENTS_TABLE_NAME, CLASS_TABLE_NAME]) {
    if (!(await tableExists(tableName))) {
      throw new Error(`Missing required table ${tableName}.`);
    }

    const tableInfo = await readTableInfo(tableName);

    if (String(tableInfo?.ENGINE ?? "").toLowerCase() !== "innodb") {
      throw new Error(`Table ${tableName} must use InnoDB for foreign keys.`);
    }
  }

  const enrollmentIdColumn = await readColumn(ENROLLMENTS_TABLE_NAME, "id");
  const classIdColumn = await readColumn(CLASS_TABLE_NAME, "id");

  if (!enrollmentIdColumn) {
    throw new Error(`Missing required column ${ENROLLMENTS_TABLE_NAME}.id.`);
  }

  if (!classIdColumn) {
    throw new Error(`Missing required column ${CLASS_TABLE_NAME}.id.`);
  }

  assertColumnType(ENROLLMENTS_TABLE_NAME, enrollmentIdColumn, "varchar(64)");
  assertColumnType(CLASS_TABLE_NAME, classIdColumn, "integer");

  return {
    classIdColumnType: String(classIdColumn.COLUMN_TYPE).toUpperCase(),
  };
}

async function addSafeExtensionColumnsIfMissing() {
  if (!(await tableExists(TABLE_NAME))) {
    return;
  }

  for (const [columnName, definition] of Object.entries(SAFE_EXTENSION_COLUMNS)) {
    const column = await readColumn(TABLE_NAME, columnName);

    if (column) {
      console.log(`SKIP_COLUMN_EXISTS=${columnName}`);
      continue;
    }

    await query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN ${columnName} ${definition}`);
    console.log(`CREATED_COLUMN=${columnName}`);
  }
}

async function assertEnrollmentClassLinksTable() {
  if (!(await tableExists(TABLE_NAME))) {
    throw new Error(`Table ${TABLE_NAME} was not created.`);
  }

  const tableInfo = await readTableInfo(TABLE_NAME);

  if (String(tableInfo?.ENGINE ?? "").toLowerCase() !== "innodb") {
    throw new Error(`Table ${TABLE_NAME} must use InnoDB.`);
  }

  const expectedColumns = {
    ...REQUIRED_BASE_COLUMNS,
    metadata_json: "longtext",
    origin: "varchar(50)",
  };
  const columns = await readColumns(TABLE_NAME, Object.keys(expectedColumns));
  const byName = new Map(columns.map((column) => [column.COLUMN_NAME, column]));

  for (const [columnName, expectedType] of Object.entries(expectedColumns)) {
    const column = byName.get(columnName);

    if (!column) {
      throw new Error(`Missing required column ${TABLE_NAME}.${columnName}.`);
    }

    assertColumnType(TABLE_NAME, column, expectedType);
  }

  const indexes = await readIndexes(TABLE_NAME, Object.keys(REQUIRED_INDEXES));

  if (!hasRequiredIndexes(indexes)) {
    throw new Error(`Missing required indexes on ${TABLE_NAME}.`);
  }

  if (!hasRequiredUniqueStrategy(indexes)) {
    throw new Error(`Missing unique strategy for active Enrollment -> Turma links.`);
  }

  const foreignKeys = await readForeignKeys(TABLE_NAME);

  if (!hasForeignKeys(foreignKeys)) {
    throw new Error(`Missing required foreign keys on ${TABLE_NAME}.`);
  }
}

async function readState() {
  const versionRows = await query("SELECT VERSION() AS version, @@version_comment AS versionComment");
  const linkTableInfo = await readTableInfo(TABLE_NAME);
  const enrollmentTableInfo = await readTableInfo(ENROLLMENTS_TABLE_NAME);
  const classTableInfo = await readTableInfo(CLASS_TABLE_NAME);
  const tableCreated = Boolean(linkTableInfo);
  const expectedColumns = [
    ...Object.keys(REQUIRED_BASE_COLUMNS),
    ...Object.keys(SAFE_EXTENSION_COLUMNS),
  ];
  const [columns, indexes, foreignKeys, rowCountRows] = tableCreated
    ? await Promise.all([
        readColumns(TABLE_NAME, expectedColumns),
        readIndexes(TABLE_NAME, Object.keys(REQUIRED_INDEXES)),
        readForeignKeys(TABLE_NAME),
        query(`SELECT COUNT(*) AS total FROM ${TABLE_NAME}`),
      ])
    : [[], [], [], [{ total: 0 }]];

  return {
    classTable: {
      charset: classTableInfo?.TABLE_COLLATION ?? null,
      engine: classTableInfo?.ENGINE ?? null,
      name: CLASS_TABLE_NAME,
    },
    columns,
    enrollmentTable: {
      charset: enrollmentTableInfo?.TABLE_COLLATION ?? null,
      engine: enrollmentTableInfo?.ENGINE ?? null,
      name: ENROLLMENTS_TABLE_NAME,
    },
    foreignKeys,
    foreignKeysCreated: hasForeignKeys(foreignKeys),
    indexes,
    indexesCreated: hasRequiredIndexes(indexes),
    rowCount: Number(rowCountRows[0]?.total ?? 0),
    tableExists: tableCreated,
    tableInfo: linkTableInfo,
    uniqueStrategyDefined: hasRequiredUniqueStrategy(indexes),
    version: versionRows[0]?.version ?? null,
    versionComment: versionRows[0]?.versionComment ?? null,
  };
}

function buildCreateTableSql(classIdColumnType) {
  return `
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id VARCHAR(64) NOT NULL,
      enrollment_id VARCHAR(64) NOT NULL,
      class_id ${classIdColumnType} NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
      linked_at DATETIME NULL,
      linked_by VARCHAR(191) NULL,
      unlinked_at DATETIME NULL,
      unlinked_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      origin VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
      metadata_json LONGTEXT NULL,
      PRIMARY KEY (id),
      INDEX idx_enrollment_class_links_enrollment_id (enrollment_id),
      INDEX idx_enrollment_class_links_class_id (class_id),
      INDEX idx_enrollment_class_links_status (status),
      UNIQUE INDEX ${ACTIVE_LINK_UNIQUE_INDEX} (enrollment_id, class_id, status),
      CONSTRAINT ${ENROLLMENT_FK}
        FOREIGN KEY (enrollment_id)
        REFERENCES ${ENROLLMENTS_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      CONSTRAINT ${CLASS_FK}
        FOREIGN KEY (class_id)
        REFERENCES ${CLASS_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
}

async function readTableInfo(tableName) {
  const rows = await query(
    `
      SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
      LIMIT 1
    `,
    [tableName],
  );

  return rows[0] ?? null;
}

async function readColumn(tableName, columnName) {
  const rows = await readColumns(tableName, [columnName]);
  return rows[0] ?? null;
}

async function readColumns(tableName, columnNames) {
  if (!Array.isArray(columnNames) || columnNames.length === 0) return [];

  const placeholders = columnNames.map(() => "?").join(", ");

  return query(
    `
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, GENERATION_EXPRESSION
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND COLUMN_NAME IN (${placeholders})
      ORDER BY ORDINAL_POSITION
    `,
    [tableName, ...columnNames],
  );
}

async function readIndexes(tableName, indexNames) {
  if (!Array.isArray(indexNames) || indexNames.length === 0) return [];

  const placeholders = indexNames.map(() => "?").join(", ");

  return query(
    `
      SELECT INDEX_NAME, NON_UNIQUE,
             GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND INDEX_NAME IN (${placeholders})
      GROUP BY INDEX_NAME, NON_UNIQUE
      ORDER BY INDEX_NAME
    `,
    [tableName, ...indexNames],
  );
}

async function readForeignKeys(tableName) {
  return query(
    `
      SELECT
        kcu.CONSTRAINT_NAME,
        kcu.COLUMN_NAME,
        kcu.REFERENCED_TABLE_NAME,
        kcu.REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE kcu
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = ?
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
    `,
    [tableName],
  );
}

async function countRows(tableName) {
  const rows = await query(`SELECT COUNT(*) AS total FROM ${tableName}`);
  return Number(rows[0]?.total ?? 0);
}

function hasRequiredIndexes(indexes) {
  const byName = new Map((indexes || []).map((index) => [index.INDEX_NAME, index]));

  return ["idx_enrollment_class_links_enrollment_id", "idx_enrollment_class_links_class_id", "idx_enrollment_class_links_status"]
    .every((indexName) => {
      const index = byName.get(indexName);
      return index && String(index.columns ?? "") === REQUIRED_INDEXES[indexName];
    });
}

function hasRequiredUniqueStrategy(indexes) {
  const index = (indexes || []).find((item) => item.INDEX_NAME === ACTIVE_LINK_UNIQUE_INDEX);

  return Boolean(
    index &&
      Number(index.NON_UNIQUE) === 0 &&
      String(index.columns ?? "") === REQUIRED_INDEXES[ACTIVE_LINK_UNIQUE_INDEX],
  );
}

function hasForeignKeys(foreignKeys) {
  const byName = new Map((foreignKeys || []).map((fk) => [fk.CONSTRAINT_NAME, fk]));
  const enrollmentFk = byName.get(ENROLLMENT_FK);
  const classFk = byName.get(CLASS_FK);

  return Boolean(
    enrollmentFk &&
      enrollmentFk.COLUMN_NAME === "enrollment_id" &&
      enrollmentFk.REFERENCED_TABLE_NAME === ENROLLMENTS_TABLE_NAME &&
      enrollmentFk.REFERENCED_COLUMN_NAME === "id" &&
      classFk &&
      classFk.COLUMN_NAME === "class_id" &&
      classFk.REFERENCED_TABLE_NAME === CLASS_TABLE_NAME &&
      classFk.REFERENCED_COLUMN_NAME === "id",
  );
}

function assertColumnType(tableName, column, expectedType) {
  const actualType = String(column?.COLUMN_TYPE ?? "").toLowerCase();

  if (expectedType === "integer") {
    if (!actualType.startsWith("int") && !actualType.startsWith("bigint")) {
      throw new Error(
        `Unexpected type for ${tableName}.${column?.COLUMN_NAME}: ${column?.COLUMN_TYPE}; expected int/bigint.`,
      );
    }
    return;
  }

  if (actualType !== expectedType) {
    throw new Error(
      `Unexpected type for ${tableName}.${column?.COLUMN_NAME}: ${column?.COLUMN_TYPE}; expected ${expectedType}.`,
    );
  }
}

function printState(state) {
  console.log(JSON.stringify(state, null, 2));
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
  ACTIVE_LINK_UNIQUE_INDEX,
  CLASS_FK,
  CLASS_TABLE_NAME,
  ENROLLMENT_FK,
  ENROLLMENTS_TABLE_NAME,
  REQUIRED_INDEXES,
  TABLE_NAME,
  assertEnrollmentClassLinksTable,
  buildCreateTableSql,
  down,
  readState,
  status,
  up,
};
