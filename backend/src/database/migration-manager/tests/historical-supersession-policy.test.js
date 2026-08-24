"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { LEDGER_STATES, PHYSICAL_STATES } = require("../../j12-doctor/constants");
const { draftChainManifests } = require("../../j12-doctor/manifests/draft-chain.manifests");
const { evaluateCatalogBaselineEligibility } = require("../baseline-eligibility-policy");

const HISTORICAL = "20260629190607_add_active_draft_unique_constraint_to_enrollments";
const CORRECTIVE = "20260803123000_reconcile_enrollment_multiunit_invariants";
const TABLE = "enrollments";
const INDEX = "ux_enrollments_active_draft_student_profile";
const LEGACY_COLUMNS = ["active_draft_student_person_id", "active_draft_student_profile_id"];
const FINAL_COLUMNS = ["active_draft_unit_id", ...LEGACY_COLUMNS];

test("A historical drift exato é superseded pela corrective aplicada e materializada", () => {
  const result = correctiveEvaluation(realScenario());

  assert.equal(result.dependenciesSatisfied, true);
  assert.deepEqual(result.unresolvedDependencies, []);
  assert.equal(result.reasons.includes("DEPENDENCY_NOT_SATISFIED"), false);
  assert.deepEqual(result.dependencySupersessions, [
    {
      dependencyId: HISTORICAL,
      satisfied: true,
      correctiveMigrationId: CORRECTIVE,
      artifacts: [
        {
          findingCode: "INDEX_MISMATCH",
          kind: "INDEX",
          table: TABLE,
          name: INDEX,
          replacementAction: "REPLACE_LEGACY_IF_EXACT",
        },
      ],
    },
  ]);
});

test("B corrective não aplicada mantém dependency não satisfeita", () => {
  const scenario = realScenario();
  scenario.corrective.ledgerState = LEDGER_STATES.PENDING;

  assertDependencyBlocked(scenario);
});

test("C corrective com checksum mismatch mantém dependency não satisfeita", () => {
  const scenario = realScenario();
  scenario.corrective.checksumMatches = false;

  assertDependencyBlocked(scenario);
});

test("D corrective com structural drift mantém dependency não satisfeita", () => {
  const scenario = realScenario();
  scenario.corrective.physicalState = PHYSICAL_STATES.INCOMPATIBLE;
  scenario.corrective.structuralDrift = true;

  assertDependencyBlocked(scenario);
});

test("E drift histórico em artefato não declarado permanece bloqueado", () => {
  const scenario = realScenario();
  scenario.findings.push({
    code: "COLUMN_MISMATCH",
    severity: "HIGH",
    details: {
      migrationId: HISTORICAL,
      table: TABLE,
      column: "status",
      actual: { columnType: "varchar(64)", nullable: false },
      expected: { columnType: "varchar(32)", nullable: false },
      mismatches: ["columnType"],
    },
  });

  assertDependencyBlocked(scenario);
});

test("F table, name ou kind divergente nunca satisfaz supersession", () => {
  const variants = [
    indexMismatch({ table: "other_table" }),
    indexMismatch({ index: "other_index" }),
    {
      code: "COLUMN_MISMATCH",
      severity: "HIGH",
      details: {
        migrationId: HISTORICAL,
        table: TABLE,
        column: INDEX,
        actual: indexDefinition(FINAL_COLUMNS),
        expected: indexDefinition(LEGACY_COLUMNS),
        mismatches: ["generationExpression"],
      },
    },
  ];

  for (const finding of variants) assertDependencyBlocked(realScenario({ finding }));
});

function assertDependencyBlocked(scenario) {
  const result = correctiveEvaluation(scenario);
  assert.equal(result.dependenciesSatisfied, false);
  assert.deepEqual(result.unresolvedDependencies, [HISTORICAL]);
  assert.ok(result.reasons.includes("DEPENDENCY_NOT_SATISFIED"));
  assert.deepEqual(result.dependencySupersessions, []);
}

function correctiveEvaluation(scenario) {
  const migrations = [scenario.historical, scenario.corrective];
  const policy = evaluateCatalogBaselineEligibility({
    doctorReport: {
      database: { host: "localhost", name: "j12", remote: false },
      schemaSnapshot: { tables: {} },
      expectedSchema: [correctiveManifest()],
      migrations,
      findings: scenario.findings,
    },
    canonicalPlan: migrations.map((migration) => ({
      id: migration.id,
      dependencies: migration.dependencies,
    })),
  });
  return policy.evaluations.find((evaluation) => evaluation.migrationId === CORRECTIVE);
}

function realScenario({ finding = indexMismatch() } = {}) {
  return {
    historical: migration({
      id: HISTORICAL,
      dependencies: [],
      ledgerState: LEDGER_STATES.APPLIED,
      physicalState: PHYSICAL_STATES.INCOMPATIBLE,
      structuralDrift: true,
    }),
    corrective: migration({
      id: CORRECTIVE,
      dependencies: [HISTORICAL],
      ledgerState: LEDGER_STATES.APPLIED,
      physicalState: PHYSICAL_STATES.PRESENT,
      structuralDrift: false,
      applyPolicy: structuredClone(correctiveManifest().applyPolicy),
    }),
    findings: [finding],
  };
}

function migration(overrides) {
  return {
    id: overrides.id,
    name: overrides.id.slice(15),
    fileName: `${overrides.id}.js`,
    checksum: "a".repeat(64),
    dependencies: [],
    ledgerState: LEDGER_STATES.PENDING,
    physicalState: PHYSICAL_STATES.ABSENT,
    checksumMatches: true,
    manifestAvailable: true,
    structuralDrift: false,
    tableOptionDrift: false,
    requiredArtifactsMissing: [],
    artifactMismatches: [],
    tableOptionDifferences: [],
    ...overrides,
  };
}

function indexMismatch(overrides = {}) {
  return {
    code: "INDEX_MISMATCH",
    severity: "HIGH",
    details: {
      migrationId: HISTORICAL,
      table: TABLE,
      index: INDEX,
      actual: indexDefinition(FINAL_COLUMNS),
      expected: indexDefinition(LEGACY_COLUMNS),
      ...overrides,
    },
  };
}

function indexDefinition(columns) {
  return { unique: true, columns: columns.map((name) => ({ name })) };
}

function correctiveManifest() {
  const manifest = draftChainManifests.find((entry) => entry.migrationId === CORRECTIVE);
  assert.ok(manifest, `Manifest ausente para ${CORRECTIVE}.`);
  return manifest;
}
