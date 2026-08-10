"use strict";

/**
 * Reconcile canonical unit identifier type.
 *
 * Converts j12_unidades.id from the audited legacy signed INT
 * to the canonical signed BIGINT required by the multi-unit domain.
 *
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

const TABLE_NAME = "j12_unidades";
const COLUMN_NAME = "id";

const ERROR_CODES = Object.freeze({
  TABLE_MISSING: "J12_UNIDADES_TABLE_MISSING",
  COLUMN_MISSING: "J12_UNIDADES_ID_COLUMN_MISSING",
  SCHEMA_UNSAFE: "J12_UNIDADES_ID_SCHEMA_UNSAFE",
  REFERENCING_FOREIGN_KEYS_PRESENT: "J12_UNIDADES_ID_REFERENCING_FOREIGN_KEYS_PRESENT",
  POST_VALIDATION_FAILED: "J12_UNIDADES_ID_POST_VALIDATION_FAILED",
  DOWN_UNSAFE: "J12_UNIDADES_ID_DOWN_UNSAFE",
});

async function up() {
  if (!(await dbTableExists(TABLE_NAME))) {
    throw migrationError(`Required table ${TABLE_NAME} does not exist.`, ERROR_CODES.TABLE_MISSING);
  }

  const before = await readColumn();

  if (!before) {
    throw migrationError(
      `Required column ${TABLE_NAME}.${COLUMN_NAME} does not exist.`,
      ERROR_CODES.COLUMN_MISSING,
    );
  }

  if (isCanonical(before)) {
    console.log(`SKIP_ALREADY_CANONICAL=${TABLE_NAME}.${COLUMN_NAME}`);
    printState(await readState());
    return;
  }

  assertAuditedLegacy(before);

  const foreignKeys = await readReferencingForeignKeys();

  if (foreignKeys.length > 0) {
    throw migrationError(
      `Refusing to modify ${TABLE_NAME}.${COLUMN_NAME}: ${foreignKeys.length} foreign key(s) currently reference it.`,
      ERROR_CODES.REFERENCING_FOREIGN_KEYS_PRESENT,
      { foreignKeys },
    );
  }

  await dbQuery(
    `ALTER TABLE ${TABLE_NAME} MODIFY COLUMN ${COLUMN_NAME} BIGINT NOT NULL AUTO_INCREMENT`,
  );

  const after = await readColumn();

  if (!isCanonical(after)) {
    throw migrationError(
      `Post-validation failed for ${TABLE_NAME}.${COLUMN_NAME}.`,
      ERROR_CODES.POST_VALIDATION_FAILED,
      { after },
    );
  }

  console.log(`RECONCILED_COLUMN=${TABLE_NAME}.${COLUMN_NAME}`);
  console.log("LEGACY_TYPE=SIGNED_INT_NOT_NULL_AUTO_INCREMENT");
  console.log("CANONICAL_TYPE=SIGNED_BIGINT_NOT_NULL_AUTO_INCREMENT");

  printState(await readState());
}

async function down() {
  throw migrationError(
    `Automatic rollback of ${TABLE_NAME}.${COLUMN_NAME} from BIGINT to INT is intentionally unavailable.`,
    ERROR_CODES.DOWN_UNSAFE,
  );
}

async function status() {
  if (!(await dbTableExists(TABLE_NAME))) {
    const state = {
      tableExists: false,
      column: null,
      canonical: false,
      auditedLegacy: false,
      referencingForeignKeys: [],
    };

    printState(state);
    return state;
  }

  const state = await readState();
  printState(state);
  return state;
}

async function readState() {
  const [column, foreignKeys] = await Promise.all([readColumn(), readReferencingForeignKeys()]);

  return {
    tableExists: true,
    column,
    canonical: isCanonical(column),
    auditedLegacy: isAuditedLegacy(column),
    referencingForeignKeys: foreignKeys,
  };
}

async function readColumn() {
  const rows = await dbQuery(
    `
      SELECT
        TABLE_NAME,
        COLUMN_NAME,
        COLUMN_TYPE,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_KEY,
        EXTRA
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1
    `,
    [TABLE_NAME, COLUMN_NAME],
  );

  return rows[0] || null;
}

async function readReferencingForeignKeys() {
  return dbQuery(
    `
      SELECT
        TABLE_NAME,
        COLUMN_NAME,
        CONSTRAINT_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME = ?
        AND REFERENCED_COLUMN_NAME = ?
      ORDER BY TABLE_NAME, CONSTRAINT_NAME
    `,
    [TABLE_NAME, COLUMN_NAME],
  );
}

function isCanonical(column) {
  if (!column) return false;

  const dataType = normalize(column.DATA_TYPE);
  const columnType = normalize(column.COLUMN_TYPE);
  const nullable = normalize(column.IS_NULLABLE);
  const extra = normalize(column.EXTRA);

  return (
    dataType === "bigint" &&
    /^bigint(?:\(\d+\))?$/.test(columnType) &&
    !columnType.includes("unsigned") &&
    nullable === "no" &&
    extra.includes("auto_increment")
  );
}

function isAuditedLegacy(column) {
  if (!column) return false;

  const dataType = normalize(column.DATA_TYPE);
  const columnType = normalize(column.COLUMN_TYPE);
  const nullable = normalize(column.IS_NULLABLE);
  const extra = normalize(column.EXTRA);

  return (
    dataType === "int" &&
    /^int(?:\(\d+\))?$/.test(columnType) &&
    !columnType.includes("unsigned") &&
    nullable === "no" &&
    extra.includes("auto_increment")
  );
}

function assertAuditedLegacy(column) {
  if (isAuditedLegacy(column)) return;

  throw migrationError(
    `Unexpected ${TABLE_NAME}.${COLUMN_NAME} definition: type=${column?.COLUMN_TYPE || "<missing>"}; nullable=${column?.IS_NULLABLE || "<missing>"}; extra=${column?.EXTRA || "<none>"}. Expected audited signed INT NOT NULL AUTO_INCREMENT or canonical signed BIGINT NOT NULL AUTO_INCREMENT.`,
    ERROR_CODES.SCHEMA_UNSAFE,
    { column },
  );
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function printState(state) {
  console.log(JSON.stringify(state, null, 2));
}

function migrationError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
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
  COLUMN_NAME,
  ERROR_CODES,
  TABLE_NAME,
  down,
  isAuditedLegacy,
  isCanonical,
  readReferencingForeignKeys,
  readState,
  status,
  up,
};
