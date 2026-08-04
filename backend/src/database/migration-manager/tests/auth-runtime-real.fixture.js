"use strict";

const { draftChainManifests } = require("../../j12-doctor/manifests/draft-chain.manifests");
const {
  AUTH_RUNTIME_CORRECTIVE_MIGRATION,
  AUTH_RUNTIME_HISTORICAL_MIGRATION,
  authRuntimeBaselineAdoption,
} = require("../baseline-adoptions/auth-runtime.adoption");

const HISTORICAL_MANIFEST = draftChainManifests.find(
  (manifest) => manifest.migrationId === AUTH_RUNTIME_HISTORICAL_MIGRATION,
);
const CORRECTIVE_MANIFEST = draftChainManifests.find(
  (manifest) => manifest.migrationId === AUTH_RUNTIME_CORRECTIVE_MIGRATION,
);
const DRIFT_TABLES = new Set(["users", "user_sessions", "password_reset_tokens"]);

function createAuthRuntimeRealSchemaFixture({ charsetAlias = "utf8" } = {}) {
  const tables = {};
  for (const expectedTable of HISTORICAL_MANIFEST.tables) {
    const hasConfirmedDrift = DRIFT_TABLES.has(expectedTable.name);
    const charset = hasConfirmedDrift ? charsetAlias : expectedTable.charset;
    const collation = hasConfirmedDrift
      ? charsetAlias === "utf8mb3"
        ? "utf8mb3_unicode_ci"
        : "utf8_unicode_ci"
      : expectedTable.collation;
    tables[expectedTable.name] = {
      name: expectedTable.name,
      engine: expectedTable.engine,
      charset,
      collation,
      rowFormat: "Dynamic",
      createOptions: "",
      columns: Object.fromEntries(
        Object.entries(expectedTable.columns).map(([name, expectedColumn], index) => [
          name,
          {
            name,
            position: index + 1,
            dataType: String(expectedColumn.columnType).split(/[\s(]/u)[0],
            columnType: mysql57ColumnType(expectedColumn.columnType),
            nullable: expectedColumn.nullable,
            default: mysql57Default(expectedColumn),
            primary: expectedTable.indexes.PRIMARY?.columns?.includes(name) || false,
            generated: Boolean(expectedColumn.generated),
            generationExpression: expectedColumn.generationExpression || null,
            autoIncrement: Boolean(expectedColumn.autoIncrement),
            extra: expectedColumn.onUpdate
              ? `DEFAULT_GENERATED on update ${expectedColumn.onUpdate}`
              : expectedColumn.autoIncrement
                ? "auto_increment"
                : "",
            charset: isTextType(expectedColumn.columnType) ? charset : null,
            collation: isTextType(expectedColumn.columnType) ? collation : null,
          },
        ]),
      ),
      indexes: Object.fromEntries(
        Object.entries(expectedTable.indexes).map(([name, expectedIndex]) => [
          name,
          {
            name,
            unique: expectedIndex.unique,
            primary: name === "PRIMARY",
            type: "BTREE",
            columns: expectedIndex.columns.map((columnName) => ({
              name: columnName,
              expression: null,
              prefixLength: null,
              order: "A",
            })),
          },
        ]),
      ),
      foreignKeys: Object.fromEntries(
        Object.entries(expectedTable.foreignKeys).map(([name, expectedForeignKey]) => [
          name,
          {
            name,
            columns: [...expectedForeignKey.columns],
            referencedTable: expectedForeignKey.referencedTable,
            referencedColumns: [...expectedForeignKey.referencedColumns],
            updateRule: expectedForeignKey.updateRule || null,
            deleteRule: expectedForeignKey.deleteRule || null,
          },
        ]),
      ),
    };
  }
  tables.j12_usuarios = createLegacyJ12UsuariosTable(charsetAlias);
  return {
    database: "j12",
    tables,
    counts: {
      tables: Object.keys(tables).length,
      columns: Object.values(tables).reduce(
        (total, table) => total + Object.keys(table.columns).length,
        0,
      ),
      indexes: Object.values(tables).reduce(
        (total, table) => total + Object.keys(table.indexes).length,
        0,
      ),
      foreignKeys: 0,
    },
  };
}

function createLegacyJ12UsuariosTable(charsetAlias = "utf8") {
  const expected = authRuntimeBaselineAdoption.legacyTable;
  const collation =
    charsetAlias === "utf8mb3" ? "utf8mb3_unicode_ci" : expected.collation;
  return {
    name: expected.name,
    engine: expected.engine,
    charset: charsetAlias,
    collation,
    rowFormat: expected.rowFormat,
    createOptions: expected.createOptions,
    columns: Object.fromEntries(
      Object.entries(expected.columns).map(([name, column]) => [
        name,
        {
          name,
          position: column.position,
          dataType: String(column.columnType).split(/[\s(]/u)[0],
          columnType: column.columnType,
          nullable: column.nullable,
          default: column.default,
          primary: name === "id",
          generated: false,
          generationExpression: null,
          autoIncrement: column.autoIncrement,
          extra: column.extra,
          charset: column.charset ? charsetAlias : null,
          collation: column.collation ? collation : null,
        },
      ]),
    ),
    indexes: Object.fromEntries(
      Object.entries(expected.indexes).map(([name, index]) => [
        name,
        {
          name,
          unique: index.unique,
          primary: name === "PRIMARY",
          type: "BTREE",
          columns: index.columns.map((columnName) => ({
            name: columnName,
            expression: null,
            prefixLength: null,
            order: "A",
          })),
        },
      ]),
    ),
    foreignKeys: {},
  };
}

function mysql57ColumnType(columnType) {
  return String(columnType)
    .replace(/^bigint\b/iu, "bigint(20)")
    .replace(/^int\b/iu, "int(11)");
}

function mysql57Default(expectedColumn) {
  if (!Object.prototype.hasOwnProperty.call(expectedColumn, "default")) return null;
  return String(expectedColumn.default).toUpperCase() === "CURRENT_TIMESTAMP"
    ? "CURRENT_TIMESTAMP()"
    : expectedColumn.default;
}

function isTextType(columnType) {
  return /char|text|enum|set/iu.test(String(columnType));
}

module.exports = {
  CORRECTIVE_MANIFEST,
  DRIFT_TABLES,
  HISTORICAL_MANIFEST,
  createAuthRuntimeRealSchemaFixture,
  createLegacyJ12UsuariosTable,
  mysql57ColumnType,
};
