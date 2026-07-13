#!/usr/bin/env node

/**
 * Canonical foundation for the legacy j12_turmas table.
 *
 * This migration adopts the exact runtime schema previously created by
 * ensureSchema. Existing tables are validated fail-closed and are never
 * reshaped silently.
 */

const { pool, query, tableExists } = require("../../config/db.js");

const TABLE_NAME = "j12_turmas";
const REQUIRED_COLUMNS = Object.freeze({
  id: "integer",
  nome: "varchar(191)",
  modalidade: "varchar(191)",
  unidade: "varchar(191)",
  professor_id: "integer",
  professor_nome: "varchar(191)",
  modalidade_id: "integer",
  unidade_id: "integer",
  dias_semana: "varchar(191)",
  dias_semana_json: "longtext",
  horario: "varchar(50)",
  horario_inicio: "varchar(20)",
  horario_fim: "varchar(20)",
  capacidade: "integer",
  status: "varchar(30)",
  aluno_ids_json: "longtext",
  presencas_json: "longtext",
  created_at: "datetime",
  updated_at: "datetime",
});
const REQUIRED_INDEXES = Object.freeze({
  idx_j12_turmas_nome: "nome",
  idx_j12_turmas_professor_id: "professor_id",
  idx_j12_turmas_status: "status",
});

async function up() {
  return runUp();
}

async function runUp({
  log = (message) => console.log(message),
  queryFn = query,
  tableExistsFn = tableExists,
} = {}) {
  if (!(await tableExistsFn(TABLE_NAME))) {
    await queryFn(buildCreateTableSql());
    log(`CREATED_TABLE=${TABLE_NAME}`);
  } else {
    log(`ADOPTING_EXISTING_TABLE=${TABLE_NAME}`);
  }

  await assertCompatibleTable({ queryFn, requireIndexes: false });
  await ensureCanonicalIndexes({ queryFn });
  await assertCompatibleTable({ queryFn });
  log("CLASSES_FOUNDATION_READY=true");
}

async function down() {
  throw new Error(
    `Refusing to drop ${TABLE_NAME}: this migration adopts a pre-existing canonical domain table.`,
  );
}

async function status() {
  if (!(await tableExists(TABLE_NAME))) {
    console.log("CLASSES_FOUNDATION_READY=false");
    return;
  }
  await assertCompatibleTable();
  console.log("CLASSES_FOUNDATION_READY=true");
}

function buildCreateTableSql() {
  return `
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(191) NOT NULL,
      modalidade VARCHAR(191) NULL,
      unidade VARCHAR(191) NULL,
      professor_id BIGINT NULL,
      professor_nome VARCHAR(191) NULL,
      modalidade_id BIGINT NULL,
      unidade_id BIGINT NULL,
      dias_semana VARCHAR(191) NULL,
      dias_semana_json LONGTEXT NULL,
      horario VARCHAR(50) NULL,
      horario_inicio VARCHAR(20) NULL,
      horario_fim VARCHAR(20) NULL,
      capacidade INT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'ativa',
      aluno_ids_json LONGTEXT NULL,
      presencas_json LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_j12_turmas_nome (nome),
      INDEX idx_j12_turmas_status (status),
      INDEX idx_j12_turmas_professor_id (professor_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
}

async function assertCompatibleTable({ queryFn = query, requireIndexes = true } = {}) {
  const tables = await queryFn(
    `SELECT ENGINE FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [TABLE_NAME],
  );
  if (String(tables[0]?.ENGINE || "").toLowerCase() !== "innodb")
    throw new Error(`Table ${TABLE_NAME} must use InnoDB.`);

  const columns = await queryFn(
    `SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ORDINAL_POSITION`,
    [TABLE_NAME],
  );
  const byName = new Map(columns.map((column) => [column.COLUMN_NAME, column]));
  for (const [name, expected] of Object.entries(REQUIRED_COLUMNS)) {
    const column = byName.get(name);
    if (!column) throw new Error(`Missing required column ${TABLE_NAME}.${name}.`);
    assertColumnType(column, expected);
  }

  if (requireIndexes) {
    const indexes = await readIndexes(queryFn);
    for (const [name, expectedColumns] of Object.entries(REQUIRED_INDEXES)) {
      const index = indexes.find((candidate) => candidate.INDEX_NAME === name);
      if (!index || String(index.columns) !== expectedColumns)
        throw new Error(`Missing or incompatible index ${TABLE_NAME}.${name}.`);
    }
  }
}

async function ensureCanonicalIndexes({ queryFn = query } = {}) {
  const indexes = await readIndexes(queryFn);
  for (const [name, columns] of Object.entries(REQUIRED_INDEXES)) {
    const existing = indexes.find((candidate) => candidate.INDEX_NAME === name);
    if (existing && String(existing.columns) !== columns)
      throw new Error(`Incompatible existing index ${TABLE_NAME}.${name}.`);
    if (!existing) await queryFn(`ALTER TABLE ${TABLE_NAME} ADD INDEX ${name} (${columns})`);
  }
}

async function readIndexes(queryFn = query) {
  return queryFn(
    `SELECT INDEX_NAME,
       GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ?
     GROUP BY INDEX_NAME ORDER BY INDEX_NAME`,
    [TABLE_NAME],
  );
}

function assertColumnType(column, expected) {
  const actual = String(column.COLUMN_TYPE || "").toLowerCase();
  if (expected === "integer") {
    if (actual.startsWith("int") || actual.startsWith("bigint")) return;
  } else if (actual === expected) {
    return;
  }
  throw new Error(
    `Unexpected type for ${TABLE_NAME}.${column.COLUMN_NAME}: ${column.COLUMN_TYPE}; expected ${expected}.`,
  );
}

async function main() {
  const command = process.argv[2] || "status";
  if (command === "up") await up();
  else if (command === "down") await down();
  else if (command === "status") await status();
  else throw new Error(`Unknown command: ${command}. Use status, up or down.`);
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
  REQUIRED_COLUMNS,
  REQUIRED_INDEXES,
  TABLE_NAME,
  assertColumnType,
  assertCompatibleTable,
  buildCreateTableSql,
  down,
  ensureCanonicalIndexes,
  runUp,
  status,
  up,
};
