#!/usr/bin/env node

/** Sprint 24.3 - additive P1 indexes for Finance, Agenda and Championships. */

let database;

function getDatabase() {
  if (!database) database = require("../../config/db.js");
  return database;
}

function query(...args) {
  return getDatabase().query(...args);
}

const INDEXES = Object.freeze({
  idx_agenda_admin_blocks_lookup: {
    columns: "active,block_date,day_of_week,start_time",
    optional: true,
    table: "agenda_admin_blocks",
  },
  idx_agenda_items_class_schedule: {
    columns: "class_id,day_of_week,start_time",
    table: "enrollment_agenda_items",
  },
  idx_agenda_recurrence_exceptions_schedule: {
    columns: "series_id,occurrence_date,occurrence_start_time,id",
    table: "agenda_recurrence_exceptions",
  },
  idx_agenda_recurrence_series_schedule: {
    columns: "class_id,status,start_date,start_time",
    table: "agenda_recurrence_series",
  },
  idx_championship_groups_order: {
    columns: "championship_id,display_order,created_at",
    optional: true,
    table: "j12_campeonato_grupos",
  },
  idx_championship_matches_status_created: {
    columns: "championship_id,status,created_at",
    optional: true,
    table: "j12_campeonato_jogos",
  },
  idx_championship_registrations_status_created: {
    columns: "championship_id,status,created_at",
    optional: true,
    table: "j12_campeonato_inscricoes",
  },
  idx_championship_rounds_order: {
    columns: "championship_id,round_number,created_at",
    optional: true,
    table: "j12_campeonato_rodadas",
  },
  idx_financial_payments_status_created: {
    columns: "status,created_at,id",
    table: "financial_payments",
  },
  idx_financial_payments_status_due: {
    columns: "status,due_date,id",
    table: "financial_payments",
  },
  idx_financial_payments_status_paid: {
    columns: "status,paid_at,id",
    table: "financial_payments",
  },
  idx_j12_mensalidades_status_due_id: {
    columns: "status,data_vencimento,id",
    table: "j12_mensalidades",
  },
});

async function up() {
  for (const [name, definition] of Object.entries(INDEXES)) {
    if (!(await tableExists(definition.table))) {
      if (definition.optional) {
        console.log(`SKIP_OPTIONAL_TABLE_MISSING=${definition.table}`);
        continue;
      }
      throw new Error(`Missing required table ${definition.table}.`);
    }

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
  throw new Error("Refusing to remove Sprint 24.3 performance indexes automatically.");
}

async function status() {
  let ready = true;
  for (const [name, definition] of Object.entries(INDEXES)) {
    if (!(await tableExists(definition.table))) {
      if (!definition.optional) ready = false;
      continue;
    }
    const index = await readIndex(definition.table, name);
    if (index) assertCompatibleIndex(name, index, definition.columns);
    else ready = false;
  }
  console.log(`SPRINT_24_3_P1_PERFORMANCE_READY=${ready}`);
}

async function tableExists(table) {
  const rows = await query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=? LIMIT 1",
    [table],
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

module.exports = { INDEXES, assertCompatibleIndex, down, status, up };
