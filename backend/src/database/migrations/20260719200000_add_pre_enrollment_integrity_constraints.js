#!/usr/bin/env node

const PROFILE_TABLE = "person_profiles";
const RELATIONSHIP_TABLE = "person_relationships";
const PROFILE_UNIQUE_INDEX = "ux_person_profiles_person_type";
const RELATIONSHIP_UNIQUE_INDEX = "ux_person_relationships_active_structure";
const ACTIVE_PERSON_COLUMN = "active_person_id";
const ACTIVE_RELATED_PERSON_COLUMN = "active_related_person_id";
const ACTIVE_RELATIONSHIP_TYPE_COLUMN = "active_relationship_type";

const INTEGRITY_MIGRATION_ERRORS = Object.freeze({
  DUPLICATES_FOUND: "PRE_ENROLLMENT_INTEGRITY_DUPLICATES_FOUND",
  SCHEMA_UNSAFE: "PRE_ENROLLMENT_INTEGRITY_SCHEMA_UNSAFE",
});

const GENERATED_COLUMNS = Object.freeze({
  [ACTIVE_PERSON_COLUMN]: Object.freeze({ length: 64, source: "person_id" }),
  [ACTIVE_RELATED_PERSON_COLUMN]: Object.freeze({ length: 64, source: "related_person_id" }),
  [ACTIVE_RELATIONSHIP_TYPE_COLUMN]: Object.freeze({ length: 50, source: "relationship_type" }),
});

function createPreEnrollmentIntegrityMigration({ queryRunner } = {}) {
  if (typeof queryRunner !== "function") throw new TypeError("Migration requires queryRunner.");

  async function up() {
    await assertTableExists(queryRunner, PROFILE_TABLE);
    await assertTableExists(queryRunner, RELATIONSHIP_TABLE);
    await assertRequiredColumns(queryRunner);
    const duplicates = await readDuplicateCounts(queryRunner);
    if (duplicates.profileGroups > 0 || duplicates.relationshipGroups > 0) {
      throw migrationError(
        INTEGRITY_MIGRATION_ERRORS.DUPLICATES_FOUND,
        "Pre-enrollment integrity duplicates require assisted review.",
        duplicates,
      );
    }

    await ensureUniqueIndex(queryRunner, {
      columns: "person_id,profile_type",
      indexName: PROFILE_UNIQUE_INDEX,
      tableName: PROFILE_TABLE,
    });
    for (const [column, contract] of Object.entries(GENERATED_COLUMNS)) {
      await ensureGeneratedColumn(queryRunner, column, contract);
    }
    await ensureUniqueIndex(queryRunner, {
      columns: `${ACTIVE_PERSON_COLUMN},${ACTIVE_RELATED_PERSON_COLUMN},${ACTIVE_RELATIONSHIP_TYPE_COLUMN}`,
      indexName: RELATIONSHIP_UNIQUE_INDEX,
      tableName: RELATIONSHIP_TABLE,
    });
    return status();
  }

  async function down() {
    await assertTableExists(queryRunner, PROFILE_TABLE);
    await assertTableExists(queryRunner, RELATIONSHIP_TABLE);
    await dropIndexIfExists(queryRunner, RELATIONSHIP_TABLE, RELATIONSHIP_UNIQUE_INDEX);
    for (const column of Object.keys(GENERATED_COLUMNS).reverse()) {
      await dropColumnIfExists(queryRunner, RELATIONSHIP_TABLE, column);
    }
    await dropIndexIfExists(queryRunner, PROFILE_TABLE, PROFILE_UNIQUE_INDEX);
    return status();
  }

  async function status() {
    const profileTableExists = await tableExists(queryRunner, PROFILE_TABLE);
    const relationshipTableExists = await tableExists(queryRunner, RELATIONSHIP_TABLE);
    if (!profileTableExists || !relationshipTableExists) {
      return Object.freeze({
        duplicates: null,
        generatedColumns: Object.freeze({}),
        profileTableExists,
        profileUniqueIndex: false,
        relationshipTableExists,
        relationshipUniqueIndex: false,
      });
    }

    const generatedColumns = {};
    for (const [column, contract] of Object.entries(GENERATED_COLUMNS)) {
      const metadata = await readColumn(queryRunner, RELATIONSHIP_TABLE, column);
      if (metadata) assertCompatibleGeneratedColumn(column, metadata, contract);
      generatedColumns[column] = Boolean(metadata);
    }
    const profileIndex = await readIndex(queryRunner, PROFILE_TABLE, PROFILE_UNIQUE_INDEX);
    const relationshipIndex = await readIndex(
      queryRunner,
      RELATIONSHIP_TABLE,
      RELATIONSHIP_UNIQUE_INDEX,
    );
    if (profileIndex) assertCompatibleIndex(profileIndex, "person_id,profile_type");
    if (relationshipIndex) {
      assertCompatibleIndex(
        relationshipIndex,
        `${ACTIVE_PERSON_COLUMN},${ACTIVE_RELATED_PERSON_COLUMN},${ACTIVE_RELATIONSHIP_TYPE_COLUMN}`,
      );
    }

    return Object.freeze({
      duplicates: await readDuplicateCounts(queryRunner),
      generatedColumns: Object.freeze(generatedColumns),
      profileTableExists: true,
      profileUniqueIndex: Boolean(profileIndex),
      relationshipTableExists: true,
      relationshipUniqueIndex: Boolean(relationshipIndex),
    });
  }

  return Object.freeze({ down, status, up });
}

async function assertRequiredColumns(queryRunner) {
  const required = Object.freeze({
    [PROFILE_TABLE]: ["person_id", "profile_type"],
    [RELATIONSHIP_TABLE]: ["person_id", "related_person_id", "relationship_type", "status"],
  });
  for (const [tableName, columns] of Object.entries(required)) {
    for (const column of columns) {
      if (!(await readColumn(queryRunner, tableName, column))) {
        throw migrationError(
          INTEGRITY_MIGRATION_ERRORS.SCHEMA_UNSAFE,
          `Required column ${tableName}.${column} does not exist.`,
        );
      }
    }
  }
}

async function readDuplicateCounts(queryRunner) {
  const [profileRows, relationshipRows] = await Promise.all([
    queryRunner(`
      SELECT COUNT(*) total FROM (
        SELECT person_id, profile_type
        FROM ${PROFILE_TABLE}
        GROUP BY person_id, profile_type
        HAVING COUNT(*) > 1
      ) duplicate_profiles
    `),
    queryRunner(`
      SELECT COUNT(*) total FROM (
        SELECT person_id, related_person_id, relationship_type
        FROM ${RELATIONSHIP_TABLE}
        WHERE status = 'active'
        GROUP BY person_id, related_person_id, relationship_type
        HAVING COUNT(*) > 1
      ) duplicate_relationships
    `),
  ]);
  return Object.freeze({
    profileGroups: safeCount(profileRows?.[0]?.total),
    relationshipGroups: safeCount(relationshipRows?.[0]?.total),
  });
}

async function ensureGeneratedColumn(queryRunner, column, contract) {
  const existing = await readColumn(queryRunner, RELATIONSHIP_TABLE, column);
  if (existing) {
    assertCompatibleGeneratedColumn(column, existing, contract);
    return false;
  }
  await queryRunner(
    `ALTER TABLE ${RELATIONSHIP_TABLE} ADD COLUMN ${column} VARCHAR(${contract.length}) GENERATED ALWAYS AS (CASE WHEN status = 'active' THEN ${contract.source} ELSE NULL END) VIRTUAL`,
  );
  assertCompatibleGeneratedColumn(
    column,
    await readColumn(queryRunner, RELATIONSHIP_TABLE, column),
    contract,
  );
  return true;
}

async function ensureUniqueIndex(queryRunner, { columns, indexName, tableName }) {
  const existing = await readIndex(queryRunner, tableName, indexName);
  if (existing) {
    assertCompatibleIndex(existing, columns);
    return false;
  }
  await queryRunner(`ALTER TABLE ${tableName} ADD UNIQUE INDEX ${indexName} (${columns})`);
  assertCompatibleIndex(await readIndex(queryRunner, tableName, indexName), columns);
  return true;
}

function assertCompatibleGeneratedColumn(column, row, contract) {
  const expression = String(row?.GENERATION_EXPRESSION ?? "").toLowerCase();
  if (
    String(row?.DATA_TYPE ?? "").toLowerCase() !== "varchar" ||
    Number(row?.CHARACTER_MAXIMUM_LENGTH) !== contract.length ||
    String(row?.IS_NULLABLE ?? "").toUpperCase() !== "YES" ||
    !String(row?.EXTRA ?? "")
      .toUpperCase()
      .includes("GENERATED") ||
    !expression.includes("status") ||
    !expression.includes(contract.source)
  ) {
    throw migrationError(
      INTEGRITY_MIGRATION_ERRORS.SCHEMA_UNSAFE,
      `Existing generated column ${RELATIONSHIP_TABLE}.${column} is incompatible.`,
    );
  }
}

function assertCompatibleIndex(row, expectedColumns) {
  if (!row || Number(row.NON_UNIQUE) !== 0 || String(row.columns) !== expectedColumns) {
    throw migrationError(
      INTEGRITY_MIGRATION_ERRORS.SCHEMA_UNSAFE,
      `Existing unique index is incompatible with ${expectedColumns}.`,
    );
  }
}

async function assertTableExists(queryRunner, tableName) {
  if (!(await tableExists(queryRunner, tableName))) {
    throw migrationError(
      INTEGRITY_MIGRATION_ERRORS.SCHEMA_UNSAFE,
      `Required table ${tableName} does not exist.`,
    );
  }
}

async function tableExists(queryRunner, tableName) {
  const rows = await queryRunner(
    "SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=? LIMIT 1",
    [tableName],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function readColumn(queryRunner, tableName, columnName) {
  const rows = await queryRunner(
    "SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, EXTRA, GENERATION_EXPRESSION FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=? LIMIT 1",
    [tableName, columnName],
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function readIndex(queryRunner, tableName, indexName) {
  const rows = await queryRunner(
    "SELECT INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') columns FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=? GROUP BY INDEX_NAME, NON_UNIQUE",
    [tableName, indexName],
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function dropIndexIfExists(queryRunner, tableName, indexName) {
  if (!(await readIndex(queryRunner, tableName, indexName))) return false;
  await queryRunner(`ALTER TABLE ${tableName} DROP INDEX ${indexName}`);
  return true;
}

async function dropColumnIfExists(queryRunner, tableName, columnName) {
  if (!(await readColumn(queryRunner, tableName, columnName))) return false;
  await queryRunner(`ALTER TABLE ${tableName} DROP COLUMN ${columnName}`);
  return true;
}

function safeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
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
    defaultMigration = createPreEnrollmentIntegrityMigration({ queryRunner: database.query });
  }
  return defaultMigration;
}

// CanonicalMigrationRunner invokes JavaScript migrations through module.up().
// Keep the injectable factory above for tests while exposing the runner contract lazily.
const up = (...args) => getDefaultMigration().up(...args);
const down = (...args) => getDefaultMigration().down(...args);
const status = (...args) => getDefaultMigration().status(...args);

async function main() {
  const command = process.argv[2] || "status";
  const operation = { down, status, up }[command];
  if (typeof operation !== "function") throw new Error(`Unknown command: ${command}.`);
  console.log(JSON.stringify(await operation()));
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
      const database = require("../../config/db.js");
      if (database.pool && typeof database.pool.end === "function") await database.pool.end();
    });
}

module.exports = Object.freeze({
  ACTIVE_PERSON_COLUMN,
  ACTIVE_RELATED_PERSON_COLUMN,
  ACTIVE_RELATIONSHIP_TYPE_COLUMN,
  GENERATED_COLUMNS,
  INTEGRITY_MIGRATION_ERRORS,
  PROFILE_UNIQUE_INDEX,
  RELATIONSHIP_UNIQUE_INDEX,
  createPreEnrollmentIntegrityMigration,
  down,
  readDuplicateCounts,
  status,
  up,
});
