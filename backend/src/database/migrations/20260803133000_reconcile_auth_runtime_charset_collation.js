#!/usr/bin/env node
"use strict";

const MIGRATION_ID = "20260803133000_reconcile_auth_runtime_charset_collation";
const TABLES = Object.freeze(["users", "user_sessions", "password_reset_tokens"]);
const TARGET = Object.freeze({
  engine: "InnoDB",
  charset: "utf8mb4",
  collation: "utf8mb4_unicode_ci",
});
const ERROR_CODES = Object.freeze({
  DOWN_UNSAFE: "AUTH_RUNTIME_TABLE_OPTIONS_DOWN_UNSAFE",
  PREFLIGHT_BLOCKED: "AUTH_RUNTIME_TABLE_OPTIONS_PREFLIGHT_BLOCKED",
  POST_VALIDATION_FAILED: "AUTH_RUNTIME_TABLE_OPTIONS_POST_VALIDATION_FAILED",
});

const EXPECTED_TEXT_COLUMNS = Object.freeze({
  users: Object.freeze({
    id: ["varchar(64)", false],
    name: ["varchar(191)", false],
    email: ["varchar(191)", false],
    login: ["varchar(191)", false],
    password_hash: ["varchar(255)", false],
    password_salt: ["varchar(255)", false],
    role: ["varchar(50)", false],
    aluno_id: ["varchar(64)", true],
    professor_id: ["varchar(64)", true],
    responsavel_id: ["varchar(64)", true],
    linked_aluno_id: ["varchar(64)", true],
    class_scope_json: ["longtext", true],
    phone_whatsapp: ["varchar(50)", true],
    status: ["varchar(30)", false],
  }),
  user_sessions: Object.freeze({
    token: ["varchar(128)", false],
    user_id: ["varchar(64)", false],
  }),
  password_reset_tokens: Object.freeze({
    token: ["varchar(128)", false],
    user_id: ["varchar(64)", false],
    channel: ["varchar(30)", false],
  }),
});

const SAFE_LENGTH_COLUMNS = Object.freeze({
  users: Object.freeze([
    "id",
    "name",
    "email",
    "login",
    "role",
    "aluno_id",
    "professor_id",
    "responsavel_id",
    "linked_aluno_id",
    "class_scope_json",
    "phone_whatsapp",
    "status",
  ]),
  user_sessions: Object.freeze(["user_id"]),
  password_reset_tokens: Object.freeze(["user_id", "channel"]),
});
const EXPECTED_INDEXES = Object.freeze({
  users: Object.freeze({
    PRIMARY: [true, ["id"]],
    uniq_users_email: [true, ["email"]],
    uniq_users_login: [true, ["login"]],
    idx_users_role: [false, ["role"]],
    idx_users_aluno: [false, ["aluno_id"]],
    idx_users_professor: [false, ["professor_id"]],
    idx_users_responsavel: [false, ["responsavel_id"]],
  }),
  user_sessions: Object.freeze({
    PRIMARY: [true, ["token"]],
    idx_sessions_user: [false, ["user_id"]],
    idx_sessions_expires: [false, ["expires_at"]],
  }),
  password_reset_tokens: Object.freeze({
    PRIMARY: [true, ["token"]],
    idx_password_reset_user: [false, ["user_id"]],
    idx_password_reset_expires: [false, ["expires_at"]],
  }),
});

function rowsOf(result) {
  return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result || [];
}

function lower(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase();
}

function sourceCharset(value) {
  return ["utf8", "utf8mb3"].includes(lower(value));
}

function sourceCollation(value) {
  return ["utf8_unicode_ci", "utf8mb3_unicode_ci"].includes(lower(value));
}

function charsetFromCollation(value) {
  const normalized = lower(value);
  return normalized ? normalized.split("_")[0] : null;
}

function placeholders(values) {
  return values.map(() => "?").join(",");
}

async function collectAuthRuntimePreflight({ queryRunner }) {
  if (typeof queryRunner !== "function")
    throw new TypeError("Auth Runtime preflight requires queryRunner.");

  const serverRows = rowsOf(
    await queryRunner("SELECT VERSION() AS version, @@SESSION.sql_mode AS sql_mode"),
  );
  const tableRows = rowsOf(
    await queryRunner(
      `SELECT TABLE_NAME,ENGINE,TABLE_COLLATION,ROW_FORMAT,TABLE_ROWS,DATA_LENGTH,INDEX_LENGTH,DATA_FREE
       FROM information_schema.tables
       WHERE table_schema=DATABASE() AND table_name IN (${placeholders(TABLES)})`,
      TABLES,
    ),
  );
  const columnRows = rowsOf(
    await queryRunner(
      `SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,CHARACTER_SET_NAME,COLLATION_NAME,
              CHARACTER_MAXIMUM_LENGTH
       FROM information_schema.columns
       WHERE table_schema=DATABASE() AND table_name IN (${placeholders(TABLES)})
         AND CHARACTER_SET_NAME IS NOT NULL
       ORDER BY TABLE_NAME,ORDINAL_POSITION`,
      TABLES,
    ),
  );
  const indexRows = rowsOf(
    await queryRunner(
      `SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME,SUB_PART
       FROM information_schema.statistics
       WHERE table_schema=DATABASE() AND table_name IN (${placeholders(TABLES)})
       ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX`,
      TABLES,
    ),
  );
  const foreignKeyRows = rowsOf(
    await queryRunner(
      `SELECT TABLE_NAME,CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME
       FROM information_schema.key_column_usage
       WHERE table_schema=DATABASE() AND referenced_table_name IS NOT NULL
         AND (table_name IN (${placeholders(TABLES)})
           OR referenced_table_name IN (${placeholders(TABLES)}))`,
      [...TABLES, ...TABLES],
    ),
  );

  const blockers = [];
  const tables = [];
  for (const tableName of TABLES) {
    const metadata = tableRows.find((row) => row.TABLE_NAME === tableName);
    if (!metadata) {
      blockers.push({ code: "TABLE_MISSING", table: tableName });
      continue;
    }
    const charset = charsetFromCollation(metadata.TABLE_COLLATION);
    const collation = lower(metadata.TABLE_COLLATION);
    if (lower(metadata.ENGINE) !== lower(TARGET.engine))
      blockers.push({
        code: "ENGINE_UNSAFE",
        table: tableName,
        actual: metadata.ENGINE,
        expected: TARGET.engine,
      });
    if (charset !== TARGET.charset && !sourceCharset(charset))
      blockers.push({ code: "CHARSET_UNSUPPORTED", table: tableName, actual: charset });
    if (collation !== TARGET.collation && !sourceCollation(collation))
      blockers.push({ code: "COLLATION_UNSUPPORTED", table: tableName, actual: collation });

    const expectedColumns = EXPECTED_TEXT_COLUMNS[tableName];
    const actualColumns = columnRows.filter((row) => row.TABLE_NAME === tableName);
    for (const [columnName, [columnType, nullable]] of Object.entries(expectedColumns)) {
      const column = actualColumns.find((row) => row.COLUMN_NAME === columnName);
      if (
        !column ||
        lower(column.COLUMN_TYPE) !== columnType ||
        (String(column.IS_NULLABLE).toUpperCase() === "YES") !== nullable
      ) {
        blockers.push({
          code: "TEXT_COLUMN_INCOMPATIBLE",
          table: tableName,
          column: columnName,
        });
        continue;
      }
      const expectedColumnCharset = charset === "utf8mb3" ? "utf8mb3" : charset;
      if (
        lower(column.CHARACTER_SET_NAME) !== expectedColumnCharset ||
        lower(column.COLLATION_NAME) !== collation
      )
        blockers.push({
          code: "MIXED_TEXT_COLUMN_OPTIONS",
          table: tableName,
          column: columnName,
        });
    }
    const unexpectedTextColumns = actualColumns
      .map((row) => row.COLUMN_NAME)
      .filter((columnName) => !Object.hasOwn(expectedColumns, columnName));
    if (unexpectedTextColumns.length)
      blockers.push({
        code: "UNREVIEWED_TEXT_COLUMNS",
        table: tableName,
        columns: unexpectedTextColumns,
      });

    const rowFormat = metadata.ROW_FORMAT || null;
    const indexLimitBytes = ["compact", "redundant"].includes(lower(rowFormat)) ? 767 : 3072;
    const tableIndexes = groupIndexes(
      indexRows.filter((row) => row.TABLE_NAME === tableName),
      actualColumns,
    );
    for (const [indexName, [unique, columns]] of Object.entries(EXPECTED_INDEXES[tableName])) {
      const index = tableIndexes.find((candidate) => candidate.name === indexName);
      if (!index || index.unique !== unique || index.columns.join(",") !== columns.join(","))
        blockers.push({
          code: "INDEX_INCOMPATIBLE",
          table: tableName,
          index: indexName,
        });
    }
    const overflowingIndexes = tableIndexes.filter(
      (index) => index.maximumUtf8mb4Bytes > indexLimitBytes,
    );
    for (const index of overflowingIndexes)
      blockers.push({
        code: "UTF8MB4_INDEX_SIZE_UNSAFE",
        table: tableName,
        index: index.name,
        maximumBytes: index.maximumUtf8mb4Bytes,
        limitBytes: indexLimitBytes,
      });

    const tableForeignKeys = foreignKeyRows.filter(
      (row) => row.TABLE_NAME === tableName || row.REFERENCED_TABLE_NAME === tableName,
    );
    if (tableForeignKeys.length)
      blockers.push({
        code: "FOREIGN_KEY_REVIEW_REQUIRED",
        table: tableName,
        constraints: [...new Set(tableForeignKeys.map((row) => row.CONSTRAINT_NAME))],
      });

    const maximumValueLengths = await readMaximumValueLengths(
      queryRunner,
      tableName,
      SAFE_LENGTH_COLUMNS[tableName],
    );
    const bytes = Number(metadata.DATA_LENGTH || 0) + Number(metadata.INDEX_LENGTH || 0);
    tables.push(
      Object.freeze({
        name: tableName,
        engine: metadata.ENGINE || null,
        rowFormat,
        charset,
        collation,
        expectedCharset: TARGET.charset,
        expectedCollation: TARGET.collation,
        requiresChange: charset !== TARGET.charset || collation !== TARGET.collation,
        rowsEstimate: metadata.TABLE_ROWS == null ? null : Number(metadata.TABLE_ROWS),
        dataLengthBytes: metadata.DATA_LENGTH == null ? null : Number(metadata.DATA_LENGTH),
        indexLengthBytes: metadata.INDEX_LENGTH == null ? null : Number(metadata.INDEX_LENGTH),
        dataFreeBytes: metadata.DATA_FREE == null ? null : Number(metadata.DATA_FREE),
        estimatedRebuildBytes: bytes || null,
        textColumnCount: actualColumns.length,
        maximumValueLengths,
        sensitiveValueLengths: "NOT_QUERIED",
        indexLimitBytes,
        largestIndexBytes: Math.max(0, ...tableIndexes.map((index) => index.maximumUtf8mb4Bytes)),
        indexOverflowRisk: overflowingIndexes.length > 0,
        foreignKeyCount: tableForeignKeys.length,
        lockRisk: qualitativeRisk(metadata),
      }),
    );
  }

  const riskLevel = highestRisk(tables.map((table) => table.lockRisk));
  return Object.freeze({
    migrationId: MIGRATION_ID,
    readOnly: true,
    scope: TABLES,
    server: Object.freeze({
      version: serverRows[0]?.version || null,
      sqlMode: serverRows[0]?.sql_mode || null,
    }),
    target: TARGET,
    tables: Object.freeze(tables),
    tableCount: tables.length,
    changeCount: tables.filter((table) => table.requiresChange).length,
    blockers: Object.freeze(blockers),
    safeToApply: blockers.length === 0 && tables.length === TABLES.length,
    riskLevel,
    lockRisk:
      "ALTER TABLE ... CONVERT pode reconstruir a tabela, obter metadata lock e interromper escritas.",
    ddlImplicitCommit: true,
    backupRequired: true,
    filesystemFreeSpaceBytes: null,
    freeSpaceAssessment:
      "Espaço livre do filesystem não está disponível via metadados portáveis; validar externamente antes do write.",
    encodingValidation:
      "utf8/utf8mb3 é subconjunto válido de utf8mb4; nenhum valor sensível foi lido.",
  });
}

function groupIndexes(rows, columns) {
  const byName = new Map();
  for (const row of rows) {
    const index = byName.get(row.INDEX_NAME) || {
      name: row.INDEX_NAME,
      unique: Number(row.NON_UNIQUE) === 0,
      maximumUtf8mb4Bytes: 0,
      columns: [],
    };
    index.columns.push(row.COLUMN_NAME);
    const column = columns.find((candidate) => candidate.COLUMN_NAME === row.COLUMN_NAME);
    if (column) {
      const declaredLength = Number(column.CHARACTER_MAXIMUM_LENGTH || 0);
      const indexedLength =
        row.SUB_PART == null ? declaredLength : Math.min(declaredLength, Number(row.SUB_PART));
      index.maximumUtf8mb4Bytes += indexedLength * 4;
    }
    byName.set(row.INDEX_NAME, index);
  }
  return [...byName.values()];
}

async function readMaximumValueLengths(queryRunner, tableName, columns) {
  const expressions = columns.map((column) => `MAX(CHAR_LENGTH(\`${column}\`)) AS \`${column}\``);
  const rows = rowsOf(await queryRunner(`SELECT ${expressions.join(",")} FROM \`${tableName}\``));
  const row = rows[0] || {};
  return Object.freeze(
    Object.fromEntries(
      columns.map((column) => [column, row[column] == null ? null : Number(row[column])]),
    ),
  );
}

function qualitativeRisk(metadata) {
  const rows = Number(metadata.TABLE_ROWS || 0);
  const bytes = Number(metadata.DATA_LENGTH || 0) + Number(metadata.INDEX_LENGTH || 0);
  if (!metadata.TABLE_ROWS && !bytes) return "MEDIUM";
  if (rows >= 1000000 || bytes >= 1073741824) return "HIGH";
  if (rows >= 100000 || bytes >= 104857600) return "MEDIUM";
  return "LOW";
}

function highestRisk(risks) {
  if (risks.includes("HIGH")) return "HIGH";
  if (risks.includes("MEDIUM")) return "MEDIUM";
  return risks.length ? "LOW" : "HIGH";
}

function assertSafe(preflight, code = ERROR_CODES.PREFLIGHT_BLOCKED) {
  if (preflight.safeToApply) return;
  throw migrationError(
    code,
    `Auth Runtime reconciliation blocked: ${
      preflight.blockers.map((blocker) => blocker.code).join(", ") || "incomplete preflight"
    }.`,
    { blockers: preflight.blockers },
  );
}

function assertCanonical(preflight) {
  const invalid = preflight.tables.filter(
    (table) =>
      lower(table.engine) !== lower(TARGET.engine) ||
      table.charset !== TARGET.charset ||
      table.collation !== TARGET.collation,
  );
  if (invalid.length)
    throw migrationError(
      ERROR_CODES.POST_VALIDATION_FAILED,
      `Auth Runtime table options were not reconciled: ${invalid
        .map((table) => table.name)
        .join(", ")}.`,
    );
}

function createAuthRuntimeCharsetCollationReconciliation({ queryRunner, tableExists } = {}) {
  if (typeof queryRunner !== "function" || typeof tableExists !== "function")
    throw new TypeError("Migration requires queryRunner and tableExists.");

  async function up() {
    for (const tableName of TABLES) {
      if (!(await tableExists(tableName)))
        throw migrationError(
          ERROR_CODES.PREFLIGHT_BLOCKED,
          `Required table ${tableName} is missing.`,
        );
    }
    const before = await collectAuthRuntimePreflight({ queryRunner });
    assertSafe(before);
    for (const table of before.tables) {
      if (!table.requiresChange) continue;
      await queryRunner(
        `ALTER TABLE \`${table.name}\` CONVERT TO CHARACTER SET ${TARGET.charset} COLLATE ${TARGET.collation}`,
      );
    }
    const after = await collectAuthRuntimePreflight({ queryRunner });
    assertSafe(after, ERROR_CODES.POST_VALIDATION_FAILED);
    assertCanonical(after);
    return Object.freeze({
      before,
      after,
      changedTables: before.tables.filter((t) => t.requiresChange).map((t) => t.name),
    });
  }

  async function status() {
    return collectAuthRuntimePreflight({ queryRunner });
  }

  async function down() {
    throw migrationError(
      ERROR_CODES.DOWN_UNSAFE,
      "Rollback automático para utf8 é inseguro: DDL possui commit implícito e pode perder caracteres utf8mb4.",
    );
  }

  return Object.freeze({ down, status, up });
}

function migrationError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

let defaultMigration;
function getDefaultMigration() {
  if (!defaultMigration) {
    const database = require("../../config/db.js");
    defaultMigration = createAuthRuntimeCharsetCollationReconciliation({
      queryRunner: database.query,
      tableExists: database.tableExists,
    });
  }
  return defaultMigration;
}

const up = (...args) => getDefaultMigration().up(...args);
const down = (...args) => getDefaultMigration().down(...args);
const status = (...args) => getDefaultMigration().status(...args);

module.exports = Object.freeze({
  ERROR_CODES,
  EXPECTED_INDEXES,
  EXPECTED_TEXT_COLUMNS,
  MIGRATION_ID,
  SAFE_LENGTH_COLUMNS,
  TABLES,
  TARGET,
  collectAuthRuntimePreflight,
  createAuthRuntimeCharsetCollationReconciliation,
  down,
  status,
  up,
});
