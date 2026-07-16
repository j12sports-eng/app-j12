#!/usr/bin/env node

/** Sprint 24.2 - additive P0 database performance indexes. */

let database;

function getDatabase() {
  if (!database) database = require("../../config/db.js");
  return database;
}

function query(...args) {
  return getDatabase().query(...args);
}

const REQUIRED_TABLES = Object.freeze(["j12_quadra_reservas", "j12_financeiro_cobrancas"]);

const GENERATED_COLUMNS = Object.freeze({
  payment_effective_date: "DATE GENERATED ALWAYS AS (COALESCE(data_pagamento, pago_em)) STORED",
  status_normalized: "VARCHAR(32) GENERATED ALWAYS AS (LOWER(status)) STORED",
  type_normalized: "VARCHAR(191) GENERATED ALWAYS AS (LOWER(tipo)) STORED",
});

const INDEXES = Object.freeze({
  idx_j12_cobrancas_active_status_due: {
    columns: "ativo,status,vencimento",
    table: "j12_financeiro_cobrancas",
  },
  idx_j12_cobrancas_active_status_paid: {
    columns: "ativo,status,data_pagamento",
    table: "j12_financeiro_cobrancas",
  },
  idx_j12_cobrancas_bi_paid: {
    columns: "ativo,status_normalized,payment_effective_date,type_normalized",
    table: "j12_financeiro_cobrancas",
  },
  idx_j12_cobrancas_bi_due: {
    columns: "ativo,status_normalized,vencimento,type_normalized",
    table: "j12_financeiro_cobrancas",
  },
  idx_j12_quadra_reservas_availability: {
    columns: "quadra_id,status,start_at,end_at",
    table: "j12_quadra_reservas",
  },
});

async function up() {
  await assertRequiredTables();

  for (const [name, definition] of Object.entries(GENERATED_COLUMNS)) {
    if (!(await columnExists("j12_financeiro_cobrancas", name))) {
      await query(`ALTER TABLE j12_financeiro_cobrancas ADD COLUMN ${name} ${definition}`);
      console.log(`CREATED_COLUMN=${name}`);
    }
  }

  for (const [name, definition] of Object.entries(INDEXES)) {
    const existing = await readIndex(definition.table, name);
    if (existing) {
      assertCompatibleIndex(name, existing, definition.columns);
      continue;
    }
    await query(
      `ALTER TABLE ${definition.table} ADD INDEX ${name} (${definition.columns.replaceAll(",", ", ")})`,
    );
    assertCompatibleIndex(name, await readIndex(definition.table, name), definition.columns);
    console.log(`CREATED_INDEX=${name}`);
  }
}

async function down() {
  throw new Error("Refusing to remove Sprint 24.2 performance structures automatically.");
}

async function status() {
  const tables = await Promise.all(REQUIRED_TABLES.map((table) => tableExists(table)));
  if (tables.some((exists) => !exists)) {
    console.log("SPRINT_24_2_P0_PERFORMANCE_READY=false");
    return;
  }
  const columns = await Promise.all(
    Object.keys(GENERATED_COLUMNS).map((name) => columnExists("j12_financeiro_cobrancas", name)),
  );
  const indexes = await Promise.all(
    Object.entries(INDEXES).map(async ([name, definition]) => {
      const index = await readIndex(definition.table, name);
      if (index) assertCompatibleIndex(name, index, definition.columns);
      return Boolean(index);
    }),
  );
  console.log(
    `SPRINT_24_2_P0_PERFORMANCE_READY=${columns.every(Boolean) && indexes.every(Boolean)}`,
  );
}

async function assertRequiredTables() {
  for (const table of REQUIRED_TABLES) {
    if (!(await tableExists(table))) throw new Error(`Missing required table ${table}.`);
  }
}

async function tableExists(table) {
  const rows = await query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=? LIMIT 1",
    [table],
  );
  return rows.length > 0;
}

async function columnExists(table, column) {
  const rows = await query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=? LIMIT 1",
    [table, column],
  );
  return rows.length > 0;
}

async function readIndex(table, name) {
  const rows = await query(
    "SELECT INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') columns FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=? GROUP BY INDEX_NAME, NON_UNIQUE",
    [table, name],
  );
  return rows[0] || null;
}

function assertCompatibleIndex(name, index, expectedColumns) {
  if (!index || Number(index.NON_UNIQUE) !== 1 || String(index.columns) !== expectedColumns) {
    throw new Error(`Incompatible existing index ${name}.`);
  }
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
  GENERATED_COLUMNS,
  INDEXES,
  REQUIRED_TABLES,
  assertCompatibleIndex,
  down,
  status,
  up,
};
