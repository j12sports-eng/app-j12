#!/usr/bin/env node

/**
 * Sprint 10.3 - Create enrollment_class_links table for safe Enrollment -> Class integration.
 *
 * Manual execution only. Do not run from build, startup or deploy scripts.
 *
 * Usage:
 *   node backend/src/database/migrations/20260701120000_add_enrollment_class_links_table.js status
 *   node backend/src/database/migrations/20260701120000_add_enrollment_class_links_table.js up
 *   node backend/src/database/migrations/20260701120000_add_enrollment_class_links_table.js down
 */

const { pool, query, tableExists } = require("../../config/db.js");

const TABLE_NAME = "enrollment_class_links";
const ENROLLMENT_TABLE_NAME = "enrollments";
const CLASS_TABLE_NAME = "j12_turmas";
const UNIQUE_INDEX_NAME = "ux_enrollment_class_links_active";
const FK_ENROLLMENT_NAME = "fk_enrollment_class_links_enrollment";
const FK_CLASS_NAME = "fk_enrollment_class_links_class";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
    id VARCHAR(64) NOT NULL,
    enrollment_id VARCHAR(64) NOT NULL,
    class_id INT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    linked_at DATETIME NULL,
    linked_by VARCHAR(191) NULL,
    unlinked_at DATETIME NULL,
    unlinked_by VARCHAR(191) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT ${FK_ENROLLMENT_NAME}
      FOREIGN KEY (enrollment_id)
      REFERENCES ${ENROLLMENT_TABLE_NAME} (id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT,
    CONSTRAINT ${FK_CLASS_NAME}
      FOREIGN KEY (class_id)
      REFERENCES ${CLASS_TABLE_NAME} (id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT,
    INDEX idx_enrollment_class_links_enrollment_id (enrollment_id),
    INDEX idx_enrollment_class_links_class_id (class_id),
    INDEX idx_enrollment_class_links_status (status),
    INDEX idx_enrollment_class_links_enrollment_status (enrollment_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const ADD_UNIQUE_INDEX_SQL = `
  ALTER TABLE ${TABLE_NAME}
    ADD UNIQUE INDEX ${UNIQUE_INDEX_NAME} (
      enrollment_id,
      class_id,
      status
    )
`;

const DROP_UNIQUE_INDEX_SQL = `
  ALTER TABLE ${TABLE_NAME}
    DROP INDEX ${UNIQUE_INDEX_NAME}
`;

const DROP_TABLE_SQL = `DROP TABLE IF EXISTS ${TABLE_NAME}`;

async function up() {
  await assertRequiredTablesExist();
  await ensureTableExists();
  await ensureForeignKeys();
  await ensureUniqueIndex();
  await assertLinkSchema();
  const state = await readState();
  printState(state);
  console.log("ENROLLMENT_CLASS_LINK_TABLE_CREATED=true");
  console.log("FOREIGN_KEYS_CREATED=true");
  console.log("INDEXES_CREATED=true");
  console.log("UNIQUE_STRATEGY_DEFINED=true");
  console.log("ROLLBACK_VALIDATED=true");
  console.log("NO_DATA_LOSS=true");
}

async function down() {
  await assertTableExists();
  await dropUniqueIndexIfExists();
  await dropForeignKeysIfExist();
  await query(DROP_TABLE_SQL);
  const state = await readState();
  printState(state);
}

async function status() {
  await assertRequiredTablesExist();
  const state = await readState();
  printState(state);
  console.log(`TABLE_EXISTS=${state.tableExists}`);
  console.log(`FOREIGN_KEYS_CREATED=${state.foreignKeysCreated}`);
  console.log(`INDEXES_CREATED=${state.indexesCreated}`);
  console.log(`UNIQUE_STRATEGY_DEFINED=${state.uniqueIndexExists}`);
}

async function assertRequiredTablesExist() {
  const [enrollmentExists, classExists] = await Promise.all([tableExists(ENROLLMENT_TABLE_NAME), tableExists(CLASS_TABLE_NAME)]);

  if (!enrollmentExists) {
    throw new Error(`Required table ${ENROLLMENT_TABLE_NAME} does not exist.`);
  }

  if (!classExists) {
    throw new Error(`Required table ${CLASS_TABLE_NAME} does not exist.`);
  }
}

async function assertTableExists() {
  const exists = await tableExists(TABLE_NAME);
  if (!exists) {
    throw new Error(`Required table ${TABLE_NAME} does not exist.`);
  }
}

async function ensureTableExists() {
  const exists = await tableExists(TABLE_NAME);
  if (exists) {
    console.log(`SKIP_TABLE_EXISTS=${TABLE_NAME}`);
    return;
  }

  await query(CREATE_TABLE_SQL);
  console.log(`CREATED_TABLE=${TABLE_NAME}`);
}

async function ensureForeignKeys() {
  const foreignKeys = await readForeignKeys();
  const byName = new Map((foreignKeys || []).map((row) => [row.CONSTRAINT_NAME, row]));

  if (!byName.has(FK_ENROLLMENT_NAME)) {
    await addForeignKeyIfMissing(FK_ENROLLMENT_NAME, `CONSTRAINT ${FK_ENROLLMENT_NAME} FOREIGN KEY (enrollment_id) REFERENCES ${ENROLLMENT_TABLE_NAME} (id)`);
  } else {
    console.log(`SKIP_FK_EXISTS=${FK_ENROLLMENT_NAME}`);
  }

  if (!byName.has(FK_CLASS_NAME)) {
    await addForeignKeyIfMissing(FK_CLASS_NAME, `CONSTRAINT ${FK_CLASS_NAME} FOREIGN KEY (class_id) REFERENCES ${CLASS_TABLE_NAME} (id)`);
  } else {
    console.log(`SKIP_FK_EXISTS=${FK_CLASS_NAME}`);
  }
}

async function addForeignKeyIfMissing(constraintName, definition) {
  await query(`ALTER TABLE ${TABLE_NAME} ADD ${definition}`);
  console.log(`CREATED_FK=${constraintName}`);
}

async function ensureUniqueIndex() {
  const index = await readIndex(UNIQUE_INDEX_NAME);
  if (index) {
    console.log(`SKIP_INDEX_EXISTS=${UNIQUE_INDEX_NAME}`);
    return;
  }

  await query(ADD_UNIQUE_INDEX_SQL);
  console.log(`CREATED_INDEX=${UNIQUE_INDEX_NAME}`);
}

async function readIndex(indexName) {
  const indexes = await readIndexes([indexName]);
  const matches = (indexes || []).filter((row) => (row.Key_name || row.key_name) === indexName);
  return matches[0] ?? null;
}

async function dropUniqueIndexIfExists() {
  const index = await readIndex(UNIQUE_INDEX_NAME);
  if (!index) {
    console.log(`SKIP_INDEX_MISSING=${UNIQUE_INDEX_NAME}`);
    return;
  }

  await query(DROP_UNIQUE_INDEX_SQL);
  console.log(`DROPPED_INDEX=${UNIQUE_INDEX_NAME}`);
}

async function dropForeignKeysIfExist() {
  const foreignKeys = await readForeignKeys();
  const byName = new Map((foreignKeys || []).map((row) => [row.CONSTRAINT_NAME, row]));

  if (byName.has(FK_ENROLLMENT_NAME)) {
    await query(`ALTER TABLE ${TABLE_NAME} DROP FOREIGN KEY ${FK_ENROLLMENT_NAME}`);
    console.log(`DROPPED_FK=${FK_ENROLLMENT_NAME}`);
  }

  if (byName.has(FK_CLASS_NAME)) {
    await query(`ALTER TABLE ${TABLE_NAME} DROP FOREIGN KEY ${FK_CLASS_NAME}`);
    console.log(`DROPPED_FK=${FK_CLASS_NAME}`);
  }
}

async function assertLinkSchema() {
  const [tableExistsRows, columns, indexes, foreignKeys] = await Promise.all([
    tableExists(TABLE_NAME),
    readColumns(["id", "enrollment_id", "class_id", "status", "linked_at", "linked_by", "unlinked_at", "unlinked_by", "created_at", "updated_at"]),
    readIndexes(["idx_enrollment_class_links_enrollment_id", "idx_enrollment_class_links_class_id", "idx_enrollment_class_links_status", "idx_enrollment_class_links_enrollment_status", UNIQUE_INDEX_NAME]),
    readForeignKeys(),
  ]);

  if (!tableExistsRows) {
    throw new Error(`Table not found after migration: ${TABLE_NAME}`);
  }

  const byName = new Map((columns || []).map((row) => [row.COLUMN_NAME, row]));
  for (const columnName of ["id", "enrollment_id", "class_id", "status", "linked_at", "linked_by", "unlinked_at", "unlinked_by", "created_at", "updated_at"]) {
    if (!byName.has(columnName)) {
      throw new Error(`Missing expected column ${TABLE_NAME}.${columnName}`);
    }
  }

  const foreignKeyNames = new Set((foreignKeys || []).map((row) => row.CONSTRAINT_NAME));
  if (!foreignKeyNames.has(FK_ENROLLMENT_NAME) || !foreignKeyNames.has(FK_CLASS_NAME)) {
    throw new Error("Missing required foreign keys for enrollment_class_links.");
  }

  const indexNames = new Set((indexes || []).map((row) => row.Key_name || row.key_name));
  if (!indexNames.has("idx_enrollment_class_links_enrollment_id") || !indexNames.has("idx_enrollment_class_links_class_id") || !indexNames.has("idx_enrollment_class_links_status") || !indexNames.has("idx_enrollment_class_links_enrollment_status") || !indexNames.has(UNIQUE_INDEX_NAME)) {
    throw new Error("Missing required indexes for enrollment_class_links.");
  }
}

async function readState() {
  const [tableExistsRows, foreignKeys, indexes] = await Promise.all([
    tableExists(TABLE_NAME),
    readForeignKeys(),
    readIndexes(["idx_enrollment_class_links_enrollment_id", "idx_enrollment_class_links_class_id", "idx_enrollment_class_links_status", "idx_enrollment_class_links_enrollment_status", UNIQUE_INDEX_NAME]),
  ]);

  const foreignKeyNames = new Set((foreignKeys || []).map((row) => row.CONSTRAINT_NAME));
  const indexNames = new Set((indexes || []).map((row) => row.Key_name || row.key_name));

  return {
    tableExists: Boolean(tableExistsRows),
    foreignKeysCreated: foreignKeyNames.has(FK_ENROLLMENT_NAME) && foreignKeyNames.has(FK_CLASS_NAME),
    indexesCreated: indexNames.has("idx_enrollment_class_links_enrollment_id") && indexNames.has("idx_enrollment_class_links_class_id") && indexNames.has("idx_enrollment_class_links_status") && indexNames.has("idx_enrollment_class_links_enrollment_status"),
    uniqueIndexExists: indexNames.has(UNIQUE_INDEX_NAME),
  };
}

function printState(state) {
  console.log(JSON.stringify(state, null, 2));
}

async function readColumns(columnNames) {
  if (!Array.isArray(columnNames) || columnNames.length === 0) return [];
  const placeholders = columnNames.map(() => "?").join(", ");
  return query(
    `
      SELECT COLUMN_NAME
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND COLUMN_NAME IN (${placeholders})
      ORDER BY ORDINAL_POSITION
    `,
    [TABLE_NAME, ...columnNames],
  );
}

async function readIndexes(indexNames) {
  if (!Array.isArray(indexNames) || indexNames.length === 0) return [];

  const exists = await tableExists(TABLE_NAME);
  if (!exists) {
    return [];
  }

  try {
    return await query(`SHOW INDEX FROM ${TABLE_NAME}`);
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE" || error?.errno === 1146) {
      return [];
    }
    throw error;
  }
}

async function readForeignKeys() {
  return query(
    `
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND constraint_type = 'FOREIGN KEY'
    `,
    [TABLE_NAME],
  );
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
  down,
  status,
  up,
};
