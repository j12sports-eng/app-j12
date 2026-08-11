#!/usr/bin/env node

/**
 * Sprint 29.1C.2B - Create canonical user-unit memberships table.
 * Manual execution only. Never runs from startup, build or deploy scripts.
 */

let dbModule = null;

function getDb() {
  if (!dbModule) dbModule = require("../../config/db.js");
  return dbModule;
}

function dbQuery(sql, params) {
  return getDb().query(sql, params);
}

function dbTableExists(tableName) {
  return getDb().tableExists(tableName);
}

const TABLE_NAME = "user_unit_memberships";
const REQUIRED_PARENT_TABLES = Object.freeze(["auth_identities", "j12_unidades"]);
const IDENTITY_UNIQUE_INDEX = "ux_user_unit_memberships_identity_unit";
const ACTIVE_DEFAULT_UNIQUE_INDEX = "ux_user_unit_memberships_active_default";

const REQUIRED_COLUMNS = Object.freeze({
  active_default_key: "varchar(64)",
  auth_identity_id: "varchar(64)",
  created_at: "datetime",
  created_by_auth_identity_id: "varchar(64)",
  id: "varchar(64)",
  is_default: "tinyint(1)",
  role: "varchar(32)",
  revoked_at: "datetime",
  revoked_by_auth_identity_id: "varchar(64)",
  status: "varchar(32)",
  unit_id: "bigint",
  updated_at: "datetime",
});

const REQUIRED_GENERATED_COLUMNS = Object.freeze({
  active_default_key: "STORED GENERATED",
});

const REQUIRED_INDEXES = Object.freeze({
  idx_user_unit_memberships_auth_identity: "auth_identity_id",
  idx_user_unit_memberships_status: "status",
  idx_user_unit_memberships_unit: "unit_id",
  ux_user_unit_memberships_active_default: "active_default_key",
  ux_user_unit_memberships_identity_unit: "auth_identity_id,unit_id",
});

const REQUIRED_FOREIGN_KEYS = Object.freeze({
  fk_user_unit_memberships_auth_identity: Object.freeze(["auth_identity_id", "auth_identities"]),
  fk_user_unit_memberships_created_by_auth_identity: Object.freeze([
    "created_by_auth_identity_id",
    "auth_identities",
  ]),
  fk_user_unit_memberships_revoked_by_auth_identity: Object.freeze([
    "revoked_by_auth_identity_id",
    "auth_identities",
  ]),
  fk_user_unit_memberships_unit: Object.freeze(["unit_id", "j12_unidades"]),
});

// MySQL 5.7 rejects ON UPDATE CASCADE on a foreign-key base column used by a
// stored generated column. active_default_key depends on auth_identity_id.
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
    id VARCHAR(64) NOT NULL,
    auth_identity_id VARCHAR(64) NOT NULL,
    unit_id BIGINT NOT NULL,
    role VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    active_default_key VARCHAR(64) GENERATED ALWAYS AS (
      CASE
        WHEN status = 'ACTIVE' AND is_default = 1 THEN auth_identity_id
        ELSE NULL
      END
    ) STORED,
    created_by_auth_identity_id VARCHAR(64) NOT NULL,
    revoked_at DATETIME NULL,
    revoked_by_auth_identity_id VARCHAR(64) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE INDEX ${IDENTITY_UNIQUE_INDEX} (auth_identity_id, unit_id),
    UNIQUE INDEX ${ACTIVE_DEFAULT_UNIQUE_INDEX} (active_default_key),
    INDEX idx_user_unit_memberships_auth_identity (auth_identity_id),
    INDEX idx_user_unit_memberships_unit (unit_id),
    INDEX idx_user_unit_memberships_status (status),
    CONSTRAINT fk_user_unit_memberships_auth_identity
      FOREIGN KEY (auth_identity_id) REFERENCES auth_identities (id)
      ON UPDATE RESTRICT
      ON DELETE RESTRICT,
    CONSTRAINT fk_user_unit_memberships_created_by_auth_identity
      FOREIGN KEY (created_by_auth_identity_id) REFERENCES auth_identities (id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT,
    CONSTRAINT fk_user_unit_memberships_revoked_by_auth_identity
      FOREIGN KEY (revoked_by_auth_identity_id) REFERENCES auth_identities (id)
      ON UPDATE CASCADE
      ON DELETE SET NULL,
    CONSTRAINT fk_user_unit_memberships_unit
      FOREIGN KEY (unit_id) REFERENCES j12_unidades (id)
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
  console.log("USER_UNIT_MEMBERSHIPS_TABLE_CREATED=true");
  console.log("USER_UNIT_MEMBERSHIPS_INDEXES_CREATED=true");
}

async function down() {
  await assertTableExists();
  const rows = await dbQuery(`SELECT COUNT(*) AS total FROM ${TABLE_NAME}`);
  const total = Number(rows[0]?.total || 0);

  if (total > 0) {
    throw new Error(`Refusing to drop ${TABLE_NAME}: table contains ${total} row(s).`);
  }

  await dbQuery(`DROP TABLE IF EXISTS ${TABLE_NAME}`);
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
  for (const tableName of REQUIRED_PARENT_TABLES) {
    if (!(await dbTableExists(tableName))) {
      throw new Error(`Required table ${tableName} does not exist.`);
    }
  }
}

async function assertTableExists() {
  if (!(await dbTableExists(TABLE_NAME))) {
    throw new Error(`Required table ${TABLE_NAME} does not exist.`);
  }
}

async function ensureTableExists() {
  if (await dbTableExists(TABLE_NAME)) {
    console.log(`SKIP_TABLE_EXISTS=${TABLE_NAME}`);
    return;
  }

  await dbQuery(CREATE_TABLE_SQL);
  console.log(`CREATED_TABLE=${TABLE_NAME}`);
}

async function ensureSchema() {
  const [columns, indexes, foreignKeys] = await Promise.all([
    readColumns(Object.keys(REQUIRED_COLUMNS)),
    readIndexes(Object.keys(REQUIRED_INDEXES)),
    readForeignKeys(Object.keys(REQUIRED_FOREIGN_KEYS)),
  ]);

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

  for (const [columnName, expectedExtra] of Object.entries(REQUIRED_GENERATED_COLUMNS)) {
    const column = columns.find((candidate) => candidate.COLUMN_NAME === columnName);
    if (
      !column ||
      !String(column.EXTRA || "")
        .toUpperCase()
        .includes(expectedExtra)
    ) {
      throw new Error(`Missing generated column ${TABLE_NAME}.${columnName}.`);
    }
  }

  const indexMap = new Map(indexes.map((index) => [index.INDEX_NAME, String(index.columns)]));
  for (const [indexName, expectedColumns] of Object.entries(REQUIRED_INDEXES)) {
    if (indexMap.get(indexName) !== expectedColumns) {
      throw new Error(`Missing or incompatible index ${TABLE_NAME}.${indexName}.`);
    }
  }

  const foreignKeyMap = new Map(
    foreignKeys.map((item) => [
      item.CONSTRAINT_NAME,
      `${item.COLUMN_NAME}:${item.REFERENCED_TABLE_NAME}`,
    ]),
  );
  for (const [constraintName, [columnName, tableName]] of Object.entries(REQUIRED_FOREIGN_KEYS)) {
    if (foreignKeyMap.get(constraintName) !== `${columnName}:${tableName}`) {
      throw new Error(`Missing or incompatible foreign key ${TABLE_NAME}.${constraintName}.`);
    }
  }
}

async function readState() {
  if (!(await dbTableExists(TABLE_NAME))) {
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
    dbQuery(
      "SELECT TABLE_NAME, ENGINE, TABLE_COLLATION FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
      [TABLE_NAME],
    ),
    readColumns(Object.keys(REQUIRED_COLUMNS)),
    readIndexes(Object.keys(REQUIRED_INDEXES)),
    readForeignKeys(Object.keys(REQUIRED_FOREIGN_KEYS)),
  ]);

  const indexMap = new Map(indexes.map((index) => [index.INDEX_NAME, String(index.columns)]));
  const foreignKeyMap = new Map(
    foreignKeys.map((item) => [
      item.CONSTRAINT_NAME,
      `${item.COLUMN_NAME}:${item.REFERENCED_TABLE_NAME}`,
    ]),
  );

  return {
    columns,
    foreignKeys,
    foreignKeysCreated: Object.entries(REQUIRED_FOREIGN_KEYS).every(
      ([name, [columnName, tableName]]) => foreignKeyMap.get(name) === `${columnName}:${tableName}`,
    ),
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
  return dbQuery(
    `
      SELECT COLUMN_NAME, COLUMN_TYPE, EXTRA
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
  const rows = await dbQuery(`SHOW INDEX FROM ${TABLE_NAME}`);
  const indexSet = new Set(indexNames);
  const grouped = new Map();

  for (const row of rows) {
    const name = row.Key_name || row.key_name;
    if (!indexSet.has(name)) continue;
    const entry = grouped.get(name) || [];
    entry.push({
      column: row.Column_name || row.column_name,
      sequence: Number(row.Seq_in_index || row.seq_in_index || 0),
    });
    grouped.set(name, entry);
  }

  return [...grouped.entries()].map(([name, columns]) => ({
    INDEX_NAME: name,
    columns: columns
      .sort((left, right) => left.sequence - right.sequence)
      .map((column) => column.column)
      .join(","),
  }));
}

async function readForeignKeys(constraintNames) {
  if (!Array.isArray(constraintNames) || constraintNames.length === 0) return [];
  const rows = await dbQuery(
    `
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
      FROM information_schema.key_column_usage
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND CONSTRAINT_NAME IN (${constraintNames.map(() => "?").join(", ")})
        AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY ORDINAL_POSITION
    `,
    [TABLE_NAME, ...constraintNames],
  );

  return rows.map((row) => ({
    COLUMN_NAME: row.COLUMN_NAME || row.column_name,
    CONSTRAINT_NAME: row.CONSTRAINT_NAME || row.constraint_name,
    REFERENCED_TABLE_NAME: row.REFERENCED_TABLE_NAME || row.referenced_table_name,
  }));
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
      if (dbModule?.pool && typeof dbModule.pool.end === "function") {
        await dbModule.pool.end();
      }
      process.exit(process.exitCode || 0);
    });
}

module.exports = {
  ACTIVE_DEFAULT_UNIQUE_INDEX,
  CREATE_TABLE_SQL,
  IDENTITY_UNIQUE_INDEX,
  REQUIRED_COLUMNS,
  REQUIRED_FOREIGN_KEYS,
  REQUIRED_GENERATED_COLUMNS,
  REQUIRED_INDEXES,
  REQUIRED_PARENT_TABLES,
  TABLE_NAME,
  down,
  ensureSchema,
  readState,
  status,
  up,
};
