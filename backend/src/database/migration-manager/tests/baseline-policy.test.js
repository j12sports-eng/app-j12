"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { LEDGER_STATES, PHYSICAL_STATES } = require("../../j12-doctor/constants");
const {
  evaluateBaselineEligibility,
  evaluateCatalogBaselineEligibility,
} = require("../baseline-eligibility-policy");
const { buildBaselinePlan } = require("../baseline-manager");
const { analyzeDuplicateMigrations } = require("../duplicate-manager");
const { MigrationManager } = require("../manager");
const { buildMigrationPlan } = require("../plan-manager");

const MULTIUNIT_ID = "20260729180000_enforce_enrollment_multiunit_invariants";

function migration(overrides = {}) {
  return {
    id: "20260712183000_create_people_domain_tables",
    name: "create_people_domain_tables",
    fileName: "20260712183000_create_people_domain_tables.sql",
    checksum: "a".repeat(64),
    dependencies: [],
    ledgerState: LEDGER_STATES.PENDING,
    physicalState: PHYSICAL_STATES.PRESENT,
    checksumMatches: null,
    manifestAvailable: true,
    driftDetected: true,
    ...overrides,
  };
}

function evaluate(overrides = {}, context = {}) {
  return evaluateBaselineEligibility({
    migration: migration(overrides),
    findings: context.findings || [],
    dependenciesSatisfied: context.dependenciesSatisfied ?? true,
    unresolvedDependencies: context.unresolvedDependencies || [],
    ambiguousOwnership: context.ambiguousOwnership || false,
  });
}

function report(migrations, findings = [], expectedSchema = []) {
  return {
    generatedAt: "2026-08-03T12:00:00.000Z",
    database: { host: "localhost", name: "j12", remote: false },
    schemaSnapshot: { tables: {} },
    summary: {
      ledgerApplied: 0,
      ledgerPending: migrations.length,
      physicallyPresent: migrations.filter((item) => item.physicalState === PHYSICAL_STATES.PRESENT)
        .length,
      partiallyPresent: migrations.filter((item) => item.physicalState === PHYSICAL_STATES.PARTIAL)
        .length,
      physicallyAbsent: migrations.filter((item) => item.physicalState === PHYSICAL_STATES.ABSENT)
        .length,
      unknown: migrations.filter((item) => item.physicalState === PHYSICAL_STATES.NOT_ASSESSED)
        .length,
      severityCounts: { INFO: 0, WARNING: 0, HIGH: 0, CRITICAL: 0 },
    },
    migrations,
    findings,
    expectedSchema,
  };
}

function canonicalPlan(migrations) {
  return migrations.map((item) => ({ id: item.id, dependencies: item.dependencies }));
}

test("PHYSICALLY_PRESENT + LEDGER_PENDING + manifest completo fica BASELINE_READY", () => {
  const result = evaluate();
  assert.equal(result.eligible, true);
  assert.equal(result.state, "BASELINE_READY");
  assert.deepEqual(result.reasons, []);
});

test("DRIFT_DETECTED fica BASELINE_BLOCKED", () => {
  const result = evaluate({ physicalState: PHYSICAL_STATES.INCOMPATIBLE });
  assert.equal(result.state, "BASELINE_BLOCKED");
  assert.ok(result.reasons.includes("STRUCTURAL_DRIFT"));
});

test("PARTIALLY_PRESENT fica BASELINE_BLOCKED", () => {
  const result = evaluate({ physicalState: PHYSICAL_STATES.PARTIAL });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("PHYSICAL_STATE_NOT_PRESENT"));
});

test("UNKNOWN fica BASELINE_BLOCKED", () => {
  const result = evaluate({
    physicalState: PHYSICAL_STATES.NOT_ASSESSED,
    manifestAvailable: false,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("UNKNOWN_PHYSICAL_STATE"));
});

test("checksum divergente fica BASELINE_BLOCKED", () => {
  const result = evaluate({ checksumMatches: false });
  assert.ok(result.reasons.includes("CHECKSUM_MISMATCH"));
});

test("dependência não satisfeita fica BASELINE_BLOCKED", () => {
  const result = evaluate(
    {},
    {
      dependenciesSatisfied: false,
      unresolvedDependencies: ["dependency"],
    },
  );
  assert.ok(result.reasons.includes("DEPENDENCY_NOT_SATISFIED"));
  assert.deepEqual(result.unresolvedDependencies, ["dependency"]);
});

test("manifest ausente fica BASELINE_BLOCKED", () => {
  const result = evaluate({ manifestAvailable: false });
  assert.ok(result.reasons.includes("MANIFEST_MISSING"));
});

test("índice incompatível gera ARTIFACT_MISMATCH", () => {
  const migrationId = migration().id;
  const result = evaluate(
    {},
    {
      findings: [{ code: "INDEX_MISMATCH", details: { migrationId } }],
    },
  );
  assert.ok(result.reasons.includes("STRUCTURAL_DRIFT"));
  assert.ok(result.reasons.includes("ARTIFACT_MISMATCH"));
});

test("coluna obrigatória ausente gera REQUIRED_ARTIFACT_MISSING", () => {
  const migrationId = migration().id;
  const result = evaluate(
    {},
    {
      findings: [{ code: "COLUMN_MISSING", details: { migrationId } }],
    },
  );
  assert.ok(result.reasons.includes("STRUCTURAL_DRIFT"));
  assert.ok(result.reasons.includes("REQUIRED_ARTIFACT_MISSING"));
});

test("diferença apenas formal por ledger ausente permanece BASELINE_READY", () => {
  const result = evaluate({ driftDetected: true });
  assert.equal(result.formalDrift, true);
  assert.equal(result.structuralDrift, false);
  assert.equal(result.eligible, true);
});

test("plan e baseline usam exatamente a mesma lista de candidatas", () => {
  const migrations = [
    migration(),
    migration({
      id: "20260729180000_other",
      name: "other",
      physicalState: PHYSICAL_STATES.PARTIAL,
    }),
  ];
  const doctorReport = report(migrations);
  const order = canonicalPlan(migrations);
  const plan = buildMigrationPlan({ doctorReport, canonicalPlan: order });
  const baseline = buildBaselinePlan({ doctorReport, canonicalPlan: order });
  assert.deepEqual(
    plan.baselineReady.map((item) => item.migrationId),
    baseline.registrations.map((item) => item.id),
  );
});

test("migration multiunidade com drift nunca entra no baseline", () => {
  const multiunit = migration({
    id: MULTIUNIT_ID,
    name: "enforce_enrollment_multiunit_invariants",
    physicalState: PHYSICAL_STATES.INCOMPATIBLE,
  });
  const findings = [
    { code: "COLUMN_MISSING", details: { migrationId: MULTIUNIT_ID } },
    { code: "INDEX_MISSING", details: { migrationId: MULTIUNIT_ID } },
    { code: "INDEX_MISMATCH", details: { migrationId: MULTIUNIT_ID } },
  ];
  const doctorReport = report([multiunit], findings);
  const policy = evaluateCatalogBaselineEligibility({
    doctorReport,
    canonicalPlan: canonicalPlan([multiunit]),
  });
  assert.equal(policy.ready.length, 0);
  assert.deepEqual(policy.blocked[0].reasons.slice(0, 3), [
    "STRUCTURAL_DRIFT",
    "REQUIRED_ARTIFACT_MISSING",
    "ARTIFACT_MISMATCH",
  ]);
});

test("duplicidade ambígua gera AMBIGUOUS_MIGRATION_OWNERSHIP", () => {
  const first = migration({
    id: "20260701103000_add_enrollment_class_links_table",
    name: "add_enrollment_class_links_table",
  });
  const second = migration({
    id: "20260701120000_add_enrollment_class_links_table",
    name: "add_enrollment_class_links_table",
    dependencies: [first.id],
  });
  const doctorReport = report([first, second]);
  const duplicates = analyzeDuplicateMigrations(doctorReport);
  assert.equal(duplicates.diagnostics[0].bothInCatalog, true);
  assert.equal(duplicates.diagnostics[0].severity, "HIGH");
  assert.equal(duplicates.diagnostics[0].dependencyRelations.length, 1);
  const policy = evaluateCatalogBaselineEligibility({
    doctorReport,
    canonicalPlan: canonicalPlan([first, second]),
  });
  assert.ok(policy.blocked.every((item) => item.reasons.includes("AMBIGUOUS_MIGRATION_OWNERSHIP")));
});

test("execução de baseline não chama nenhuma função de escrita", async () => {
  let writes = 0;
  const candidate = migration();
  const doctorReport = report([candidate]);
  const manager = new MigrationManager({
    async stateCollector() {
      return {
        doctorReport,
        canonicalPlan: canonicalPlan([candidate]),
        runner: { reused: true, dryRun: true, migrations: 1 },
      };
    },
  });
  const result = await manager.run("baseline", {
    writer: async () => {
      writes += 1;
    },
  });
  assert.equal(writes, 0);
  assert.equal(result.writesPerformed, false);
});
