#!/usr/bin/env node

/**
 * Sprint 29.1B - Create enrollment_digital_invitations table.
 * Manual execution only. Never runs from startup, build or deploy scripts.
 */

const { pool, query, tableExists } = require("../../config/db.js");

const TABLE_NAME = "enrollment_digital_invitations";
const ENROLLMENT_TABLE_NAME = "enrollments";
const ACTIVE_INVITATION_COLUMN = "active_enrollment_id";
const UNIQUE_TOKEN_INDEX = "ux_edi_token_hash";
const ACTIVE_INVITATION_UNIQUE_INDEX = "ux_edi_active_enrollment";

const REQUIRED_COLUMNS = Object.freeze({
  active_enrollment_id: "varchar(64)",
  created_at: "datetime",
  created_by: "varchar(191)",
  enrollment_id: "varchar(64)",
  expires_at: "datetime",
  id: "varchar(64)",
  metadata_json: "longtext",
  replaced_by_invitation_id: "varchar(64)",
  revoked_at: "datetime",
  revoked_by: "varchar(191)",
  status: "varchar(32)",
  token_hash: "varchar(64)",
  unit_id: "varchar(64)",
  updated_at: "datetime",
  used_at: "datetime",
  used_by: "varchar(191)",
});

const REQUIRED_INDEXES = Object.freeze({
  idx_edi_enrollment: "enrollment_id",
  idx_edi_expires: "expires_at",
  idx_edi_status: "status",
  idx_edi_unit: "unit_id",
  ux_edi_active_enrollment: ACTIVE_INVITATION_COLUMN,
  ux_edi_token_hash: "token_hash",
});

const REQUIRED_FOREIGN_KEYS = Object.freeze({
  fk_edi_enrollment: ["enrollment_id", ENROLLMENT_TABLE_NAME, "id"],
});

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
    id VARCHAR(64) NOT NULL,
    enrollment_id VARCHAR(64) NOT NULL,
    unit_id VARCHAR(64) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(191) NOT NULL,
    revoked_at DATETIME NULL,
    revoked_by VARCHAR(191) NULL,
    used_at DATETIME NULL,
    used_by VARCHAR(191) NULL,
    replaced_by_invitation_id VARCHAR(64) NULL,
    metadata_json LONGTEXT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ${ACTIVE_INVITATION_COLUMN} VARCHAR(64)
      GENERATED ALWAYS AS (
        CASE
          WHEN status = 'ACTIVE' THEN enrollment_id
          ELSE NULL
        END
      ) VIRTUAL,
    PRIMARY KEY (id),
    UNIQUE INDEX ${UNIQUE_TOKEN_INDEX} (token_hash),
    UNIQUE INDEX ${ACTIVE_INVITATION_UNIQUE_INDEX} (${ACTIVE_INVITATION_COLUMN}),
    INDEX idx_edi_enrollment (enrollment_id),
    INDEX idx_edi_unit (unit_id),
    INDEX idx_edi_status (status),
    INDEX idx_edi_expires (expires_at),
    CONSTRAINT fk_edi_enrollment
      FOREIGN KEY (enrollment_id)
      REFERENCES ${ENROLLMENT_TABLE_NAME} (id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

async function up() {
  await assertRequiredTablesExist();
  await ensureTableExists();
  await ensureSchema();
  const state = await readState();
  printState(state);
  console.log("ENROLLMENT_DIGITAL_INVITATION_TABLE_CREATED=true");
  console.log("ENROLLMENT_DIGITAL_INVITATION_INDEXES_CREATED=true");
  console.log("ENROLLMENT_DIGITAL_INVITATION_FOREIGN_KEYS_CREATED=true");
}

async function down() {
  await assertTableExists();
  const rows = await query(`SELECT COUNT(*) AS total FROM ${TABLE_NAME}`);
  const total = Number(rows[0]?.total || 0);

  if (total > 0) {
    throw new Error(`Refusing to drop ${TABLE_NAME}: table contains ${total} row(s).`);
  }

  await query(`DROP TABLE IF EXISTS ${TABLE_NAME}`);
  const state = await readState();
  printState(state);
}

async function status() {
  await assertRequiredTablesExist();
  const state = await readState();
  printState(state);
  console.log(`TABLE_EXISTS=${state.tableExists}`);
  console.log(`INDEXES_CREATED=${state.indexesCreated}`);
  console.log(`FOREIGN_KEYS_CREATED=${state.foreignKeysCreated}`);
}

async function assertRequiredTablesExist() {
  if (!(await tableExists(ENROLLMENT_TABLE_NAME))) {
    throw new Error(`Required table ${ENROLLMENT_TABLE_NAME} does not exist.`);
  }
}

async function assertTableExists() {
  if (!(await tableExists(TABLE_NAME))) {
    throw new Error(`Required table ${TABLE_NAME} does not exist.`);
  }
}

async function ensureTableExists() {
  if (await tableExists(TABLE_NAME)) {
    console.log(`SKIP_TABLE_EXISTS=${TABLE_NAME}`);
    return;
  }

  await query(CREATE_TABLE_SQL);
  console.log(`CREATED_TABLE=${TABLE_NAME}`);
}

async function ensureSchema() {
  const [columns, indexes, foreignKeys] = await Promise.all([
    readColumns(Object.keys(REQUIRED_COLUMNS)),
    readIndexes(Object.keys(REQUIRED_INDEXES)),
    readForeignKeys(),
  ]);
  const columnNames = new Set(columns.map((column) => column.COLUMN_NAME));
  for (const [columnName, expectedType] of Object.entries(REQUIRED_COLUMNS)) {
    const column = columns.find((candidate) => candidate.COLUMN_NAME === columnName);
    if (!column) {
      throw new Error(`Missing required column ${TABLE_NAME}.${columnName}.`);
    }
    if (String(column.COLUMN_TYPE).toLowerCase() !== expectedType) {
      throw new Error(
        `Unexpected type for ${TABLE_NAME}.${columnName}: ${column.COLUMN_TYPE}; expected ${expectedType}.`,
      );
    }
  }

  const indexMap = new Map(indexes.map((index) => [index.INDEX_NAME, String(index.columns)]));
  for (const [indexName, expectedColumns] of Object.entries(REQUIRED_INDEXES)) {
    if (indexMap.get(indexName) !== expectedColumns) {
      throw new Error(`Missing or incompatible index ${TABLE_NAME}.${indexName}.`);
    }
  }

  const foreignKeyMap = new Map(foreignKeys.map((foreignKey) => [foreignKey.CONSTRAINT_NAME, foreignKey]));
  for (const [constraintName, expected] of Object.entries(REQUIRED_FOREIGN_KEYS)) {
    const foreignKey = foreignKeyMap.get(constraintName);
    if (
      !foreignKey ||
      foreignKey.COLUMN_NAME !== expected[0] ||
      foreignKey.REFERENCED_TABLE_NAME !== expected[1] ||
      foreignKey.REFERENCED_COLUMN_NAME !== expected[2]
    ) {
      throw new Error(`Missing or incompatible foreign key ${TABLE_NAME}.${constraintName}.`);
    }
  }

  if (!columnNames.has("active_enrollment_id")) {
    throw new Error(`Missing generated column ${TABLE_NAME}.${ACTIVE_INVITATION_COLUMN}.`);
  }
}

async function readState() {
  if (!(await tableExists(TABLE_NAME))) {
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

  const [tableInfoRows, columns, indexes, foreignKeys] = await Promise.all([
    query(
      "SELECT TABLE_NAME, ENGINE, TABLE_COLLATION FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
      [TABLE_NAME],
    ),
    readColumns(Object.keys(REQUIRED_COLUMNS)),
    readIndexes(Object.keys(REQUIRED_INDEXES)),
    readForeignKeys(),
  ]);

  const indexMap = new Map(indexes.map((index) => [index.INDEX_NAME, String(index.columns)]));
  const foreignKeyMap = new Map(foreignKeys.map((foreignKey) => [foreignKey.CONSTRAINT_NAME, foreignKey]));

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
    tableInfo: tableInfoRows[0] || null,
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
      SELECT COLUMN_NAME, COLUMN_TYPE, EXTRA, GENERATION_EXPRESSION
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
  const rows = await query(`SHOW INDEX FROM ${TABLE_NAME}`);
  const indexSet = new Set(indexNames);
  return rows.filter((row) => indexSet.has(row.Key_name || row.key_name));
}

async function readForeignKeys() {
  return query(
    `
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY CONSTRAINT_NAME
    `,
    [TABLE_NAME],
  );
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
      if (pool && typeof pool.end === "function") {
        await pool.end();
      }
      process.exit(process.exitCode || 0);
    });
}

module.exports = {
  ACTIVE_INVITATION_COLUMN,
  ACTIVE_INVITATION_UNIQUE_INDEX,
  CREATE_TABLE_SQL,
  ENROLLMENT_TABLE_NAME,
  REQUIRED_COLUMNS,
  REQUIRED_FOREIGN_KEYS,
  REQUIRED_INDEXES,
  TABLE_NAME,
  down,
  ensureSchema,
  readState,
  status,
  up,
};
