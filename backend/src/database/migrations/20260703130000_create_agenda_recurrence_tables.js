#!/usr/bin/env node

/**
 * Sprint 13.12 - Agenda recurrence persistence.
 *
 * Manual execution only. Do not run from build, startup or deploy scripts.
 *
 * Usage:
 *   node backend/src/database/migrations/20260703130000_create_agenda_recurrence_tables.js status
 *   node backend/src/database/migrations/20260703130000_create_agenda_recurrence_tables.js up
 *   node backend/src/database/migrations/20260703130000_create_agenda_recurrence_tables.js down
 */

const { pool, query, tableExists } = require("../../config/db.js");

const SERIES_TABLE_NAME = "agenda_recurrence_series";
const EXCEPTIONS_TABLE_NAME = "agenda_recurrence_exceptions";
const HISTORY_TABLE_NAME = "agenda_recurrence_history";
const AGENDA_ITEMS_TABLE_NAME = "enrollment_agenda_items";
const ENROLLMENTS_TABLE_NAME = "enrollments";
const CLASS_TABLE_NAME = "j12_turmas";

const SERIES_IDEMPOTENCY_INDEX = "ux_agenda_recurrence_series_idempotency";
const SERIES_AGENDA_ITEM_INDEX = "idx_agenda_recurrence_series_agenda_item";
const SERIES_ENROLLMENT_INDEX = "idx_agenda_recurrence_series_enrollment";
const SERIES_CLASS_INDEX = "idx_agenda_recurrence_series_class";
const SERIES_STATUS_INDEX = "idx_agenda_recurrence_series_status";
const EXCEPTION_OCCURRENCE_INDEX = "ux_agenda_recurrence_exceptions_occurrence";
const EXCEPTION_SERIES_INDEX = "idx_agenda_recurrence_exceptions_series";
const HISTORY_SERIES_INDEX = "idx_agenda_recurrence_history_series";

const SERIES_AGENDA_ITEM_FK = "fk_agenda_recurrence_series_agenda_item";
const SERIES_PARENT_FK = "fk_agenda_recurrence_series_parent";
const SERIES_ENROLLMENT_FK = "fk_agenda_recurrence_series_enrollment";
const SERIES_CLASS_FK = "fk_agenda_recurrence_series_class";
const EXCEPTION_SERIES_FK = "fk_agenda_recurrence_exceptions_series";
const HISTORY_SERIES_FK = "fk_agenda_recurrence_history_series";
const HISTORY_EXCEPTION_FK = "fk_agenda_recurrence_history_exception";

const REQUIRED_TABLES = [
  SERIES_TABLE_NAME,
  EXCEPTIONS_TABLE_NAME,
  HISTORY_TABLE_NAME,
];

async function up() {
  const prerequisites = await assertPrerequisites();

  if (!(await tableExists(SERIES_TABLE_NAME))) {
    await query(buildCreateSeriesTableSql(prerequisites.classIdColumnType));
    console.log(`CREATED_TABLE=${SERIES_TABLE_NAME}`);
  } else {
    console.log(`SKIP_TABLE_EXISTS=${SERIES_TABLE_NAME}`);
  }

  if (!(await tableExists(EXCEPTIONS_TABLE_NAME))) {
    await query(buildCreateExceptionsTableSql());
    console.log(`CREATED_TABLE=${EXCEPTIONS_TABLE_NAME}`);
  } else {
    console.log(`SKIP_TABLE_EXISTS=${EXCEPTIONS_TABLE_NAME}`);
  }

  if (!(await tableExists(HISTORY_TABLE_NAME))) {
    await query(buildCreateHistoryTableSql());
    console.log(`CREATED_TABLE=${HISTORY_TABLE_NAME}`);
  } else {
    console.log(`SKIP_TABLE_EXISTS=${HISTORY_TABLE_NAME}`);
  }

  const state = await readState();
  printState(state);
  console.log(`AGENDA_RECURRENCE_SERIES_CREATED=${state.seriesTableExists}`);
  console.log(`AGENDA_RECURRENCE_EXCEPTIONS_CREATED=${state.exceptionsTableExists}`);
  console.log(`AGENDA_RECURRENCE_HISTORY_CREATED=${state.historyTableExists}`);
  console.log(`AGENDA_RECURRENCE_FKS_CREATED=${state.foreignKeysCreated}`);
  console.log(`AGENDA_RECURRENCE_UNIQUE_KEYS_CREATED=${state.uniqueKeysCreated}`);
  console.log("NO_ATTENDANCE_CREATED=true");
  console.log("NO_FINANCIAL_SIDE_EFFECTS=true");
  console.log("NO_NOTIFICATION_SIDE_EFFECTS=true");
}

async function down() {
  for (const tableName of [HISTORY_TABLE_NAME, EXCEPTIONS_TABLE_NAME, SERIES_TABLE_NAME]) {
    if (!(await tableExists(tableName))) {
      console.log(`SKIP_TABLE_MISSING=${tableName}`);
      continue;
    }

    const rowCount = await countRows(tableName);

    if (rowCount > 0) {
      throw new Error(
        `Refusing to drop ${tableName}: table contains ${rowCount} row(s). Remove data through an approved rollback plan first.`,
      );
    }

    await query(`DROP TABLE ${tableName}`);
    console.log(`DROPPED_TABLE=${tableName}`);
  }
}

async function status() {
  const state = await readState();
  printState(state);
  console.log(`AGENDA_RECURRENCE_SERIES_CREATED=${state.seriesTableExists}`);
  console.log(`AGENDA_RECURRENCE_EXCEPTIONS_CREATED=${state.exceptionsTableExists}`);
  console.log(`AGENDA_RECURRENCE_HISTORY_CREATED=${state.historyTableExists}`);
  console.log(`AGENDA_RECURRENCE_FKS_CREATED=${state.foreignKeysCreated}`);
  console.log(`AGENDA_RECURRENCE_UNIQUE_KEYS_CREATED=${state.uniqueKeysCreated}`);
}

async function assertPrerequisites() {
  for (const tableName of [AGENDA_ITEMS_TABLE_NAME, ENROLLMENTS_TABLE_NAME, CLASS_TABLE_NAME]) {
    if (!(await tableExists(tableName))) {
      throw new Error(`Missing required table ${tableName}.`);
    }

    const tableInfo = await readTableInfo(tableName);

    if (String(tableInfo?.ENGINE ?? "").toLowerCase() !== "innodb") {
      throw new Error(`Table ${tableName} must use InnoDB for foreign keys.`);
    }
  }

  const classIdColumn = await readColumn(CLASS_TABLE_NAME, "id");

  if (!classIdColumn) {
    throw new Error(`Missing required column ${CLASS_TABLE_NAME}.id.`);
  }

  return {
    classIdColumnType: String(classIdColumn.COLUMN_TYPE).toUpperCase(),
  };
}

async function readState() {
  const [seriesInfo, exceptionsInfo, historyInfo] = await Promise.all([
    readTableInfo(SERIES_TABLE_NAME),
    readTableInfo(EXCEPTIONS_TABLE_NAME),
    readTableInfo(HISTORY_TABLE_NAME),
  ]);
  const tableNames = REQUIRED_TABLES.filter((tableName, index) =>
    Boolean([seriesInfo, exceptionsInfo, historyInfo][index]),
  );
  const [indexes, foreignKeys, rowCounts] =
    tableNames.length > 0
      ? await Promise.all([
          readIndexes(tableNames),
          readForeignKeys(tableNames),
          readRowCounts(tableNames),
        ])
      : [[], [], []];

  return {
    exceptionsTableExists: Boolean(exceptionsInfo),
    foreignKeys,
    foreignKeysCreated: hasRequiredForeignKeys(foreignKeys),
    historyTableExists: Boolean(historyInfo),
    indexes,
    rowCounts,
    seriesTableExists: Boolean(seriesInfo),
    uniqueKeysCreated: hasRequiredUniqueKeys(indexes),
  };
}

function buildCreateSeriesTableSql(classIdColumnType) {
  return `
    CREATE TABLE IF NOT EXISTS ${SERIES_TABLE_NAME} (
      id VARCHAR(64) NOT NULL,
      agenda_item_id VARCHAR(64) NULL,
      parent_series_id VARCHAR(64) NULL,
      enrollment_id VARCHAR(64) NULL,
      class_id ${classIdColumnType} NULL,
      class_link_id VARCHAR(64) NULL,
      student_person_id VARCHAR(64) NULL,
      student_profile_id VARCHAR(64) NULL,
      frequency VARCHAR(32) NOT NULL,
      interval_value INT NOT NULL DEFAULT 1,
      interval_unit VARCHAR(16) NOT NULL DEFAULT 'WEEK',
      days_of_week_json LONGTEXT NULL,
      start_date DATE NOT NULL,
      end_date DATE NULL,
      max_occurrences INT NULL,
      start_time VARCHAR(20) NOT NULL,
      end_time VARCHAR(20) NULL,
      timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
      professor_id VARCHAR(64) NULL,
      professor_name VARCHAR(191) NULL,
      court_id VARCHAR(64) NULL,
      court_name VARCHAR(191) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
      source VARCHAR(50) NOT NULL DEFAULT 'AGENDA_ADMIN',
      idempotency_key VARCHAR(191) NOT NULL,
      metadata_json LONGTEXT NULL,
      created_by VARCHAR(191) NULL,
      updated_by VARCHAR(191) NULL,
      cancelled_at DATETIME NULL,
      cancelled_by VARCHAR(191) NULL,
      cancel_reason VARCHAR(500) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE INDEX ${SERIES_IDEMPOTENCY_INDEX} (idempotency_key),
      INDEX ${SERIES_AGENDA_ITEM_INDEX} (agenda_item_id),
      INDEX ${SERIES_ENROLLMENT_INDEX} (enrollment_id),
      INDEX ${SERIES_CLASS_INDEX} (class_id),
      INDEX ${SERIES_STATUS_INDEX} (status),
      CONSTRAINT ${SERIES_AGENDA_ITEM_FK}
        FOREIGN KEY (agenda_item_id)
        REFERENCES ${AGENDA_ITEMS_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      CONSTRAINT ${SERIES_PARENT_FK}
        FOREIGN KEY (parent_series_id)
        REFERENCES ${SERIES_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      CONSTRAINT ${SERIES_ENROLLMENT_FK}
        FOREIGN KEY (enrollment_id)
        REFERENCES ${ENROLLMENTS_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      CONSTRAINT ${SERIES_CLASS_FK}
        FOREIGN KEY (class_id)
        REFERENCES ${CLASS_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
}

function buildCreateExceptionsTableSql() {
  return `
    CREATE TABLE IF NOT EXISTS ${EXCEPTIONS_TABLE_NAME} (
      id VARCHAR(64) NOT NULL,
      series_id VARCHAR(64) NOT NULL,
      occurrence_key VARCHAR(191) NOT NULL,
      occurrence_date DATE NOT NULL,
      occurrence_start_time VARCHAR(20) NULL,
      exception_type VARCHAR(32) NOT NULL,
      override_json LONGTEXT NULL,
      reason VARCHAR(500) NULL,
      created_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE INDEX ${EXCEPTION_OCCURRENCE_INDEX} (series_id, occurrence_key),
      INDEX ${EXCEPTION_SERIES_INDEX} (series_id),
      CONSTRAINT ${EXCEPTION_SERIES_FK}
        FOREIGN KEY (series_id)
        REFERENCES ${SERIES_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
}

function buildCreateHistoryTableSql() {
  return `
    CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE_NAME} (
      id VARCHAR(64) NOT NULL,
      series_id VARCHAR(64) NOT NULL,
      exception_id VARCHAR(64) NULL,
      action VARCHAR(50) NOT NULL,
      scope VARCHAR(32) NULL,
      occurrence_key VARCHAR(191) NULL,
      before_json LONGTEXT NULL,
      after_json LONGTEXT NULL,
      reason VARCHAR(500) NULL,
      created_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX ${HISTORY_SERIES_INDEX} (series_id),
      CONSTRAINT ${HISTORY_SERIES_FK}
        FOREIGN KEY (series_id)
        REFERENCES ${SERIES_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      CONSTRAINT ${HISTORY_EXCEPTION_FK}
        FOREIGN KEY (exception_id)
        REFERENCES ${EXCEPTIONS_TABLE_NAME} (id)
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
  const rows = await query(
    `
      SELECT COLUMN_NAME, COLUMN_TYPE
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName],
  );

  return rows[0] ?? null;
}

async function readIndexes(tableNames) {
  const placeholders = tableNames.map(() => "?").join(", ");

  return query(
    `
      SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE,
             GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name IN (${placeholders})
      GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
      ORDER BY TABLE_NAME, INDEX_NAME
    `,
    tableNames,
  );
}

async function readForeignKeys(tableNames) {
  const placeholders = tableNames.map(() => "?").join(", ");

  return query(
    `
      SELECT
        kcu.TABLE_NAME,
        kcu.CONSTRAINT_NAME,
        kcu.COLUMN_NAME,
        kcu.REFERENCED_TABLE_NAME,
        kcu.REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE kcu
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME IN (${placeholders})
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
    `,
    tableNames,
  );
}

async function readRowCounts(tableNames) {
  const results = [];

  for (const tableName of tableNames) {
    results.push({ tableName, total: await countRows(tableName) });
  }

  return results;
}

async function countRows(tableName) {
  const rows = await query(`SELECT COUNT(*) AS total FROM ${tableName}`);
  return Number(rows[0]?.total ?? 0);
}

function hasRequiredUniqueKeys(indexes) {
  const uniqueIndexes = new Set(
    (indexes || [])
      .filter((index) => Number(index.NON_UNIQUE) === 0)
      .map((index) => `${index.TABLE_NAME}.${index.INDEX_NAME}:${index.columns}`),
  );

  return (
    uniqueIndexes.has(`${SERIES_TABLE_NAME}.${SERIES_IDEMPOTENCY_INDEX}:idempotency_key`) &&
    uniqueIndexes.has(
      `${EXCEPTIONS_TABLE_NAME}.${EXCEPTION_OCCURRENCE_INDEX}:series_id,occurrence_key`,
    )
  );
}

function hasRequiredForeignKeys(foreignKeys) {
  const names = new Set((foreignKeys || []).map((fk) => fk.CONSTRAINT_NAME));

  return [
    SERIES_AGENDA_ITEM_FK,
    SERIES_PARENT_FK,
    SERIES_ENROLLMENT_FK,
    SERIES_CLASS_FK,
    EXCEPTION_SERIES_FK,
    HISTORY_SERIES_FK,
    HISTORY_EXCEPTION_FK,
  ].every((name) => names.has(name));
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
  AGENDA_ITEMS_TABLE_NAME,
  CLASS_TABLE_NAME,
  ENROLLMENTS_TABLE_NAME,
  EXCEPTIONS_TABLE_NAME,
  HISTORY_TABLE_NAME,
  SERIES_TABLE_NAME,
  buildCreateExceptionsTableSql,
  buildCreateHistoryTableSql,
  buildCreateSeriesTableSql,
  down,
  hasRequiredForeignKeys,
  hasRequiredUniqueKeys,
  readState,
  status,
  up,
};
