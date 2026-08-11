"use strict";

const { PHYSICAL_STATES, SEVERITIES } = require("../constants");

function normalize(value) {
  return String(value == null ? "" : value)
    .replace(/[`'\s()]/g, "")
    .toLowerCase();
}

function normalizeColumnType(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .replace(/\b(tinyint|smallint|mediumint|int|integer|bigint)\(\d+\)/gu, "$1")
    .replace(/\s+/gu, " ");
}

function normalizeCharset(value) {
  const normalized = String(value == null ? "" : value)
    .trim()
    .toLowerCase();
  return normalized === "utf8mb3" ? "utf8" : normalized;
}

function normalizeCollation(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .replace(/^utf8mb3_/u, "utf8_");
}

function normalizeTableOption(property, value) {
  if (property === "charset") return normalizeCharset(value);
  if (property === "collation") return normalizeCollation(value);
  return normalize(value);
}

function sameColumns(actualColumns, expectedNames) {
  return (
    actualColumns.length === expectedNames.length &&
    actualColumns.every((entry, index) => entry.name === expectedNames[index])
  );
}

function finding(code, severity, message, details = {}) {
  return { code, severity, message, details };
}

function assessManifest(schema, manifest) {
  const findings = [];
  const migrationId = manifest.migrationId || manifest.id;
  let expectedCount = 0;
  let presentCount = 0;
  let mismatchCount = 0;
  let structuralMismatchCount = 0;
  let tableOptionMismatchCount = 0;

  for (const expectedTable of manifest.tables || []) {
    if (expectedTable.tableArtifact !== false) expectedCount += 1;
    const actualTable = schema.tables[expectedTable.name];
    if (!actualTable) {
      findings.push(
        finding("TABLE_MISSING", SEVERITIES.HIGH, `Tabela ausente: ${expectedTable.name}.`, {
          table: expectedTable.name,
        }),
      );
      continue;
    }
    if (expectedTable.tableArtifact !== false) presentCount += 1;
    for (const [property, expected] of [
      ["engine", expectedTable.engine],
      ["charset", expectedTable.charset],
      ["collation", expectedTable.collation],
      ["rowFormat", expectedTable.rowFormat],
      ["createOptions", expectedTable.createOptions],
    ]) {
      if (expected == null) continue;
      expectedCount += 1;
      if (
        normalizeTableOption(property, actualTable[property]) ===
        normalizeTableOption(property, expected)
      )
        presentCount += 1;
      else {
        mismatchCount += 1;
        tableOptionMismatchCount += 1;
        findings.push(
          finding(
            "TABLE_OPTION_MISMATCH",
            SEVERITIES.HIGH,
            `${expectedTable.name}.${property} incompatível.`,
            { actual: actualTable[property], expected, table: expectedTable.name, property },
          ),
        );
      }
    }
    for (const [columnName, expectedColumn] of Object.entries(expectedTable.columns || {})) {
      expectedCount += 1;
      const actualColumn = actualTable.columns[columnName];
      if (!actualColumn) {
        findings.push(
          finding(
            "COLUMN_MISSING",
            SEVERITIES.HIGH,
            `Coluna ausente: ${expectedTable.name}.${columnName}.`,
            { table: expectedTable.name, column: columnName },
          ),
        );
        continue;
      }
      presentCount += 1;
      const mismatches = [];
      if (
        expectedColumn.columnType &&
        normalizeColumnType(actualColumn.columnType) !==
          normalizeColumnType(expectedColumn.columnType)
      )
        mismatches.push("columnType");
      if (
        typeof expectedColumn.nullable === "boolean" &&
        actualColumn.nullable !== expectedColumn.nullable
      )
        mismatches.push("nullable");
      if (
        typeof expectedColumn.generated === "boolean" &&
        actualColumn.generated !== expectedColumn.generated
      )
        mismatches.push("generated");
      if (
        expectedColumn.generationExpression &&
        normalize(actualColumn.generationExpression) !==
          normalize(expectedColumn.generationExpression)
      )
        mismatches.push("generationExpression");
      if (
        typeof expectedColumn.autoIncrement === "boolean" &&
        actualColumn.autoIncrement !== expectedColumn.autoIncrement
      )
        mismatches.push("autoIncrement");
      if (
        Object.prototype.hasOwnProperty.call(expectedColumn, "default") &&
        normalize(actualColumn.default) !== normalize(expectedColumn.default)
      )
        mismatches.push("default");
      if (
        expectedColumn.onUpdate &&
        !normalize(actualColumn.extra).includes(`onupdate${normalize(expectedColumn.onUpdate)}`)
      )
        mismatches.push("onUpdate");
      if (mismatches.length) {
        mismatchCount += 1;
        structuralMismatchCount += 1;
        findings.push(
          finding(
            "COLUMN_MISMATCH",
            SEVERITIES.HIGH,
            `Definição incompatível: ${expectedTable.name}.${columnName}.`,
            {
              table: expectedTable.name,
              column: columnName,
              mismatches,
              actual: actualColumn,
              expected: expectedColumn,
            },
          ),
        );
      }
    }
    for (const [indexName, expectedIndex] of Object.entries(expectedTable.indexes || {})) {
      expectedCount += 1;
      const actualIndex = actualTable.indexes[indexName];
      if (!actualIndex) {
        findings.push(
          finding(
            "INDEX_MISSING",
            SEVERITIES.HIGH,
            `Índice ausente: ${expectedTable.name}.${indexName}.`,
            { table: expectedTable.name, index: indexName },
          ),
        );
        continue;
      }
      presentCount += 1;
      if (
        actualIndex.unique !== expectedIndex.unique ||
        !sameColumns(actualIndex.columns, expectedIndex.columns)
      ) {
        mismatchCount += 1;
        structuralMismatchCount += 1;
        findings.push(
          finding(
            "INDEX_MISMATCH",
            SEVERITIES.HIGH,
            `Índice incompatível: ${expectedTable.name}.${indexName}.`,
            {
              table: expectedTable.name,
              index: indexName,
              actual: actualIndex,
              expected: expectedIndex,
            },
          ),
        );
      }
    }
    for (const [foreignKeyName, expectedForeignKey] of Object.entries(
      expectedTable.foreignKeys || {},
    )) {
      expectedCount += 1;
      const actualForeignKey = actualTable.foreignKeys[foreignKeyName];
      if (!actualForeignKey) {
        findings.push(
          finding(
            "FOREIGN_KEY_MISSING",
            SEVERITIES.HIGH,
            `Chave estrangeira ausente: ${expectedTable.name}.${foreignKeyName}.`,
            { table: expectedTable.name, foreignKey: foreignKeyName },
          ),
        );
        continue;
      }
      presentCount += 1;
      const compatible =
        JSON.stringify(actualForeignKey.columns) === JSON.stringify(expectedForeignKey.columns) &&
        actualForeignKey.referencedTable === expectedForeignKey.referencedTable &&
        JSON.stringify(actualForeignKey.referencedColumns) ===
          JSON.stringify(expectedForeignKey.referencedColumns) &&
        (!expectedForeignKey.updateRule ||
          String(actualForeignKey.updateRule || "").toUpperCase() ===
            String(expectedForeignKey.updateRule).toUpperCase()) &&
        (!expectedForeignKey.deleteRule ||
          String(actualForeignKey.deleteRule || "").toUpperCase() ===
            String(expectedForeignKey.deleteRule).toUpperCase());
      if (!compatible) {
        mismatchCount += 1;
        structuralMismatchCount += 1;
        findings.push(
          finding(
            "FOREIGN_KEY_MISMATCH",
            SEVERITIES.HIGH,
            `Chave estrangeira incompatível: ${expectedTable.name}.${foreignKeyName}.`,
            {
              table: expectedTable.name,
              foreignKey: foreignKeyName,
              actual: actualForeignKey,
              expected: expectedForeignKey,
            },
          ),
        );
      }
    }
  }
  for (const item of findings) {
    if (["TABLE_MISSING", "COLUMN_MISMATCH"].includes(item.code))
      item.severity = SEVERITIES.CRITICAL;
  }
  const structuralMissingCount = findings.filter((item) =>
    ["TABLE_MISSING", "COLUMN_MISSING", "INDEX_MISSING", "FOREIGN_KEY_MISSING"].includes(item.code),
  ).length;
  const structuralDrift = structuralMismatchCount > 0 || structuralMissingCount > 0;
  const tableOptionDrift = tableOptionMismatchCount > 0;
  const requiredArtifactsMissing = findings
    .filter((item) =>
      ["TABLE_MISSING", "COLUMN_MISSING", "INDEX_MISSING", "FOREIGN_KEY_MISSING"].includes(
        item.code,
      ),
    )
    .map((item) => ({ code: item.code, ...item.details }));
  const artifactMismatches = findings
    .filter((item) =>
      ["COLUMN_MISMATCH", "INDEX_MISMATCH", "FOREIGN_KEY_MISMATCH"].includes(item.code),
    )
    .map((item) => ({ code: item.code, ...item.details }));
  const tableOptionDifferences = findings
    .filter((item) => item.code === "TABLE_OPTION_MISMATCH")
    .map((item) => ({ ...item.details }));
  const structurallyPresent =
    structuralMismatchCount === 0 &&
    structuralMissingCount === 0 &&
    presentCount + tableOptionMismatchCount === expectedCount;
  let physicalState = PHYSICAL_STATES.PRESENT;
  if (presentCount === 0) physicalState = PHYSICAL_STATES.ABSENT;
  else if (structuralMismatchCount > 0) physicalState = PHYSICAL_STATES.INCOMPATIBLE;
  else if (presentCount < expectedCount) physicalState = PHYSICAL_STATES.PARTIAL;
  if (structurallyPresent && tableOptionDrift) physicalState = PHYSICAL_STATES.TABLE_OPTION_DRIFT;
  return {
    migrationId,
    physicalState,
    expectedCount,
    presentCount,
    mismatchCount,
    structuralMismatchCount,
    tableOptionMismatchCount,
    structuralDrift,
    tableOptionDrift,
    requiredArtifactsMissing,
    artifactMismatches,
    tableOptionDifferences,
    structurallyPresent,
    findings,
    applyPolicy: manifest.applyPolicy || null,
  };
}

module.exports = {
  assessManifest,
  normalize,
  normalizeCharset,
  normalizeCollation,
  normalizeColumnType,
  normalizeTableOption,
};
