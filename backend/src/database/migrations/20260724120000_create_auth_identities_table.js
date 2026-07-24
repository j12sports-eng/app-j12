#!/usr/bin/env node

/**
 * Sprint 29.1C.2A - Create canonical authentication identities table.
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

const TABLE_NAME = "auth_identities";
const AUTH_RUNTIME_TABLES = Object.freeze(["users", "j12_usuarios"]);
const AUTH_IDENTITY_SOURCE_USER_UNIQUE_INDEX = "ux_auth_identities_source_user";

const REQUIRED_COLUMNS = Object.freeze({
  created_at: "datetime",
  disabled_at: "datetime",
  id: "varchar(64)",
  source: "varchar(32)",
  source_user_id: "varchar(64)",
  status: "varchar(32)",
  updated_at: "datetime",
});

const REQUIRED_INDEXES = Object.freeze({
  idx_auth_identities_source: "source",
  idx_auth_identities_status: "status",
  ux_auth_identities_source_user: "source,source_user_id",
});

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
    id VARCHAR(64) NOT NULL,
    source VARCHAR(32) NOT NULL,
    source_user_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    disabled_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE INDEX ${AUTH_IDENTITY_SOURCE_USER_UNIQUE_INDEX} (source, source_user_id),
    INDEX idx_auth_identities_source (source),
    INDEX idx_auth_identities_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

async function up() {
  await assertRequiredTablesExist();
  await ensureTableExists();
  await ensureSchema();
  const state = await readState();
  printState(state);
  console.log("AUTH_IDENTITIES_TABLE_CREATED=true");
  console.log("AUTH_IDENTITIES_INDEXES_CREATED=true");
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
}

async function assertRequiredTablesExist() {
  for (const tableName of AUTH_RUNTIME_TABLES) {
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
  const [columns, indexes] = await Promise.all([
    readColumns(Object.keys(REQUIRED_COLUMNS)),
    readIndexes(Object.keys(REQUIRED_INDEXES)),
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

  const indexMap = new Map(indexes.map((index) => [index.INDEX_NAME, String(index.columns)]));
  for (const [indexName, expectedColumns] of Object.entries(REQUIRED_INDEXES)) {
    if (indexMap.get(indexName) !== expectedColumns) {
      throw new Error(`Missing or incompatible index ${TABLE_NAME}.${indexName}.`);
    }
  }
}

async function readState() {
  if (!(await dbTableExists(TABLE_NAME))) {
    return {
      columns: [],
      indexes: [],
      indexesCreated: false,
      tableExists: false,
      tableInfo: null,
    };
  }

  const [tableInfoRows, columns, indexes] = await Promise.all([
    dbQuery(
      "SELECT TABLE_NAME, ENGINE, TABLE_COLLATION FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
      [TABLE_NAME],
    ),
    readColumns(Object.keys(REQUIRED_COLUMNS)),
    readIndexes(Object.keys(REQUIRED_INDEXES)),
  ]);

  const indexMap = new Map(indexes.map((index) => [index.INDEX_NAME, String(index.columns)]));

  return {
    columns,
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
  AUTH_IDENTITY_SOURCE_USER_UNIQUE_INDEX,
  AUTH_RUNTIME_TABLES,
  CREATE_TABLE_SQL,
  REQUIRED_COLUMNS,
  REQUIRED_INDEXES,
  TABLE_NAME,
  down,
  ensureSchema,
  readState,
  status,
  up,
};
