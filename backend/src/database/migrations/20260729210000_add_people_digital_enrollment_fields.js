const PEOPLE_TABLE = "people";

const PEOPLE_DIGITAL_ENROLLMENT_COLUMNS = Object.freeze({
  birth_city: Object.freeze({ dataType: "varchar", ddl: "VARCHAR(191) NULL", maxLength: 191 }),
  birth_state: Object.freeze({ dataType: "varchar", ddl: "VARCHAR(50) NULL", maxLength: 50 }),
  nationality: Object.freeze({ dataType: "varchar", ddl: "VARCHAR(191) NULL", maxLength: 191 }),
  blood_type: Object.freeze({ dataType: "varchar", ddl: "VARCHAR(20) NULL", maxLength: 20 }),
});

const PEOPLE_DIGITAL_ENROLLMENT_MIGRATION_ERRORS = Object.freeze({
  DOWN_BLOCKED: "PEOPLE_DIGITAL_ENROLLMENT_FIELDS_DOWN_BLOCKED",
  SCHEMA_UNSAFE: "PEOPLE_DIGITAL_ENROLLMENT_FIELDS_SCHEMA_UNSAFE",
});

function createPeopleDigitalEnrollmentFieldsMigration({
  logger = () => {},
  queryRunner = null,
} = {}) {
  const query = queryRunner || require("../../config/db.js").query;

  return Object.freeze({
    down: () => runDown({ logger, query }),
    status: () => readStatus({ query }),
    up: () => runUp({ logger, query }),
  });
}

async function runUp({ logger, query }) {
  await assertPeopleTable(query);
  const added = [];
  for (const [column, definition] of Object.entries(PEOPLE_DIGITAL_ENROLLMENT_COLUMNS)) {
    const metadata = await readColumn(query, column);
    if (metadata) {
      assertCompatibleColumn(column, metadata);
      continue;
    }
    await query("ALTER TABLE " + PEOPLE_TABLE + " ADD COLUMN " + column + " " + definition.ddl);
    added.push(column);
    logger({ event: "people_digital_enrollment_column_added", column });
  }
  return Object.freeze({ added, status: await readStatus({ query }) });
}

async function runDown({ logger, query }) {
  await assertPeopleTable(query);
  const existing = [];
  for (const column of Object.keys(PEOPLE_DIGITAL_ENROLLMENT_COLUMNS)) {
    const metadata = await readColumn(query, column);
    if (metadata) {
      assertCompatibleColumn(column, metadata);
      existing.push(column);
    }
  }
  if (existing.length === 0) return Object.freeze({ removed: [], skipped: true });

  const populatedWhere = existing.map((column) => column + " IS NOT NULL").join(" OR ");
  const rows = await query(
    "SELECT COUNT(*) AS total FROM " + PEOPLE_TABLE + " WHERE " + populatedWhere,
  );
  const populated = safeCount(rows?.[0]?.total);
  if (populated > 0) {
    throw migrationError(
      PEOPLE_DIGITAL_ENROLLMENT_MIGRATION_ERRORS.DOWN_BLOCKED,
      "Refusing to drop populated people enrollment fields.",
      { populated },
    );
  }

  const removed = [];
  for (const column of existing.reverse()) {
    await query("ALTER TABLE " + PEOPLE_TABLE + " DROP COLUMN " + column);
    removed.push(column);
    logger({ event: "people_digital_enrollment_column_removed", column });
  }
  return Object.freeze({ removed, skipped: false });
}

async function readStatus({ query }) {
  await assertPeopleTable(query);
  const columns = {};
  for (const column of Object.keys(PEOPLE_DIGITAL_ENROLLMENT_COLUMNS)) {
    const metadata = await readColumn(query, column);
    columns[column] = metadata ? "present" : "missing";
    if (metadata) assertCompatibleColumn(column, metadata);
  }
  return Object.freeze({
    columns: Object.freeze(columns),
    complete: Object.values(columns).every((value) => value === "present"),
  });
}

async function assertPeopleTable(query) {
  const rows = await query(
    "SELECT 1 AS present FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=? LIMIT 1",
    [PEOPLE_TABLE],
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw migrationError(
      PEOPLE_DIGITAL_ENROLLMENT_MIGRATION_ERRORS.SCHEMA_UNSAFE,
      "Required people table does not exist.",
    );
  }
}

async function readColumn(query, column) {
  const rows = await query(
    "SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=? LIMIT 1",
    [PEOPLE_TABLE, column],
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

function assertCompatibleColumn(column, metadata) {
  const expected = PEOPLE_DIGITAL_ENROLLMENT_COLUMNS[column];
  const dataType = String(metadata.DATA_TYPE || metadata.data_type || "").toLowerCase();
  const maxLength = Number(metadata.CHARACTER_MAXIMUM_LENGTH ?? metadata.character_maximum_length);
  const nullable = String(metadata.IS_NULLABLE ?? metadata.is_nullable ?? "").toUpperCase();
  if (dataType !== expected.dataType || maxLength !== expected.maxLength || nullable !== "YES") {
    throw migrationError(
      PEOPLE_DIGITAL_ENROLLMENT_MIGRATION_ERRORS.SCHEMA_UNSAFE,
      "Existing people column " + column + " is incompatible with the canonical contract.",
      { column },
    );
  }
}

function migrationError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function safeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

let defaultMigration;
function getDefaultMigration() {
  if (!defaultMigration) {
    defaultMigration = createPeopleDigitalEnrollmentFieldsMigration({
      logger: (entry) => console.log(JSON.stringify(entry)),
    });
  }
  return defaultMigration;
}

// CanonicalMigrationRunner invokes JavaScript migrations through module.up().
// Keep dependency injection in the factory while exposing the zero-argument runner contract.
const up = (...args) => getDefaultMigration().up(...args);
const down = (...args) => getDefaultMigration().down(...args);
const status = (...args) => getDefaultMigration().status(...args);

async function main() {
  const command = process.argv[2] || "status";
  const migration = await getDefaultMigration();
  if (typeof migration[command] !== "function")
    throw new Error("Unknown command: " + command + ".");
  console.log(JSON.stringify(await migration[command]()));
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
  PEOPLE_DIGITAL_ENROLLMENT_COLUMNS,
  PEOPLE_DIGITAL_ENROLLMENT_MIGRATION_ERRORS,
  assertCompatibleColumn,
  createPeopleDigitalEnrollmentFieldsMigration,
  down,
  readColumn,
  status,
  up,
});
