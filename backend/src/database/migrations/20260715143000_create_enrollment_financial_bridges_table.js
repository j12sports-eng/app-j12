#!/usr/bin/env node

/**
 * Sprint 23.13A - Canonical Enrollment financial bridge.
 * Manual execution only. Never runs from application startup or build.
 */

let database;

// Keep migration discovery deterministic: database configuration is loaded only on execution.
function getDatabase() {
  if (!database) database = require("../../config/db.js");
  return database;
}

function query(...args) {
  return getDatabase().query(...args);
}

function tableExists(...args) {
  return getDatabase().tableExists(...args);
}

const TABLE_NAME = "enrollment_financial_bridges";
const PREREQUISITES = Object.freeze({
  enrollment_financial_obligations: "id",
  enrollments: "id",
  j12_alunos: "id",
  j12_financeiro_cobrancas: "id",
  j12_mensalidades: "id",
});
const REQUIRED_COLUMNS = Object.freeze({
  charge_id: "varchar(64)",
  created_at: "datetime",
  created_by: "varchar(191)",
  enrollment_id: "varchar(64)",
  installment_id: "varchar(64)",
  legacy_student_id: "varchar(64)",
  obligation_id: "varchar(64)",
  status: "varchar(32)",
  updated_at: "datetime",
});
const REQUIRED_INDEXES = Object.freeze({
  idx_efb_enrollment: "enrollment_id",
  idx_efb_legacy_student: "legacy_student_id",
  idx_efb_status: "status",
  PRIMARY: "obligation_id",
  ux_efb_charge: "charge_id",
  ux_efb_installment: "installment_id",
});
const REQUIRED_FOREIGN_KEYS = Object.freeze({
  fk_efb_charge: ["charge_id", "j12_financeiro_cobrancas", "id"],
  fk_efb_enrollment: ["enrollment_id", "enrollments", "id"],
  fk_efb_installment: ["installment_id", "j12_mensalidades", "id"],
  fk_efb_legacy_student: ["legacy_student_id", "j12_alunos", "id"],
  fk_efb_obligation: ["obligation_id", "enrollment_financial_obligations", "id"],
});

async function up() {
  await assertPrerequisites();

  if (await tableExists(TABLE_NAME)) console.log(`SKIP_TABLE_EXISTS=${TABLE_NAME}`);
  else {
    await query(buildCreateTableSql());
    console.log(`CREATED_TABLE=${TABLE_NAME}`);
  }

  await assertTable();
  const state = await readState();
  printState(state);
  console.log(`ENROLLMENT_FINANCIAL_BRIDGE_TABLE_CREATED=${state.tableExists}`);
  console.log(`ENROLLMENT_FINANCIAL_BRIDGE_INDEXES_CREATED=${state.indexesCreated}`);
  console.log(`ENROLLMENT_FINANCIAL_BRIDGE_FOREIGN_KEYS_CREATED=${state.foreignKeysCreated}`);
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
  console.log(`ENROLLMENT_FINANCIAL_BRIDGE_TABLE_CREATED=${state.tableExists}`);
  console.log(`ENROLLMENT_FINANCIAL_BRIDGE_INDEXES_CREATED=${state.indexesCreated}`);
  console.log(`ENROLLMENT_FINANCIAL_BRIDGE_FOREIGN_KEYS_CREATED=${state.foreignKeysCreated}`);
}

async function assertPrerequisites() {
  const states = [];

  for (const [tableName, columnName] of Object.entries(PREREQUISITES)) {
    if (!(await tableExists(tableName))) {
      throw new Error(`Missing required table ${tableName}.`);
    }

    const tableInfo = await readTableInfo(tableName);
    const column = await readColumn(tableName, columnName);

    if (String(tableInfo?.ENGINE || "").toLowerCase() !== "innodb") {
      throw new Error(`Table ${tableName} must use InnoDB for canonical bridge foreign keys.`);
    }

    if (String(column?.COLUMN_TYPE || "").toLowerCase() !== "varchar(64)") {
      throw new Error(`Column ${tableName}.${columnName} must be varchar(64).`);
    }

    states.push({ column, tableInfo, tableName });
  }

  const collations = new Set(states.map((state) => state.column.COLLATION_NAME).filter(Boolean));
  if (collations.size !== 1) {
    throw new Error("Canonical bridge prerequisite id columns must use the same collation.");
  }
}

async function assertTable() {
  const state = await readState();

  if (!state.tableExists) throw new Error(`${TABLE_NAME} was not created.`);
  if (String(state.tableInfo?.ENGINE || "").toLowerCase() !== "innodb") {
    throw new Error(`${TABLE_NAME} must use InnoDB.`);
  }

  const columns = new Map(state.columns.map((column) => [column.COLUMN_NAME, column]));
  for (const [name, expected] of Object.entries(REQUIRED_COLUMNS)) {
    const actual = String(columns.get(name)?.COLUMN_TYPE || "").toLowerCase();
    if (actual !== expected) {
      throw new Error(`Unexpected column ${TABLE_NAME}.${name}: ${actual || "missing"}.`);
    }
  }

  if (!state.indexesCreated) throw new Error(`Required indexes are missing from ${TABLE_NAME}.`);
  if (!state.foreignKeysCreated) {
    throw new Error(`Required foreign keys are missing from ${TABLE_NAME}.`);
  }
}

function buildCreateTableSql() {
  return `
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      obligation_id VARCHAR(64) NOT NULL,
      charge_id VARCHAR(64) NOT NULL,
      installment_id VARCHAR(64) NOT NULL,
      legacy_student_id VARCHAR(64) NOT NULL,
      enrollment_id VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'LINKED',
      created_by VARCHAR(191) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (obligation_id),
      UNIQUE INDEX ux_efb_charge (charge_id),
      UNIQUE INDEX ux_efb_installment (installment_id),
      INDEX idx_efb_legacy_student (legacy_student_id),
      INDEX idx_efb_enrollment (enrollment_id),
      INDEX idx_efb_status (status),
      CONSTRAINT fk_efb_obligation FOREIGN KEY (obligation_id)
        REFERENCES enrollment_financial_obligations (id) ON UPDATE CASCADE ON DELETE RESTRICT,
      CONSTRAINT fk_efb_charge FOREIGN KEY (charge_id)
        REFERENCES j12_financeiro_cobrancas (id) ON UPDATE CASCADE ON DELETE RESTRICT,
      CONSTRAINT fk_efb_installment FOREIGN KEY (installment_id)
        REFERENCES j12_mensalidades (id) ON UPDATE CASCADE ON DELETE RESTRICT,
      CONSTRAINT fk_efb_legacy_student FOREIGN KEY (legacy_student_id)
        REFERENCES j12_alunos (id) ON UPDATE CASCADE ON DELETE RESTRICT,
      CONSTRAINT fk_efb_enrollment FOREIGN KEY (enrollment_id)
        REFERENCES enrollments (id) ON UPDATE CASCADE ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
}

async function readState() {
  if (!(await tableExists(TABLE_NAME))) {
    return emptyState();
  }

  const [tableRows, columns, indexes, foreignKeys] = await Promise.all([
    query(
      "SELECT TABLE_NAME, ENGINE, TABLE_COLLATION FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
      [TABLE_NAME],
    ),
    query(
      "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLLATION_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ORDINAL_POSITION",
      [TABLE_NAME],
    ),
    query(
      "SELECT INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? GROUP BY INDEX_NAME, NON_UNIQUE ORDER BY INDEX_NAME",
      [TABLE_NAME],
    ),
    query(
      "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY CONSTRAINT_NAME",
      [TABLE_NAME],
    ),
  ]);
  const indexMap = new Map(indexes.map((index) => [index.INDEX_NAME, String(index.columns)]));
  const foreignKeyMap = new Map(
    foreignKeys.map((foreignKey) => [foreignKey.CONSTRAINT_NAME, foreignKey]),
  );

  return {
    columns,
    foreignKeys,
    foreignKeysCreated: Object.entries(REQUIRED_FOREIGN_KEYS).every(([name, expected]) => {
      const foreignKey = foreignKeyMap.get(name);
      return (
        foreignKey &&
        foreignKey.COLUMN_NAME === expected[0] &&
        foreignKey.REFERENCED_TABLE_NAME === expected[1] &&
        foreignKey.REFERENCED_COLUMN_NAME === expected[2]
      );
    }),
    indexes,
    indexesCreated: Object.entries(REQUIRED_INDEXES).every(
      ([name, expected]) => indexMap.get(name) === expected,
    ),
    tableExists: true,
    tableInfo: tableRows[0] || null,
  };
}

function emptyState() {
  return {
    columns: [],
    foreignKeys: [],
    foreignKeysCreated: false,
    indexes: [],
    indexesCreated: false,
    tableExists: false,
    tableInfo: null,
  };
}

async function readTableInfo(tableName) {
  const rows = await query(
    "SELECT TABLE_NAME, ENGINE, TABLE_COLLATION FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
    [tableName],
  );
  return rows[0] || null;
}

async function readColumn(tableName, columnName) {
  const rows = await query(
    "SELECT COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1",
    [tableName, columnName],
  );
  return rows[0] || null;
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
      const pool = database?.pool;
      if (pool && typeof pool.end === "function") await pool.end();
      process.exit(process.exitCode || 0);
    });
}

module.exports = {
  PREREQUISITES,
  REQUIRED_COLUMNS,
  REQUIRED_FOREIGN_KEYS,
  REQUIRED_INDEXES,
  TABLE_NAME,
  assertPrerequisites,
  assertTable,
  buildCreateTableSql,
  down,
  readState,
  status,
  up,
};
