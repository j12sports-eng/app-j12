"use strict";

const { authRuntimeBaselineAdoption } = require("./baseline-adoptions/auth-runtime.adoption");
const { LEDGER_STATES, PHYSICAL_STATES } = require("../j12-doctor/constants");
const { normalize, normalizeTableOption } = require("../j12-doctor/checks/schema-manifest-check");

const ADOPTIONS = new Map([[authRuntimeBaselineAdoption.migrationId, authRuntimeBaselineAdoption]]);

function differenceMatches(finding, accepted) {
  const details = finding.details || {};
  return (
    details.table === accepted.table &&
    details.property === accepted.property &&
    normalizeTableOption(details.property, details.actual) ===
      normalizeTableOption(accepted.property, accepted.actual) &&
    normalizeTableOption(details.property, details.expected) ===
      normalizeTableOption(accepted.property, accepted.expected)
  );
}

const STRUCTURAL_FINDING_CODES = new Set([
  "TABLE_MISSING",
  "COLUMN_MISSING",
  "INDEX_MISSING",
  "FOREIGN_KEY_MISSING",
  "COLUMN_MISMATCH",
  "INDEX_MISMATCH",
  "FOREIGN_KEY_MISMATCH",
]);

function evaluateTableOptionAdoption({
  migration,
  findings = [],
  catalogMigrations = [],
  schemaSnapshot = null,
}) {
  const scopedFindings = findings.filter(
    (finding) => !finding.details?.migrationId || finding.details.migrationId === migration.id,
  );
  const optionFindings = scopedFindings.filter(
    (finding) => finding.code === "TABLE_OPTION_MISMATCH",
  );
  const adoption = ADOPTIONS.get(migration.id);
  const hasObservedTableOptionDrift =
    migration.tableOptionDrift === true ||
    migration.physicalState === PHYSICAL_STATES.TABLE_OPTION_DRIFT ||
    optionFindings.length > 0;
  const hasObservedStructuralDrift =
    migration.structuralDrift === true ||
    scopedFindings.some((finding) => STRUCTURAL_FINDING_CODES.has(finding.code));
  if (!hasObservedTableOptionDrift && !hasObservedStructuralDrift)
    return {
      applicable: false,
      accepted: false,
      state: "TABLE_OPTION_RECONCILIATION_NOT_REQUIRED",
      reasons: [],
      adoption: null,
    };

  const reasons = [];
  const legacyStructure = adoption
    ? assessExactLegacyTable(schemaSnapshot, adoption.legacyTable)
    : { accepted: false, differences: [{ path: "adoption", code: "ADOPTION_MISSING" }] };
  if (!adoption) reasons.push("TABLE_OPTION_RECONCILIATION_REQUIRED");
  else {
    const corrective = catalogMigrations.find(
      (candidate) => candidate.id === adoption.mandatoryCorrectiveMigrationId,
    );

    const correctiveApplied =
      corrective?.ledgerState === LEDGER_STATES.APPLIED && corrective?.checksumMatches === true;

    if (migration.checksum !== adoption.migrationChecksum)
      reasons.push("LEGACY_ADOPTION_CHECKSUM_MISMATCH");
    if (!legacyStructure.accepted) reasons.push("LEGACY_ADOPTION_STRUCTURE_MISMATCH");
    if (
      scopedFindings.some(
        (finding) =>
          STRUCTURAL_FINDING_CODES.has(finding.code) &&
          finding.details?.table !== adoption.legacyTable.name,
      )
    )
      reasons.push("LEGACY_ADOPTION_UNRELATED_STRUCTURAL_DRIFT");
    if (
      optionFindings.some(
        (finding) =>
          !adoption.acceptedTemporaryTableOptionDifferences.some((accepted) =>
            differenceMatches(finding, accepted),
          ),
      ) ||
      new Set(
        optionFindings.map(
          (finding) =>
            `${finding.details?.table}|${finding.details?.property}|${normalizeTableOption(
              finding.details?.property,
              finding.details?.actual,
            )}|${normalizeTableOption(finding.details?.property, finding.details?.expected)}`,
        ),
      ).size !== optionFindings.length
    )
      reasons.push("TABLE_OPTION_ADOPTION_DIFFERENCE_NOT_ACCEPTED");
    if (
      !correctiveApplied &&
      adoption.acceptedTemporaryTableOptionDifferences.some(
        (accepted) => !optionFindings.some((finding) => differenceMatches(finding, accepted)),
      )
    )
      reasons.push("TABLE_OPTION_ADOPTION_DIFFERENCE_MISSING");

    if (
      !corrective ||
      corrective.manifestAvailable !== true ||
      !(corrective.dependencies || []).includes(adoption.migrationId)
    )
      reasons.push("TABLE_OPTION_ADOPTION_CORRECTIVE_MIGRATION_REQUIRED");
  }

  const accepted = reasons.length === 0;
  return {
    applicable: true,
    accepted,
    state: accepted ? "LEGACY_AUTH_STRUCTURE_ACCEPTED" : "LEGACY_AUTH_ADOPTION_REQUIRED",
    reasons: [...new Set(reasons)],
    adoption: adoption || null,
    legacyClassification: adoption?.classification || null,
    legacyStructure,
  };
}

function assessExactLegacyTable(schemaSnapshot, expectedTable) {
  const actualTable = schemaSnapshot?.tables?.[expectedTable?.name];
  if (!actualTable || !expectedTable) {
    return {
      accepted: false,
      classification: authRuntimeBaselineAdoption.classification,
      differences: [
        {
          code: "LEGACY_TABLE_MISSING",
          path: expectedTable?.name || "j12_usuarios",
          actual: actualTable || null,
          expected: "EXACT_AUDITED_TABLE",
        },
      ],
    };
  }

  const differences = [];
  compareValue(differences, "table.name", actualTable.name, expectedTable.name);
  for (const property of ["engine", "charset", "collation", "rowFormat", "createOptions"]) {
    compareValue(
      differences,
      `table.${property}`,
      actualTable[property],
      expectedTable[property],
      property,
    );
  }
  compareKeySet(differences, "columns", actualTable.columns, expectedTable.columns);
  for (const [name, expected] of Object.entries(expectedTable.columns || {})) {
    const actual = actualTable.columns?.[name];
    if (!actual) continue;
    compareValue(differences, `columns.${name}.name`, actual.name, name);
    for (const property of [
      "position",
      "columnType",
      "nullable",
      "default",
      "autoIncrement",
      "extra",
      "charset",
      "collation",
    ])
      compareValue(
        differences,
        `columns.${name}.${property}`,
        actual[property],
        expected[property],
        property,
      );
    compareValue(differences, `columns.${name}.primary`, actual.primary, name === "id");
    compareValue(differences, `columns.${name}.generated`, actual.generated, false);
    compareValue(
      differences,
      `columns.${name}.generationExpression`,
      actual.generationExpression,
      null,
    );
  }
  compareKeySet(differences, "indexes", actualTable.indexes, expectedTable.indexes);
  for (const [name, expected] of Object.entries(expectedTable.indexes || {})) {
    const actual = actualTable.indexes?.[name];
    if (!actual) continue;
    compareValue(differences, `indexes.${name}.name`, actual.name, name);
    compareValue(differences, `indexes.${name}.unique`, actual.unique, expected.unique);
    compareValue(differences, `indexes.${name}.primary`, actual.primary, name === "PRIMARY");
    compareValue(differences, `indexes.${name}.type`, actual.type, "BTREE");
    const actualColumns = (actual.columns || []).map((column) => column.name);
    compareValue(differences, `indexes.${name}.columns`, actualColumns, expected.columns);
    for (const [index, column] of (actual.columns || []).entries()) {
      compareValue(
        differences,
        `indexes.${name}.columns.${index}.expression`,
        column.expression,
        null,
      );
      compareValue(
        differences,
        `indexes.${name}.columns.${index}.prefixLength`,
        column.prefixLength,
        null,
      );
      compareValue(differences, `indexes.${name}.columns.${index}.order`, column.order, "A");
    }
  }
  compareKeySet(differences, "foreignKeys", actualTable.foreignKeys, expectedTable.foreignKeys);

  return {
    accepted: differences.length === 0,
    classification: authRuntimeBaselineAdoption.classification,
    role: authRuntimeBaselineAdoption.role,
    table: expectedTable.name,
    differences,
  };
}

function compareKeySet(differences, path, actual = {}, expected = {}) {
  compareValue(
    differences,
    `${path}.__keys`,
    Object.keys(actual).sort(),
    Object.keys(expected).sort(),
  );
}

function compareValue(differences, path, actual, expected, property = null) {
  const normalizedActual = normalizeLegacyValue(property, actual);
  const normalizedExpected = normalizeLegacyValue(property, expected);
  if (JSON.stringify(normalizedActual) === JSON.stringify(normalizedExpected)) return;
  differences.push({
    code: "LEGACY_STRUCTURE_DIFFERENCE",
    path,
    actual,
    expected,
  });
}

function normalizeLegacyValue(property, value) {
  if (property === "charset" || property === "collation")
    return normalizeTableOption(property, value);
  if (property === "engine" || property === "rowFormat" || property === "createOptions")
    return normalizeTableOption(property, value);
  if (property === "default")
    return normalize(value).replace(/current_timestamp\(\)/gu, "current_timestamp");
  if (property === "extra") return normalize(value).replace(/default_generated/gu, "");
  if (property === "columnType")
    return String(value ?? "")
      .trim()
      .toLowerCase();
  if (Array.isArray(value)) return value.map((item) => normalizeLegacyValue(null, item));
  return value;
}

module.exports = {
  ADOPTIONS,
  STRUCTURAL_FINDING_CODES,
  assessExactLegacyTable,
  differenceMatches,
  evaluateTableOptionAdoption,
  normalizeLegacyValue,
};
