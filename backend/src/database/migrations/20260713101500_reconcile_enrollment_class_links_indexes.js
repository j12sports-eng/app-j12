#!/usr/bin/env node

/**
 * Additive compatibility bridge between the two preserved class-link
 * migrations. It supplies the legacy composite lookup index expected by the
 * second migration without changing either historical file.
 */

const { pool, query, tableExists } = require("../../config/db.js");

const TABLE_NAME = "enrollment_class_links";
const INDEX_NAME = "idx_enrollment_class_links_enrollment_status";
const INDEX_COLUMNS = "enrollment_id,status";

async function up() {
  if (!(await tableExists(TABLE_NAME))) throw new Error(`Missing required table ${TABLE_NAME}.`);

  const index = await readIndex();
  if (index) {
    assertCompatibleIndex(index);
    console.log(`SKIP_INDEX_EXISTS=${INDEX_NAME}`);
    return;
  }

  await query(`ALTER TABLE ${TABLE_NAME} ADD INDEX ${INDEX_NAME} (enrollment_id, status)`);
  assertCompatibleIndex(await readIndex());
  console.log(`CREATED_INDEX=${INDEX_NAME}`);
}

async function down() {
  throw new Error(
    `Refusing to drop ${INDEX_NAME}: it may be required by an already applied migration.`,
  );
}

async function status() {
  if (!(await tableExists(TABLE_NAME))) {
    console.log("CLASS_LINK_INDEX_RECONCILED=false");
    return;
  }
  const index = await readIndex();
  if (index) assertCompatibleIndex(index);
  console.log(`CLASS_LINK_INDEX_RECONCILED=${Boolean(index)}`);
}

async function readIndex() {
  const rows = await query(
    `SELECT INDEX_NAME, NON_UNIQUE,
       GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
     GROUP BY INDEX_NAME, NON_UNIQUE`,
    [TABLE_NAME, INDEX_NAME],
  );
  return rows[0] || null;
}

function assertCompatibleIndex(index) {
  if (!index || Number(index.NON_UNIQUE) !== 1 || String(index.columns) !== INDEX_COLUMNS)
    throw new Error(`Incompatible existing index ${TABLE_NAME}.${INDEX_NAME}.`);
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
  INDEX_COLUMNS,
  INDEX_NAME,
  TABLE_NAME,
  assertCompatibleIndex,
  down,
  status,
  up,
};
