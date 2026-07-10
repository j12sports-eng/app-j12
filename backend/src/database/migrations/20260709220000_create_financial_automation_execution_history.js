#!/usr/bin/env node

/**
 * Sprint 20.13A - Append-only financial automation execution history.
 * Manual execution only. Never runs from application startup or build.
 */

const { pool, query, tableExists } = require("../../config/db.js");

const TABLE_NAME = "financial_automation_execution_history";
const INDEXES = Object.freeze({
  idx_fah_automation: "automation_name",
  idx_fah_correlation: "correlation_id",
  idx_fah_execution: "execution_id",
  idx_fah_started: "started_at",
  idx_fah_status: "status",
  idx_fah_workflow: "workflow_name",
});
const REQUIRED_COLUMNS = Object.freeze({
  attempt: "int",
  automation_name: "varchar(120)",
  correlation_id: "varchar(191)",
  created_at: "datetime",
  duration_ms: "bigint",
  error_json: "longtext",
  execution_id: "varchar(191)",
  finished_at: "datetime",
  id: "varchar(64)",
  input_json: "longtext",
  metadata_json: "longtext",
  output_json: "longtext",
  started_at: "datetime",
  status: "varchar(32)",
  trigger_type: "varchar(80)",
  workflow_name: "varchar(120)",
});

async function up() {
  if (await tableExists(TABLE_NAME)) console.log(`SKIP_TABLE_EXISTS=${TABLE_NAME}`);
  else {
    await query(buildCreateTableSql());
    console.log(`CREATED_TABLE=${TABLE_NAME}`);
  }
  await assertTable();
  const state = await readState();
  printState(state);
  console.log(`FINANCIAL_AUTOMATION_HISTORY_TABLE_CREATED=${state.tableExists}`);
  console.log(`FINANCIAL_AUTOMATION_HISTORY_INDEXES_CREATED=${state.indexesCreated}`);
}

async function down() {
  if (!(await tableExists(TABLE_NAME))) {
    console.log(`SKIP_TABLE_MISSING=${TABLE_NAME}`);
    return;
  }
  const rows = await query(`SELECT COUNT(*) AS total FROM ${TABLE_NAME}`);
  const total = Number(rows[0]?.total || 0);
  if (total > 0) {
    throw new Error(`Refusing to drop ${TABLE_NAME}: table contains ${total} row(s).`);
  }
  await query(`DROP TABLE ${TABLE_NAME}`);
  console.log(`DROPPED_TABLE=${TABLE_NAME}`);
}

async function status() {
  const state = await readState();
  printState(state);
  console.log(`FINANCIAL_AUTOMATION_HISTORY_TABLE_CREATED=${state.tableExists}`);
  console.log(`FINANCIAL_AUTOMATION_HISTORY_INDEXES_CREATED=${state.indexesCreated}`);
}

function buildCreateTableSql() {
  return `
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id VARCHAR(64) NOT NULL,
      execution_id VARCHAR(191) NOT NULL,
      automation_name VARCHAR(120) NOT NULL,
      workflow_name VARCHAR(120) NULL,
      trigger_type VARCHAR(80) NULL,
      status VARCHAR(32) NOT NULL,
      started_at DATETIME NOT NULL,
      finished_at DATETIME NULL,
      duration_ms BIGINT UNSIGNED NULL,
      attempt INT UNSIGNED NOT NULL DEFAULT 1,
      correlation_id VARCHAR(191) NULL,
      input_json LONGTEXT NULL,
      output_json LONGTEXT NULL,
      error_json LONGTEXT NULL,
      metadata_json LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_fah_execution (execution_id),
      INDEX idx_fah_automation (automation_name),
      INDEX idx_fah_workflow (workflow_name),
      INDEX idx_fah_status (status),
      INDEX idx_fah_correlation (correlation_id),
      INDEX idx_fah_started (started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
}

async function assertTable() {
  const state = await readState();
  if (!state.tableExists) throw new Error(`${TABLE_NAME} was not created.`);
  if (String(state.tableInfo?.ENGINE || "").toLowerCase() !== "innodb") {
    throw new Error(`${TABLE_NAME} must use InnoDB.`);
  }
  const byName = new Map(state.columns.map((column) => [column.COLUMN_NAME, column]));
  for (const [name, expected] of Object.entries(REQUIRED_COLUMNS)) {
    const column = byName.get(name);
    const actual = String(column?.COLUMN_TYPE || "")
      .toLowerCase()
      .replace(" unsigned", "");
    if (!column || actual !== expected)
      throw new Error(
        `Unexpected column ${TABLE_NAME}.${name}: ${column?.COLUMN_TYPE || "missing"}.`,
      );
  }
  if (!state.indexesCreated) throw new Error(`Required indexes are missing from ${TABLE_NAME}.`);
}

async function readState() {
  if (!(await tableExists(TABLE_NAME))) {
    return { columns: [], indexes: [], indexesCreated: false, tableExists: false, tableInfo: null };
  }
  const [tableRows, columns, indexes] = await Promise.all([
    query(
      "SELECT TABLE_NAME, ENGINE, TABLE_COLLATION FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
      [TABLE_NAME],
    ),
    query(
      "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ORDINAL_POSITION",
      [TABLE_NAME],
    ),
    query(
      "SELECT INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? GROUP BY INDEX_NAME, NON_UNIQUE ORDER BY INDEX_NAME",
      [TABLE_NAME],
    ),
  ]);
  const indexMap = new Map(indexes.map((index) => [index.INDEX_NAME, String(index.columns)]));
  return {
    columns,
    indexes,
    indexesCreated: Object.entries(INDEXES).every(
      ([name, columnsValue]) => indexMap.get(name) === columnsValue,
    ),
    tableExists: true,
    tableInfo: tableRows[0] || null,
  };
}

function printState(state) {
  console.log(JSON.stringify(state, null, 2));
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
      if (pool && typeof pool.end === "function") await pool.end();
      process.exit(process.exitCode || 0);
    });
}

module.exports = {
  INDEXES,
  REQUIRED_COLUMNS,
  TABLE_NAME,
  assertTable,
  buildCreateTableSql,
  down,
  readState,
  status,
  up,
};
