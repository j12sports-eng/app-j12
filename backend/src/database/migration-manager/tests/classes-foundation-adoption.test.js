"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { assessManifest } = require("../../j12-doctor/checks/schema-manifest-check");
const { LEDGER_STATES, PHYSICAL_STATES } = require("../../j12-doctor/constants");
const { draftChainManifests } = require("../../j12-doctor/manifests");
const { authRuntimeBaselineAdoption } = require("../baseline-adoptions/auth-runtime.adoption");
const {
  CLASSES_FOUNDATION_MIGRATION,
  classesFoundationBaselineAdoption,
} = require("../baseline-adoptions/classes-foundation.adoption");
const {
  assessExactLegacyTable,
  evaluateTableOptionAdoption,
} = require("../baseline-adoption-policy");

const classesFoundationManifest = draftChainManifests.find(
  (manifest) => manifest.migrationId === CLASSES_FOUNDATION_MIGRATION,
);

test("A. snapshot legado exato de j12_turmas e aceito", () => {
  assert.ok(classesFoundationManifest);
  const { assessment, findings, migration, result } = evaluateClassesAdoption();

  assert.equal(migration.ledgerState, LEDGER_STATES.PENDING);
  assert.equal(migration.structuralDrift, true);
  assert.equal(migration.tableOptionDrift, true);
  assert.equal(migration.manifestAvailable, true);
  assert.equal(assessment.structuralDrift, true);
  assert.equal(assessment.tableOptionDrift, true);
  assert.deepEqual(
    assessment.tableOptionDifferences.map(
      (difference) => `${difference.table}.${difference.property}`,
    ),
    classesFoundationBaselineAdoption.acceptedTemporaryTableOptionDifferences.map(
      (difference) => `${difference.table}.${difference.property}`,
    ),
  );
  assert.ok(
    findings.some((finding) =>
      ["COLUMN_MISSING", "COLUMN_MISMATCH", "INDEX_MISMATCH"].includes(finding.code),
    ),
  );
  assert.ok(
    findings.every(
      (finding) =>
        finding.details.migrationId === CLASSES_FOUNDATION_MIGRATION &&
        finding.details.table === classesFoundationBaselineAdoption.legacyTable.name,
    ),
  );
  assert.equal(result.applicable, true);
  assert.equal(result.accepted, true);
  assert.equal(result.state, "LEGACY_CLASSES_STRUCTURE_ACCEPTED");
  assert.deepEqual(result.reasons, []);
  assert.equal(result.legacyStructure.accepted, true);
});

test("B. checksum divergente bloqueia a adoption de Classes Foundation", () => {
  const { result } = evaluateClassesAdoption({
    mutateMigration(migration) {
      migration.checksum = "f".repeat(64);
    },
  });

  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("LEGACY_ADOPTION_CHECKSUM_MISMATCH"));
});

test("C. coluna legada ausente bloqueia a adoption", () => {
  const { result } = evaluateClassesAdoption({
    mutateTable(table) {
      delete table.columns.horario_fim;
    },
  });

  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("LEGACY_ADOPTION_STRUCTURE_MISMATCH"));
});

test("D. coluna legada extra bloqueia a adoption", () => {
  const { result } = evaluateClassesAdoption({
    mutateTable(table) {
      table.columns.legacy_extra_column = {
        ...table.columns.nome,
        name: "legacy_extra_column",
        position: 19,
        columnType: "varchar(10)",
        nullable: true,
        default: null,
      };
    },
  });

  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("LEGACY_ADOPTION_STRUCTURE_MISMATCH"));
});

test("E. tipo de coluna divergente bloqueia a adoption", () => {
  const { result } = evaluateClassesAdoption({
    mutateTable(table) {
      table.columns.nome.columnType = "varchar(254)";
    },
  });

  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("LEGACY_ADOPTION_STRUCTURE_MISMATCH"));
});

test("F. composicao de indice divergente bloqueia a adoption", () => {
  const { result } = evaluateClassesAdoption({
    mutateTable(table) {
      table.indexes.idx_j12_turmas_nome.columns = [
        {
          ...table.indexes.idx_j12_turmas_nome.columns[0],
          name: "status",
        },
      ];
    },
  });

  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("LEGACY_ADOPTION_STRUCTURE_MISMATCH"));
});

test("G. table option nao auditada bloqueia a adoption", () => {
  const { result } = evaluateClassesAdoption({
    mutateTable(table) {
      table.charset = "latin1";
    },
  });

  assert.equal(result.accepted, false);
  assert.ok(
    result.reasons.includes("LEGACY_ADOPTION_STRUCTURE_MISMATCH") ||
      result.reasons.includes("TABLE_OPTION_ADOPTION_DIFFERENCE_NOT_ACCEPTED"),
  );
});

test("H. Classes Foundation nao exige migration corretiva", () => {
  const { result } = evaluateClassesAdoption();

  assert.equal(classesFoundationBaselineAdoption.mandatoryCorrectiveMigrationId, null);
  assert.equal(result.accepted, true);
  assert.ok(!result.reasons.includes("TABLE_OPTION_ADOPTION_CORRECTIVE_MIGRATION_REQUIRED"));
});

test("I. Auth Runtime continua bloqueado sem a migration corretiva", () => {
  const migration = createMigration(authRuntimeBaselineAdoption, {
    physicalState: PHYSICAL_STATES.INCOMPATIBLE,
  });
  const findings = authRuntimeBaselineAdoption.acceptedTemporaryTableOptionDifferences.map(
    (difference) => ({
      code: "TABLE_OPTION_MISMATCH",
      details: {
        migrationId: authRuntimeBaselineAdoption.migrationId,
        ...difference,
      },
    }),
  );

  const result = evaluateTableOptionAdoption({
    migration,
    findings,
    catalogMigrations: [migration],
    schemaSnapshot: createLegacySchemaSnapshot(authRuntimeBaselineAdoption),
  });

  assert.ok(authRuntimeBaselineAdoption.mandatoryCorrectiveMigrationId);
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("TABLE_OPTION_ADOPTION_CORRECTIVE_MIGRATION_REQUIRED"));
});

test("J. assessExactLegacyTable preserva classification e role de Classes", () => {
  const assessment = assessExactLegacyTable(
    createLegacySchemaSnapshot(classesFoundationBaselineAdoption),
    classesFoundationBaselineAdoption.legacyTable,
    classesFoundationBaselineAdoption,
  );

  assert.equal(assessment.accepted, true);
  assert.equal(assessment.classification, classesFoundationBaselineAdoption.classification);
  assert.equal(assessment.role, classesFoundationBaselineAdoption.role);
  assert.notEqual(assessment.role, authRuntimeBaselineAdoption.role);
});

function evaluateClassesAdoption({ mutateTable, mutateMigration } = {}) {
  const schemaSnapshot = createLegacySchemaSnapshot(classesFoundationBaselineAdoption);
  mutateTable?.(schemaSnapshot.tables[classesFoundationBaselineAdoption.legacyTable.name]);

  const assessment = assessManifest(schemaSnapshot, classesFoundationManifest);
  const migration = createMigration(classesFoundationBaselineAdoption, {
    physicalState: assessment.physicalState,
  });
  mutateMigration?.(migration);

  const findings = assessment.findings.map((finding) => ({
    ...structuredClone(finding),
    details: {
      ...structuredClone(finding.details),
      migrationId: CLASSES_FOUNDATION_MIGRATION,
    },
  }));
  const result = evaluateTableOptionAdoption({
    migration,
    findings,
    catalogMigrations: [migration],
    schemaSnapshot,
  });

  return { assessment, findings, migration, result, schemaSnapshot };
}

function createMigration(adoption, { physicalState }) {
  return {
    id: adoption.migrationId,
    checksum: adoption.migrationChecksum,
    dependencies: [],
    ledgerState: LEDGER_STATES.PENDING,
    checksumMatches: null,
    structuralDrift: true,
    tableOptionDrift: true,
    physicalState,
    manifestAvailable: true,
  };
}

function createLegacySchemaSnapshot(adoption) {
  const expectedTable = adoption.legacyTable;
  const columns = Object.fromEntries(
    Object.entries(expectedTable.columns).map(([name, definition]) => [
      name,
      {
        name,
        ...structuredClone(definition),
        primary: name === "id",
        generated: false,
        generationExpression: null,
      },
    ]),
  );
  const indexes = Object.fromEntries(
    Object.entries(expectedTable.indexes).map(([name, definition]) => [
      name,
      {
        name,
        unique: definition.unique,
        primary: name === "PRIMARY",
        type: "BTREE",
        columns: definition.columns.map((columnName) => ({
          name: columnName,
          expression: null,
          prefixLength: null,
          order: "A",
        })),
      },
    ]),
  );

  return {
    tables: {
      [expectedTable.name]: {
        name: expectedTable.name,
        engine: expectedTable.engine,
        charset: expectedTable.charset,
        collation: expectedTable.collation,
        rowFormat: expectedTable.rowFormat,
        createOptions: expectedTable.createOptions,
        columns,
        indexes,
        foreignKeys: structuredClone(expectedTable.foreignKeys),
      },
    },
  };
}
