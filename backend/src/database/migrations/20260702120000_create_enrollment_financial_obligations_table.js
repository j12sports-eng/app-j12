#!/usr/bin/env node

/**
 * Sprint 12.5 - Create the idempotency table for Enrollment financial
 * obligations.
 *
 * Manual execution only. Do not run from build, startup or deploy scripts.
 *
 * Usage:
 *   node backend/src/database/migrations/20260702120000_create_enrollment_financial_obligations_table.js status
 *   node backend/src/database/migrations/20260702120000_create_enrollment_financial_obligations_table.js up
 *   node backend/src/database/migrations/20260702120000_create_enrollment_financial_obligations_table.js down
 */

const { pool, query, tableExists } = require("../../config/db.js");

const TABLE_NAME = "enrollment_financial_obligations";
const ENROLLMENTS_TABLE_NAME = "enrollments";
const ENROLLMENT_OBLIGATION_UNIQUE_INDEX =
  "ux_enrollment_financial_obligations_enrollment_type";
const ENROLLMENT_INDEX = "idx_enrollment_financial_obligations_enrollment_id";
const STATUS_INDEX = "idx_enrollment_financial_obligations_status";
const DUE_DATE_INDEX = "idx_enrollment_financial_obligations_due_date";
const ENROLLMENT_FK = "fk_enrollment_financial_obligations_enrollment";

const REQUIRED_BASE_COLUMNS = Object.freeze({
  amount: "decimal(12,2)",
  cancelled_at: "datetime",
  cancelled_by: "varchar(191)",
  created_at: "datetime",
  created_by: "varchar(191)",
  currency: "varchar(3)",
  due_date: "date",
  enrollment_id: "varchar(64)",
  id: "varchar(64)",
  metadata_json: "longtext",
  obligation_type: "varchar(64)",
  plan_id: "varchar(64)",
  source: "varchar(50)",
  status: "varchar(32)",
  updated_at: "datetime",
});

const REQUIRED_INDEXES = Object.freeze({
  [DUE_DATE_INDEX]: "due_date",
  [ENROLLMENT_INDEX]: "enrollment_id",
  [ENROLLMENT_OBLIGATION_UNIQUE_INDEX]: "enrollment_id,obligation_type",
  [STATUS_INDEX]: "status",
});

async function up() {
  await assertPrerequisites();

  if (await tableExists(TABLE_NAME)) {
    console.log(`SKIP_TABLE_EXISTS=${TABLE_NAME}`);
  } else {
    await query(buildCreateTableSql());
    console.log(`CREATED_TABLE=${TABLE_NAME}`);
  }

  await assertEnrollmentFinancialObligationsTable();

  const state = await readState();
  printState(state);
  console.log("ENROLLMENT_FINANCIAL_OBLIGATION_TABLE_CREATED=true");
  console.log(`ENROLLMENT_FINANCIAL_OBLIGATION_FK_CREATED=${state.foreignKeyCreated}`);
  console.log(`ENROLLMENT_OBLIGATION_UNIQUE_INDEX_CREATED=${state.uniqueIndexCreated}`);
  console.log("NO_REAL_CHARGE_CREATED=true");
  console.log("NO_REAL_INSTALLMENT_CREATED=true");
  console.log("NO_PAYMENT_CREATED=true");
  console.log("NO_GATEWAY_INTEGRATION=true");
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
  console.log(`ENROLLMENT_FINANCIAL_OBLIGATION_TABLE_CREATED=${state.tableExists}`);
  console.log(`ENROLLMENT_FINANCIAL_OBLIGATION_FK_CREATED=${state.foreignKeyCreated}`);
  console.log(`ENROLLMENT_OBLIGATION_UNIQUE_INDEX_CREATED=${state.uniqueIndexCreated}`);
}

async function assertPrerequisites() {
  if (!(await tableExists(ENROLLMENTS_TABLE_NAME))) {
    throw new Error(`Missing required table ${ENROLLMENTS_TABLE_NAME}.`);
  }

  const tableInfo = await readTableInfo(ENROLLMENTS_TABLE_NAME);

  if (String(tableInfo?.ENGINE ?? "").toLowerCase() !== "innodb") {
    throw new Error(`Table ${ENROLLMENTS_TABLE_NAME} must use InnoDB for foreign keys.`);
  }

  const enrollmentIdColumn = await readColumn(ENROLLMENTS_TABLE_NAME, "id");

  if (!enrollmentIdColumn) {
    throw new Error(`Missing required column ${ENROLLMENTS_TABLE_NAME}.id.`);
  }

  assertColumnType(ENROLLMENTS_TABLE_NAME, enrollmentIdColumn, "varchar(64)");
}

async function assertEnrollmentFinancialObligationsTable() {
  if (!(await tableExists(TABLE_NAME))) {
    throw new Error(`Table ${TABLE_NAME} was not created.`);
  }

  const tableInfo = await readTableInfo(TABLE_NAME);

  if (String(tableInfo?.ENGINE ?? "").toLowerCase() !== "innodb") {
    throw new Error(`Table ${TABLE_NAME} must use InnoDB.`);
  }

  const columns = await readColumns(TABLE_NAME, Object.keys(REQUIRED_BASE_COLUMNS));
  const byName = new Map(columns.map((column) => [column.COLUMN_NAME, column]));

  for (const [columnName, expectedType] of Object.entries(REQUIRED_BASE_COLUMNS)) {
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

  if (!hasRequiredUniqueIndex(indexes)) {
    throw new Error(`Missing unique index for Enrollment financial obligations.`);
  }

  const foreignKeys = await readForeignKeys(TABLE_NAME);

  if (!hasEnrollmentForeignKey(foreignKeys)) {
    throw new Error(`Missing required foreign key ${ENROLLMENT_FK}.`);
  }
}

async function readState() {
  const versionRows = await query("SELECT VERSION() AS version, @@version_comment AS versionComment");
  const tableInfo = await readTableInfo(TABLE_NAME);
  const enrollmentTableInfo = await readTableInfo(ENROLLMENTS_TABLE_NAME);
  const tableCreated = Boolean(tableInfo);
  const [columns, indexes, foreignKeys, rowCountRows] = tableCreated
    ? await Promise.all([
        readColumns(TABLE_NAME, Object.keys(REQUIRED_BASE_COLUMNS)),
        readIndexes(TABLE_NAME, Object.keys(REQUIRED_INDEXES)),
        readForeignKeys(TABLE_NAME),
        query(`SELECT COUNT(*) AS total FROM ${TABLE_NAME}`),
      ])
    : [[], [], [], [{ total: 0 }]];

  return {
    columns,
    enrollmentTable: {
      charset: enrollmentTableInfo?.TABLE_COLLATION ?? null,
      engine: enrollmentTableInfo?.ENGINE ?? null,
      name: ENROLLMENTS_TABLE_NAME,
    },
    foreignKeyCreated: hasEnrollmentForeignKey(foreignKeys),
    foreignKeys,
    indexes,
    indexesCreated: hasRequiredIndexes(indexes),
    rowCount: Number(rowCountRows[0]?.total ?? 0),
    tableExists: tableCreated,
    tableInfo,
    uniqueIndexCreated: hasRequiredUniqueIndex(indexes),
    version: versionRows[0]?.version ?? null,
    versionComment: versionRows[0]?.versionComment ?? null,
  };
}

function buildCreateTableSql() {
  return `
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id VARCHAR(64) NOT NULL,
      enrollment_id VARCHAR(64) NOT NULL,
      obligation_type VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PREPARED',
      amount DECIMAL(12,2) NULL,
      currency VARCHAR(3) NULL,
      plan_id VARCHAR(64) NULL,
      due_date DATE NULL,
      source VARCHAR(50) NOT NULL DEFAULT 'ENROLLMENT',
      created_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      cancelled_at DATETIME NULL,
      cancelled_by VARCHAR(191) NULL,
      metadata_json LONGTEXT NULL,
      PRIMARY KEY (id),
      INDEX ${ENROLLMENT_INDEX} (enrollment_id),
      INDEX ${STATUS_INDEX} (status),
      INDEX ${DUE_DATE_INDEX} (due_date),
      UNIQUE INDEX ${ENROLLMENT_OBLIGATION_UNIQUE_INDEX} (enrollment_id, obligation_type),
      CONSTRAINT ${ENROLLMENT_FK}
        FOREIGN KEY (enrollment_id)
        REFERENCES ${ENROLLMENTS_TABLE_NAME} (id)
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
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
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

  return [ENROLLMENT_INDEX, STATUS_INDEX, DUE_DATE_INDEX].every((indexName) => {
    const index = byName.get(indexName);
    return index && String(index.columns ?? "") === REQUIRED_INDEXES[indexName];
  });
}

function hasRequiredUniqueIndex(indexes) {
  const index = (indexes || []).find(
    (item) => item.INDEX_NAME === ENROLLMENT_OBLIGATION_UNIQUE_INDEX,
  );

  return Boolean(
    index &&
      Number(index.NON_UNIQUE) === 0 &&
      String(index.columns ?? "") === REQUIRED_INDEXES[ENROLLMENT_OBLIGATION_UNIQUE_INDEX],
  );
}

function hasEnrollmentForeignKey(foreignKeys) {
  const fk = (foreignKeys || []).find((item) => item.CONSTRAINT_NAME === ENROLLMENT_FK);

  return Boolean(
    fk &&
      fk.COLUMN_NAME === "enrollment_id" &&
      fk.REFERENCED_TABLE_NAME === ENROLLMENTS_TABLE_NAME &&
      fk.REFERENCED_COLUMN_NAME === "id",
  );
}

function assertColumnType(tableName, column, expectedType) {
  const actualType = String(column?.COLUMN_TYPE ?? "").toLowerCase();

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
  DUE_DATE_INDEX,
  ENROLLMENTS_TABLE_NAME,
  ENROLLMENT_FK,
  ENROLLMENT_INDEX,
  ENROLLMENT_OBLIGATION_UNIQUE_INDEX,
  REQUIRED_BASE_COLUMNS,
  REQUIRED_INDEXES,
  STATUS_INDEX,
  TABLE_NAME,
  assertEnrollmentFinancialObligationsTable,
  buildCreateTableSql,
  down,
  hasEnrollmentForeignKey,
  hasRequiredUniqueIndex,
  readState,
  status,
  up,
};
