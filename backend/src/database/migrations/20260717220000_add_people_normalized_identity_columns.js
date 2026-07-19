#!/usr/bin/env node

const {
  normalizeCpf,
  normalizeEmail,
  normalizePhone,
} = require("../../domains/pessoas/person-identity-normalizer.js");

const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 2000;
const PEOPLE_TABLE = "people";

const NORMALIZED_COLUMNS = Object.freeze({
  celular_normalized: "VARCHAR(50) NULL",
  cpf_normalized: "VARCHAR(11) NULL",
  email_normalized: "VARCHAR(191) NULL",
  telefone_normalized: "VARCHAR(50) NULL",
});

const NORMALIZED_INDEXES = Object.freeze({
  idx_people_celular_normalized: "celular_normalized",
  idx_people_cpf_normalized: "cpf_normalized",
  idx_people_email_normalized: "email_normalized",
  idx_people_telefone_normalized: "telefone_normalized",
});

const PEOPLE_IDENTITY_MIGRATION_ERRORS = Object.freeze({
  BACKFILL_INCOMPLETE: "PEOPLE_IDENTITY_BACKFILL_INCOMPLETE",
  DOWN_BLOCKED: "PEOPLE_IDENTITY_DOWN_BLOCKED",
  DUPLICATES_FOUND: "PEOPLE_IDENTITY_DUPLICATES_FOUND",
  SCHEMA_UNSAFE: "PEOPLE_IDENTITY_SCHEMA_UNSAFE",
});

function createPeopleNormalizedIdentityMigration({ queryRunner, logger = () => {} } = {}) {
  if (typeof queryRunner !== "function") throw new TypeError("Migration requires queryRunner.");

  async function up(options = {}) {
    const batchSize = boundedBatchSize(options.batchSize);
    await assertPeopleTableExists(queryRunner);
    const preflight = await auditRawCpfConflicts({ batchSize, queryRunner });
    if (preflight.duplicateGroups > 0) {
      throw migrationError(
        PEOPLE_IDENTITY_MIGRATION_ERRORS.DUPLICATES_FOUND,
        "Normalized CPF duplicates block the identity migration.",
        preflight,
      );
    }

    for (const [column, definition] of Object.entries(NORMALIZED_COLUMNS)) {
      await ensureColumn(queryRunner, column, definition);
    }
    if (await hasUniqueCpfConstraint(queryRunner)) {
      throw migrationError(
        PEOPLE_IDENTITY_MIGRATION_ERRORS.SCHEMA_UNSAFE,
        "An unapproved unique constraint involving cpf_normalized already exists.",
      );
    }

    const backfill = await backfillPeopleIdentity({ batchSize, logger, queryRunner });
    const conflicts = await readCpfConflicts(queryRunner);

    for (const [index, column] of Object.entries(NORMALIZED_INDEXES)) {
      await ensureIndex(queryRunner, index, column);
    }

    const result = Object.freeze({
      backfill,
      duplicateCpfGroups: conflicts.duplicateGroups,
      duplicateCpfRecords: conflicts.duplicateRecords,
      uniqueCpfConstraintCreated: false,
      uniqueCpfConstraintReason: "BUSINESS_SCOPE_AND_EXISTING_DATA_NOT_APPROVED",
    });
    logger({ event: "people_identity_migration_up", ...result });
    return result;
  }

  async function down() {
    await assertPeopleTableExists(queryRunner);
    const existingColumns = [];
    for (const column of Object.keys(NORMALIZED_COLUMNS)) {
      if (await columnExists(queryRunner, column)) existingColumns.push(column);
    }
    const populated = await countPopulatedNormalizedValues(queryRunner, existingColumns);
    if (populated > 0) {
      throw migrationError(
        PEOPLE_IDENTITY_MIGRATION_ERRORS.DOWN_BLOCKED,
        "Normalized identity columns contain data; automatic rollback is blocked.",
        { populatedRecords: populated },
      );
    }

    for (const index of Object.keys(NORMALIZED_INDEXES)) {
      if (await indexExists(queryRunner, index)) {
        await queryRunner(`ALTER TABLE ${PEOPLE_TABLE} DROP INDEX ${index}`);
      }
    }
    for (const column of Object.keys(NORMALIZED_COLUMNS)) {
      if (await columnExists(queryRunner, column)) {
        await queryRunner(`ALTER TABLE ${PEOPLE_TABLE} DROP COLUMN ${column}`);
      }
    }
    const result = Object.freeze({ removedEmptyColumns: true });
    logger({ event: "people_identity_migration_down", ...result });
    return result;
  }

  async function status() {
    const tableExists = await peopleTableExists(queryRunner);
    if (!tableExists) {
      return Object.freeze({
        backfillPendingOrInvalid: null,
        columns: Object.freeze({}),
        duplicateCpfGroups: null,
        indexes: Object.freeze({}),
        tableExists: false,
        uniqueCpfConstraintActive: false,
      });
    }

    const columns = {};
    for (const column of Object.keys(NORMALIZED_COLUMNS)) {
      columns[column] = await columnExists(queryRunner, column);
    }
    const indexes = {};
    for (const index of Object.keys(NORMALIZED_INDEXES)) {
      indexes[index] = await indexExists(queryRunner, index);
    }
    const schemaReady = Object.values(columns).every(Boolean);
    const pending = schemaReady ? await countPendingOrInvalid(queryRunner) : null;
    const conflicts = schemaReady ? await readCpfConflicts(queryRunner) : null;
    const uniqueCpfConstraintActive = schemaReady
      ? await hasUniqueCpfConstraint(queryRunner)
      : false;
    const result = Object.freeze({
      backfillPendingOrInvalid: pending,
      columns: Object.freeze(columns),
      duplicateCpfGroups: conflicts?.duplicateGroups ?? null,
      indexes: Object.freeze(indexes),
      tableExists: true,
      uniqueCpfConstraintActive,
    });
    logger({ event: "people_identity_migration_status", ...result });
    return result;
  }

  return Object.freeze({ down, status, up });
}

async function auditRawCpfConflicts({ batchSize = DEFAULT_BATCH_SIZE, queryRunner } = {}) {
  if (typeof queryRunner !== "function") throw new TypeError("CPF preflight requires queryRunner.");
  const limit = boundedBatchSize(batchSize);
  const groups = new Map();
  let cursor = "";

  while (true) {
    const rows = await queryRunner(
      `SELECT id, cpf FROM ${PEOPLE_TABLE} WHERE id > ? ORDER BY id ASC LIMIT ?`,
      [cursor, limit],
    );
    const page = Array.isArray(rows) ? rows : [];
    if (page.length === 0) break;

    for (const row of page) {
      let normalized = null;
      try {
        normalized = normalizeCpf(row?.cpf);
      } catch {
        normalized = null;
      }
      if (normalized) groups.set(normalized, (groups.get(normalized) || 0) + 1);
    }

    cursor = String(page.at(-1)?.id ?? "");
    if (!cursor) {
      throw migrationError(
        PEOPLE_IDENTITY_MIGRATION_ERRORS.BACKFILL_INCOMPLETE,
        "CPF preflight page returned an invalid cursor.",
      );
    }
    if (page.length < limit) break;
  }

  const duplicateSizes = [...groups.values()].filter((count) => count > 1);
  return Object.freeze({
    duplicateGroups: duplicateSizes.length,
    duplicateRecords: duplicateSizes.reduce((total, count) => total + count, 0),
  });
}

async function backfillPeopleIdentity({
  batchSize = DEFAULT_BATCH_SIZE,
  logger = () => {},
  queryRunner,
} = {}) {
  if (typeof queryRunner !== "function") throw new TypeError("Backfill requires queryRunner.");
  const limit = boundedBatchSize(batchSize);
  const metrics = {
    batchesProcessed: 0,
    invalidRecords: 0,
    recordsNormalized: 0,
    recordsProcessed: 0,
    recordsSkipped: 0,
  };
  let cursor = "";

  while (true) {
    const rows = await queryRunner(
      `SELECT id, cpf, email, telefone, celular, cpf_normalized, email_normalized, telefone_normalized, celular_normalized
       FROM ${PEOPLE_TABLE}
       WHERE id > ?
       ORDER BY id ASC
       LIMIT ?`,
      [cursor, limit],
    );
    const page = Array.isArray(rows) ? rows : [];
    if (page.length === 0) break;
    metrics.batchesProcessed += 1;

    for (const row of page) {
      const normalized = normalizeBackfillRow(row);
      metrics.recordsProcessed += 1;
      if (normalized.invalidFields.length > 0) metrics.invalidRecords += 1;

      const assignments = [];
      const params = [];
      for (const [column, value] of Object.entries(normalized.values)) {
        if (value === null || nullishEqual(row[column], value)) continue;
        assignments.push(`${column} = ?`);
        params.push(value);
      }

      if (assignments.length === 0) {
        metrics.recordsSkipped += 1;
      } else {
        params.push(String(row.id));
        await queryRunner(
          `UPDATE ${PEOPLE_TABLE} SET ${assignments.join(", ")} WHERE id = ?`,
          params,
        );
        metrics.recordsNormalized += 1;
      }
    }

    cursor = String(page.at(-1)?.id ?? "");
    if (!cursor) {
      throw migrationError(
        PEOPLE_IDENTITY_MIGRATION_ERRORS.BACKFILL_INCOMPLETE,
        "Backfill page returned an invalid cursor.",
      );
    }
    logger({ event: "people_identity_backfill_batch", ...metrics });
    if (page.length < limit) break;
  }

  return Object.freeze({ ...metrics });
}

function normalizeBackfillRow(row) {
  const fields = [
    ["cpf_normalized", row?.cpf, normalizeCpf],
    ["email_normalized", row?.email, normalizeEmail],
    ["telefone_normalized", row?.telefone, normalizePhone],
    ["celular_normalized", row?.celular, normalizePhone],
  ];
  const invalidFields = [];
  const values = {};
  for (const [column, source, normalizer] of fields) {
    try {
      values[column] = normalizer(source);
    } catch {
      values[column] = null;
      invalidFields.push(column);
    }
  }
  return Object.freeze({
    invalidFields: Object.freeze(invalidFields),
    values: Object.freeze(values),
  });
}

async function ensureColumn(queryRunner, column, definition) {
  const existing = await readColumn(queryRunner, column);
  if (existing) {
    assertCompatibleColumn(column, existing);
    return false;
  }
  await queryRunner(`ALTER TABLE ${PEOPLE_TABLE} ADD COLUMN ${column} ${definition}`);
  assertCompatibleColumn(column, await readColumn(queryRunner, column));
  return true;
}

async function ensureIndex(queryRunner, index, column) {
  const existing = await readIndex(queryRunner, index);
  if (existing) {
    assertCompatibleIndex(index, existing, column);
    return false;
  }
  await queryRunner(`ALTER TABLE ${PEOPLE_TABLE} ADD INDEX ${index} (${column})`);
  assertCompatibleIndex(index, await readIndex(queryRunner, index), column);
  return true;
}

function assertCompatibleColumn(column, row) {
  const expectedLength =
    column === "cpf_normalized" ? 11 : column === "email_normalized" ? 191 : 50;
  if (
    !row ||
    String(row.DATA_TYPE).toLowerCase() !== "varchar" ||
    Number(row.CHARACTER_MAXIMUM_LENGTH) !== expectedLength ||
    String(row.IS_NULLABLE).toUpperCase() !== "YES"
  ) {
    throw migrationError(
      PEOPLE_IDENTITY_MIGRATION_ERRORS.SCHEMA_UNSAFE,
      `Existing normalized identity column ${column} is incompatible.`,
      { column },
    );
  }
}

function assertCompatibleIndex(index, row, column) {
  if (!row || Number(row.NON_UNIQUE) !== 1 || String(row.columns) !== column) {
    throw migrationError(
      PEOPLE_IDENTITY_MIGRATION_ERRORS.SCHEMA_UNSAFE,
      `Existing normalized identity index ${index} is incompatible.`,
      { index },
    );
  }
}

async function peopleTableExists(queryRunner) {
  const rows = await queryRunner(
    "SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=? LIMIT 1",
    [PEOPLE_TABLE],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function assertPeopleTableExists(queryRunner) {
  if (!(await peopleTableExists(queryRunner))) {
    throw migrationError(
      PEOPLE_IDENTITY_MIGRATION_ERRORS.SCHEMA_UNSAFE,
      "Required people table does not exist.",
    );
  }
}

async function readColumn(queryRunner, column) {
  const rows = await queryRunner(
    "SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=? LIMIT 1",
    [PEOPLE_TABLE, column],
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function columnExists(queryRunner, column) {
  return Boolean(await readColumn(queryRunner, column));
}

async function readIndex(queryRunner, index) {
  const rows = await queryRunner(
    "SELECT INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') columns FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=? GROUP BY INDEX_NAME, NON_UNIQUE",
    [PEOPLE_TABLE, index],
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function hasUniqueCpfConstraint(queryRunner) {
  const rows = await queryRunner(
    "SELECT DISTINCT INDEX_NAME FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND column_name=? AND NON_UNIQUE=0 AND INDEX_NAME<>'PRIMARY'",
    [PEOPLE_TABLE, "cpf_normalized"],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function indexExists(queryRunner, index) {
  return Boolean(await readIndex(queryRunner, index));
}

async function readCpfConflicts(queryRunner) {
  const rows = await queryRunner(
    `SELECT COUNT(*) duplicate_groups, COALESCE(SUM(group_size), 0) duplicate_records
     FROM (
       SELECT COUNT(*) group_size
       FROM ${PEOPLE_TABLE}
       WHERE cpf_normalized IS NOT NULL
       GROUP BY cpf_normalized
       HAVING COUNT(*) > 1
     ) duplicate_cpf_groups`,
  );
  return Object.freeze({
    duplicateGroups: safeCount(rows?.[0]?.duplicate_groups),
    duplicateRecords: safeCount(rows?.[0]?.duplicate_records),
  });
}

async function countPendingOrInvalid(queryRunner) {
  const rows = await queryRunner(
    `SELECT COUNT(*) total FROM ${PEOPLE_TABLE}
     WHERE (NULLIF(TRIM(cpf), '') IS NOT NULL AND cpf_normalized IS NULL)
        OR (NULLIF(TRIM(email), '') IS NOT NULL AND email_normalized IS NULL)
        OR (NULLIF(TRIM(telefone), '') IS NOT NULL AND telefone_normalized IS NULL)
        OR (NULLIF(TRIM(celular), '') IS NOT NULL AND celular_normalized IS NULL)`,
  );
  return safeCount(rows?.[0]?.total);
}

async function countPopulatedNormalizedValues(queryRunner, columns) {
  if (columns.length === 0) return 0;
  const rows = await queryRunner(
    `SELECT COUNT(*) total FROM ${PEOPLE_TABLE}
     WHERE ${columns.map((column) => `${column} IS NOT NULL`).join(" OR ")}`,
  );
  return safeCount(rows?.[0]?.total);
}

function boundedBatchSize(value = DEFAULT_BATCH_SIZE) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_BATCH_SIZE) {
    throw new RangeError(`batchSize must be an integer between 1 and ${MAX_BATCH_SIZE}.`);
  }
  return parsed;
}

function safeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function nullishEqual(left, right) {
  return (left === null || left === undefined ? null : String(left)) === right;
}

function migrationError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

let defaultMigration;
function getDefaultMigration() {
  if (!defaultMigration) {
    const database = require("../../config/db.js");
    defaultMigration = createPeopleNormalizedIdentityMigration({
      logger: (entry) => console.log(JSON.stringify(entry)),
      queryRunner: database.query,
    });
  }
  return defaultMigration;
}

async function main() {
  const command = process.argv[2] || "status";
  const operation = getDefaultMigration()[command];
  if (typeof operation !== "function") throw new Error(`Unknown command: ${command}.`);
  const result = await operation();
  console.log(JSON.stringify(result));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(
        JSON.stringify({ code: error.code || "MIGRATION_FAILED", message: error.message }),
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      const pool = require("../../config/db.js").pool;
      if (pool && typeof pool.end === "function") await pool.end();
    });
}

module.exports = Object.freeze({
  DEFAULT_BATCH_SIZE,
  MAX_BATCH_SIZE,
  NORMALIZED_COLUMNS,
  NORMALIZED_INDEXES,
  PEOPLE_IDENTITY_MIGRATION_ERRORS,
  assertCompatibleColumn,
  assertCompatibleIndex,
  auditRawCpfConflicts,
  backfillPeopleIdentity,
  createPeopleNormalizedIdentityMigration,
  normalizeBackfillRow,
});
