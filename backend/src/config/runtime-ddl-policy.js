const DDL_PATTERN =
  /^\s*(?:\/\*[\s\S]*?\*\/\s*|--[^\r\n]*(?:\r?\n|$)\s*)*(CREATE|ALTER|DROP|RENAME|TRUNCATE)\b/i;
const CREATE_TABLE_IF_NOT_EXISTS_PATTERN =
  /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`?([a-zA-Z0-9_]+)`?/i;

class RuntimeSchemaError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "RuntimeSchemaError";
    this.code = code;
    Object.assign(this, details);
  }
}

function createRuntimeDdlPolicy({
  environment = process.env.NODE_ENV,
  inspectTable,
  migrationContext = process.env.J12_MIGRATION_RUNNER_CONTEXT,
} = {}) {
  const production = String(environment || "").toLowerCase() === "production";
  const migrationAllowed = String(migrationContext || "").toLowerCase() === "true";

  return {
    async beforeExecute(sql) {
      const statement = String(sql || "");
      const ddl = DDL_PATTERN.exec(statement);
      if (!production || migrationAllowed || !ddl) return { execute: true };

      const createTable = CREATE_TABLE_IF_NOT_EXISTS_PATTERN.exec(statement);
      if (createTable) {
        if (typeof inspectTable !== "function") {
          throw new RuntimeSchemaError(
            "Production schema validation is unavailable.",
            "PRODUCTION_SCHEMA_VALIDATION_UNAVAILABLE",
          );
        }
        const tableName = createTable[1];
        if (await inspectTable(tableName))
          return { execute: false, reason: "existing_table", tableName };
        throw new RuntimeSchemaError(
          `Required database table ${tableName} is missing. Apply approved migrations before starting the application.`,
          "PRODUCTION_SCHEMA_TABLE_MISSING",
          { objectName: tableName, operation: "CREATE TABLE" },
        );
      }

      throw new RuntimeSchemaError(
        `Runtime schema mutation ${ddl[1].toUpperCase()} is blocked in production. Apply an approved migration instead.`,
        "PRODUCTION_RUNTIME_DDL_BLOCKED",
        { operation: ddl[1].toUpperCase() },
      );
    },
  };
}

function createNoopDdlResult() {
  return {
    affectedRows: 0,
    changedRows: 0,
    fieldCount: 0,
    info: "runtime-ddl-validation-only",
    warningStatus: 0,
  };
}

module.exports = {
  CREATE_TABLE_IF_NOT_EXISTS_PATTERN,
  DDL_PATTERN,
  RuntimeSchemaError,
  createNoopDdlResult,
  createRuntimeDdlPolicy,
};
