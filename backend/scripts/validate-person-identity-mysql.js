#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const {
  createPeopleNormalizedIdentityMigration,
} = require("../src/database/migrations/20260717220000_add_people_normalized_identity_columns.js");

const DATABASE_PATTERN = /^j12_identity_validation(?:_[a-z0-9]+)?$/u;
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const OWNER_TABLE = "j12_identity_validation_owner";
const OWNER_TOKEN = "SPRINT_27_17A_4_1C";
const MODES = new Set(["preflight", "bootstrap", "validate", "cleanup", "full"]);

function parseArguments(argv) {
  const options = { mode: argv[0] || "preflight" };
  for (const argument of argv.slice(1)) {
    const [name, value] = argument.split("=", 2);
    if (name === "--confirm-local") options.confirmLocal = true;
    else if (name === "--confirm-empty") options.confirmEmpty = true;
    else if (name === "--confirm-cleanup") options.confirmCleanup = true;
    else if (name === "--database") options.database = value;
    else if (name === "--batch-size") options.batchSize = Number(value);
    else throw new Error(`Unsupported argument: ${name}`);
  }
  if (!MODES.has(options.mode)) throw new Error(`Unsupported mode: ${options.mode}`);
  return options;
}

function resolveSafeConfig(options, env = process.env) {
  const config = {
    database: options.database || env.IDENTITY_MYSQL_DATABASE,
    host: env.IDENTITY_MYSQL_HOST,
    password: env.IDENTITY_MYSQL_PASSWORD,
    port: Number(env.IDENTITY_MYSQL_PORT),
    user: env.IDENTITY_MYSQL_USER,
  };
  if (!options.confirmLocal) throw new Error("LOCAL_CONFIRMATION_REQUIRED");
  if (!LOCAL_HOSTS.has(config.host)) throw new Error("REMOTE_HOST_BLOCKED");
  if (!DATABASE_PATTERN.test(config.database || "")) throw new Error("DATABASE_NAME_BLOCKED");
  if (!Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) {
    throw new Error("LOCAL_PORT_INVALID");
  }
  if (!config.user || !config.password) throw new Error("LOCAL_CREDENTIALS_REQUIRED");
  return Object.freeze(config);
}

function sanitizedFailure(error) {
  return { code: error.code || error.message || "IDENTITY_VALIDATION_FAILED", ok: false };
}

async function connect(config) {
  const mysql = require("mysql2/promise");
  return mysql.createConnection({
    host: config.host,
    password: config.password,
    port: config.port,
    user: config.user,
  });
}

async function prepareSchema(connection, config, options) {
  const [schemas] = await connection.query(
    "SELECT SCHEMA_NAME FROM information_schema.schemata WHERE SCHEMA_NAME = ?",
    [config.database],
  );
  if (schemas.length && !options.confirmEmpty) throw new Error("EXISTING_SCHEMA_BLOCKED");
  if (!schemas.length) {
    await connection.query(
      `CREATE DATABASE \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  }
  await connection.changeUser({ database: config.database });
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${OWNER_TABLE} (owner_token VARCHAR(64) PRIMARY KEY) ENGINE=InnoDB`,
  );
  await connection.query(`INSERT IGNORE INTO ${OWNER_TABLE} (owner_token) VALUES (?)`, [
    OWNER_TOKEN,
  ]);
}

async function applyFoundation(connection) {
  const filename = path.resolve(
    __dirname,
    "../src/database/migrations/20260712183000_create_people_domain_tables.sql",
  );
  const upSql = fs.readFileSync(filename, "utf8").split("-- DOWN", 1)[0];
  const statements = upSql
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);
  for (const statement of statements) await connection.query(statement);
}

function createQueryRunner(connection) {
  return async (sql, params = []) => {
    const [rows] = await connection.query(sql, params);
    return rows;
  };
}

async function physicalEvidence(connection, migration) {
  const [server] = await connection.query(
    "SELECT VERSION() version, @@default_storage_engine default_engine, @@character_set_database charset_name, @@collation_database collation_name",
  );
  const [table] = await connection.query(
    "SELECT ENGINE, TABLE_COLLATION FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='people'",
  );
  const [columns] = await connection.query(
    "SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='people'",
  );
  const [indexes] = await connection.query(
    "SELECT INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) columns_list FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='people' GROUP BY INDEX_NAME, NON_UNIQUE",
  );
  const names = new Set([
    "cpf_normalized",
    "email_normalized",
    "telefone_normalized",
    "celular_normalized",
  ]);
  const normalizedColumns = columns.filter((column) => names.has(column.COLUMN_NAME));
  const uniqueCpf = indexes.some(
    (index) => Number(index.NON_UNIQUE) === 0 && index.columns_list === "cpf_normalized",
  );
  const normalizedIndexCount = indexes.filter((index) =>
    /^idx_people_(cpf|email|telefone|celular)_normalized$/u.test(index.INDEX_NAME),
  ).length;
  const nullable = normalizedColumns.every(
    (column) => String(column.IS_NULLABLE).toUpperCase() === "YES",
  );
  return Object.freeze({
    databaseCategory: "LOCAL_DISPOSABLE",
    engine: table[0]?.ENGINE || null,
    mysql: server[0] || null,
    normalizedColumnCount: normalizedColumns.length,
    normalizedColumnsNullable: nullable,
    normalizedIndexCount,
    ok:
      table[0]?.ENGINE === "InnoDB" &&
      normalizedColumns.length === 4 &&
      nullable &&
      normalizedIndexCount === 4 &&
      !uniqueCpf,
    status: await migration.status(),
    tableCollation: table[0]?.TABLE_COLLATION || null,
    uniqueCpfConstraint: uniqueCpf,
  });
}

async function assertOwnedSchema(connection, config) {
  await connection.changeUser({ database: config.database });
  const [rows] = await connection.query(
    `SELECT owner_token FROM ${OWNER_TABLE} WHERE owner_token = ?`,
    [OWNER_TOKEN],
  );
  if (rows.length !== 1) throw new Error("SCHEMA_OWNERSHIP_NOT_PROVEN");
}

async function run(options, env = process.env) {
  const config = resolveSafeConfig(options, env);
  if (options.mode === "preflight") {
    return { isDisposable: true, isLocal: true, isProduction: false, isShared: false, ok: true };
  }
  const connection = await connect(config);
  try {
    if (options.mode === "cleanup") {
      if (!options.confirmCleanup) throw new Error("CLEANUP_CONFIRMATION_REQUIRED");
      await assertOwnedSchema(connection, config);
      await connection.changeUser({ database: undefined });
      await connection.query(`DROP DATABASE \`${config.database}\``);
      return { cleanup: "COMPLETED", ok: true };
    }
    await prepareSchema(connection, config, options);
    await applyFoundation(connection);
    const migration = createPeopleNormalizedIdentityMigration({
      queryRunner: createQueryRunner(connection),
    });
    const startedAt = Date.now();
    const up = await migration.up({ batchSize: options.batchSize || 5 });
    const evidence = await physicalEvidence(connection, migration);
    const result = {
      containsRealPii: false,
      evidence,
      migration: up,
      migrationMs: Date.now() - startedAt,
      ok: evidence.ok,
    };
    if (options.mode === "full") {
      const rerunStartedAt = Date.now();
      result.rerun = await migration.up({ batchSize: options.batchSize || 5 });
      result.rerunMs = Date.now() - rerunStartedAt;
    }
    return result;
  } finally {
    await connection.end();
  }
}

async function main() {
  try {
    const result = await run(parseArguments(process.argv.slice(2)));
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify(sanitizedFailure(error)));
    process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = Object.freeze({ parseArguments, resolveSafeConfig, run, sanitizedFailure });
