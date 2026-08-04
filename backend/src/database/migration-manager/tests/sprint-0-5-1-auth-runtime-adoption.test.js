"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  assessManifest,
  normalizeTableOption,
} = require("../../j12-doctor/checks/schema-manifest-check");
const { correlateMigrations } = require("../../j12-doctor/doctor");
const { LEDGER_STATES, PHYSICAL_STATES } = require("../../j12-doctor/constants");
const {
  AUTH_RUNTIME_CORRECTIVE_MIGRATION,
  AUTH_RUNTIME_HISTORICAL_MIGRATION,
  authRuntimeBaselineAdoption,
} = require("../baseline-adoptions/auth-runtime.adoption");
const { evaluateTableOptionAdoption } = require("../baseline-adoption-policy");
const { evaluateCatalogBaselineEligibility } = require("../baseline-eligibility-policy");
const { buildBaselinePlan } = require("../baseline-manager");
const { assessApplyOneRequest } = require("../apply-manager");
const { MigrationManager } = require("../manager");
const { buildMigrationPlan } = require("../plan-manager");
const { buildValidationReport } = require("../validate-manager");
const {
  CORRECTIVE_MANIFEST,
  HISTORICAL_MANIFEST,
  createAuthRuntimeRealSchemaFixture,
} = require("./auth-runtime-real.fixture");

test("1. fixture real preserva o drift estrutural legado observado", () => {
  const assessment = historicalAssessment();
  assert.equal(assessment.physicalState, PHYSICAL_STATES.INCOMPATIBLE);
  assert.equal(assessment.structuralDrift, true);
  assert.equal(assessment.tableOptionDrift, true);
  assert.equal(assessment.structurallyPresent, false);
});

test("2. Auth Runtime expõe as diferenças estruturais da fixture real", () => {
  const assessment = historicalAssessment();
  assert.ok(
    assessment.requiredArtifactsMissing.some(
      (item) => item.code === "INDEX_MISSING" && item.index === "uniq_j12_usuarios_email",
    ),
  );
  assert.ok(assessment.artifactMismatches.length > 0);
  assert.equal(
    assessment.findings.some((finding) =>
      [
        "TABLE_MISSING",
        "COLUMN_MISSING",
        "INDEX_MISSING",
        "COLUMN_MISMATCH",
        "INDEX_MISMATCH",
      ].includes(finding.code),
    ),
    true,
  );
});

test("3. fixture produz exatamente oito table-option differences", () => {
  assert.deepEqual(
    historicalAssessment().tableOptionDifferences.map(
      (difference) => `${difference.table}.${difference.property}`,
    ),
    expectedDifferencePaths(),
  );
});

test("4. adoção auditada aceita o shape legado e exatamente oito diferenças", () => {
  const state = createState();
  const result = adoptionFor(state);
  assert.equal(result.accepted, true);
  assert.equal(result.state, "LEGACY_AUTH_STRUCTURE_ACCEPTED");
  assert.deepEqual(result.reasons, []);
});

test("5. adoção rejeita uma sétima diferença", () => {
  const state = createState();
  const findings = historicalFindings(state);
  findings.push({
    code: "TABLE_OPTION_MISMATCH",
    details: {
      migrationId: AUTH_RUNTIME_HISTORICAL_MIGRATION,
      table: "j12_usuarios",
      property: "charset",
      actual: "utf8",
      expected: "utf8mb4",
    },
  });
  const result = evaluateTableOptionAdoption({
    migration: historicalMigration(state),
    findings,
    catalogMigrations: state.doctorReport.migrations,
    schemaSnapshot: state.doctorReport.schemaSnapshot,
  });
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("TABLE_OPTION_ADOPTION_DIFFERENCE_NOT_ACCEPTED"));
});

test("6. adoção rejeita quando falta uma das seis diferenças", () => {
  const state = createState();
  const result = evaluateTableOptionAdoption({
    migration: historicalMigration(state),
    findings: historicalFindings(state).slice(0, 5),
    catalogMigrations: state.doctorReport.migrations,
    schemaSnapshot: state.doctorReport.schemaSnapshot,
  });
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("TABLE_OPTION_ADOPTION_DIFFERENCE_MISSING"));
});

test("7. adoção rejeita checksum incorreto", () => {
  const state = createState();
  historicalMigration(state).checksum = "f".repeat(64);
  const result = adoptionFor(state);
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("LEGACY_ADOPTION_CHECKSUM_MISMATCH"));
});

test("8. adoção rejeita valor atual inesperado", () => {
  const state = createState();
  const findings = historicalFindings(state);
  findings[0].details.actual = "latin1";
  const result = evaluateTableOptionAdoption({
    migration: historicalMigration(state),
    findings,
    catalogMigrations: state.doctorReport.migrations,
    schemaSnapshot: state.doctorReport.schemaSnapshot,
  });
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("TABLE_OPTION_ADOPTION_DIFFERENCE_NOT_ACCEPTED"));
});

test("9. adoção rejeita migration corretiva ausente", () => {
  const state = createState();
  const result = evaluateTableOptionAdoption({
    migration: historicalMigration(state),
    findings: historicalFindings(state),
    catalogMigrations: [historicalMigration(state)],
    schemaSnapshot: state.doctorReport.schemaSnapshot,
  });
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("TABLE_OPTION_ADOPTION_CORRECTIVE_MIGRATION_REQUIRED"));
  const correctiveWithoutDependency = {
    ...state.doctorReport.migrations.find(
      (migration) => migration.id === AUTH_RUNTIME_CORRECTIVE_MIGRATION,
    ),
    dependencies: [],
  };
  const wrongDependency = evaluateTableOptionAdoption({
    migration: historicalMigration(state),
    findings: historicalFindings(state),
    catalogMigrations: [historicalMigration(state), correctiveWithoutDependency],
    schemaSnapshot: state.doctorReport.schemaSnapshot,
  });
  assert.equal(wrongDependency.accepted, false);
  assert.ok(
    wrongDependency.reasons.includes("TABLE_OPTION_ADOPTION_CORRECTIVE_MIGRATION_REQUIRED"),
  );
});

test("10. adoção rejeita qualquer drift estrutural", () => {
  const state = createState();
  const findings = historicalFindings(state);
  findings.push({
    code: "COLUMN_MISMATCH",
    details: {
      migrationId: AUTH_RUNTIME_HISTORICAL_MIGRATION,
      table: "users",
      column: "id",
    },
  });
  const result = evaluateTableOptionAdoption({
    migration: historicalMigration(state),
    findings,
    catalogMigrations: state.doctorReport.migrations,
    schemaSnapshot: state.doctorReport.schemaSnapshot,
  });
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("LEGACY_ADOPTION_UNRELATED_STRUCTURAL_DRIFT"));
});

test("11. baseline propõe exclusivamente a histórica com adoção", () => {
  const state = createState();
  const baseline = buildBaselinePlan(state);
  assert.deepEqual(baseline.confirmation.only, [AUTH_RUNTIME_HISTORICAL_MIGRATION]);
  assert.equal(baseline.registrations[0].eligibilityState, "BASELINE_READY_WITH_ADOPTION");
  assert.deepEqual(baseline.registrations[0].informationalReasons, [
    "AUDITED_LEGACY_AUTH_ADOPTION",
    "AUDITED_TABLE_OPTION_ADOPTION",
  ]);
  const evaluation = baseline.eligibility.find(
    (item) => item.migrationId === AUTH_RUNTIME_HISTORICAL_MIGRATION,
  );
  assert.deepEqual(evaluation.reasons, []);
  for (const forbidden of [
    "STRUCTURAL_DRIFT",
    "REQUIRED_ARTIFACT_MISSING",
    "ARTIFACT_MISMATCH",
    "PHYSICAL_STATE_NOT_PRESENT",
    "TABLE_OPTION_ADOPTION_DIFFERENCE_NOT_ACCEPTED",
  ])
    assert.ok(!evaluation.reasons.includes(forbidden), forbidden);
});

test("12. baseline dry-run não executa SQL histórico", () => {
  const baseline = buildBaselinePlan(createState());
  assert.equal(baseline.writesPerformed, false);
  assert.equal(baseline.dryRun, true);
  assert.doesNotMatch(
    JSON.stringify(baseline),
    /CREATE TABLE IF NOT EXISTS users|ALTER TABLE|INSERT INTO/iu,
  );
});

test("13. antes do baseline a corretiva é bloqueada pela dependência", () => {
  const result = assessApplyOneRequest(createState(), AUTH_RUNTIME_CORRECTIVE_MIGRATION);
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("DEPENDENCY_NOT_APPLIED"));
});

test("14. depois do baseline fake a corretiva fica elegível", () => {
  const state = createState({ historicalApplied: true });
  const result = assessApplyOneRequest(state, AUTH_RUNTIME_CORRECTIVE_MIGRATION);
  assert.equal(result.eligible, true);
  assert.ok(!result.reasons.includes("DEPENDENCY_NOT_APPLIED"));
  assert.ok(!result.reasons.includes("DEPENDENCY_STRUCTURAL_DRIFT"));
  assert.equal(result.migration.physicalState, PHYSICAL_STATES.TABLE_OPTION_DRIFT);
});

test("15. utf8 e utf8mb3 são aliases normalizados", () => {
  assert.equal(normalizeTableOption("charset", "utf8"), "utf8");
  assert.equal(normalizeTableOption("charset", "utf8mb3"), "utf8");
  assert.equal(normalizeTableOption("collation", "utf8mb3_unicode_ci"), "utf8_unicode_ci");
  const state = createState({ charsetAlias: "utf8mb3" });
  assert.equal(historicalAssessment({ charsetAlias: "utf8mb3" }).tableOptionDrift, true);
  assert.equal(adoptionFor(state).accepted, true);
});

test("16. utf8 nunca é normalizado como utf8mb4", () => {
  assert.notEqual(
    normalizeTableOption("charset", "utf8"),
    normalizeTableOption("charset", "utf8mb4"),
  );
  assert.notEqual(
    normalizeTableOption("collation", "utf8_unicode_ci"),
    normalizeTableOption("collation", "utf8mb4_unicode_ci"),
  );
});

test("17. findings de outra migration não contaminam a histórica", () => {
  const state = createState();
  state.doctorReport.findings.push({
    code: "COLUMN_MISSING",
    details: { migrationId: "20260101000000_other", table: "other", column: "id" },
  });
  const policy = evaluateCatalogBaselineEligibility(state);
  const historical = policy.evaluations.find(
    (item) => item.migrationId === AUTH_RUNTIME_HISTORICAL_MIGRATION,
  );
  assert.equal(historical.state, "BASELINE_READY_WITH_ADOPTION");
  assert.equal(historical.legacyAdoptionAccepted, true);
  assert.ok(historical.requiredArtifactsMissing.length > 0);
  assert.ok(historical.artifactMismatches.length > 0);
  const directAdoption = evaluateTableOptionAdoption({
    migration: historicalMigration(state),
    findings: state.doctorReport.findings,
    catalogMigrations: state.doctorReport.migrations,
    schemaSnapshot: state.doctorReport.schemaSnapshot,
  });
  assert.equal(directAdoption.accepted, true);
});

test("18. Doctor, plan, baseline e validate compartilham a mesma elegibilidade", () => {
  const state = createState();
  const doctorMigration = historicalMigration(state);
  const plan = buildMigrationPlan(state);
  const baseline = buildBaselinePlan(state);
  const validate = buildValidationReport(state);
  const planEvaluation = plan.baselineReady.find(
    (item) => item.migrationId === AUTH_RUNTIME_HISTORICAL_MIGRATION,
  );
  const baselineEvaluation = baseline.eligibility.find(
    (item) => item.migrationId === AUTH_RUNTIME_HISTORICAL_MIGRATION,
  );
  const validateEvaluation = validate.baselineEligibility.find(
    (item) => item.migrationId === AUTH_RUNTIME_HISTORICAL_MIGRATION,
  );
  assert.equal(doctorMigration.physicalState, PHYSICAL_STATES.INCOMPATIBLE);
  assert.equal(doctorMigration.structuralDrift, true);
  assert.equal(doctorMigration.formalDrift, false);
  assert.equal(planEvaluation.observedStructuralDrift, true);
  assert.equal(planEvaluation.structuralDrift, false);
  assert.equal(planEvaluation.state, "BASELINE_READY_WITH_ADOPTION");
  assert.equal(baselineEvaluation.state, planEvaluation.state);
  assert.equal(validateEvaluation.state, planEvaluation.state);
});

test("19. execução focada usa zero conexões reais", async () => {
  let connections = 0;
  const state = createState();
  const manager = new MigrationManager({
    async stateCollector() {
      return state;
    },
  });
  const result = await manager.run("baseline", {
    createClient() {
      connections += 1;
    },
  });
  assert.equal(result.dryRun, true);
  assert.equal(connections, 0);
});

test("20. execução focada realiza zero escritas reais", async () => {
  let writes = 0;
  const state = createState();
  const manager = new MigrationManager({
    async stateCollector() {
      return state;
    },
  });
  const result = await manager.run("baseline", {
    writer() {
      writes += 1;
    },
  });
  assert.equal(result.writesPerformed, false);
  assert.equal(writes, 0);
});

function historicalAssessment(options = {}) {
  return assessManifest(createAuthRuntimeRealSchemaFixture(options), HISTORICAL_MANIFEST);
}

function createState({ historicalApplied = false, charsetAlias = "utf8" } = {}) {
  const schemaSnapshot = createAuthRuntimeRealSchemaFixture({ charsetAlias });
  const historical = catalogMigration({
    id: AUTH_RUNTIME_HISTORICAL_MIGRATION,
    checksum: authRuntimeBaselineAdoption.migrationChecksum,
    dependencies: [],
    ledgerState: historicalApplied ? LEDGER_STATES.APPLIED : LEDGER_STATES.PENDING,
    checksumMatches: historicalApplied ? true : null,
  });
  const corrective = catalogMigration({
    id: AUTH_RUNTIME_CORRECTIVE_MIGRATION,
    checksum: "d".repeat(64),
    dependencies: [AUTH_RUNTIME_HISTORICAL_MIGRATION],
    ledgerState: LEDGER_STATES.PENDING,
    checksumMatches: null,
  });
  const correlation = correlateMigrations({ migrations: [historical, corrective] }, [
    assessManifest(schemaSnapshot, HISTORICAL_MANIFEST),
    assessManifest(schemaSnapshot, CORRECTIVE_MANIFEST),
  ]);
  const migrations = correlation.migrations;
  const summary = {
    migrationsTotal: migrations.length,
    ledgerApplied: historicalApplied ? 1 : 0,
    ledgerPending: historicalApplied ? 1 : 2,
    physicallyPresent: 0,
    partiallyPresent: 0,
    physicallyAbsent: 0,
    tableOptionDrift: 2,
    structuralDrift: 0,
    formalDrift: historicalApplied ? 1 : 2,
    driftDetected: 2,
    unknown: 0,
    severityCounts: { INFO: 0, WARNING: 0, HIGH: correlation.findings.length, CRITICAL: 0 },
  };
  const doctorReport = {
    generatedAt: "2026-08-04T12:00:00.000Z",
    database: { host: "fake", name: "j12", remote: false },
    schemaSnapshot,
    schema: schemaSnapshot.counts,
    summary,
    migrations,
    findings: correlation.findings,
    expectedSchema: [HISTORICAL_MANIFEST, CORRECTIVE_MANIFEST].map((manifest) => ({
      migrationId: manifest.migrationId,
      requiredTables: manifest.requiredTables,
      requiredColumns: manifest.requiredColumns,
      requiredIndexes: manifest.requiredIndexes,
      requiredForeignKeys: manifest.requiredForeignKeys,
      requiredGeneratedColumns: manifest.requiredGeneratedColumns,
      applyPolicy: manifest.applyPolicy,
    })),
  };
  return {
    doctorReport,
    canonicalPlan: migrations.map((migration) => ({
      id: migration.id,
      checksum: migration.checksum,
      dependencies: migration.dependencies,
      state: migration.ledgerState,
    })),
    operationalPreflightByMigration: {
      [AUTH_RUNTIME_CORRECTIVE_MIGRATION]: {
        migrationId: AUTH_RUNTIME_CORRECTIVE_MIGRATION,
        readOnly: true,
        safeToApply: true,
        riskLevel: "LOW",
        ddlImplicitCommit: true,
        backupRequired: true,
        tableCount: 3,
        changeCount: 3,
        server: { version: "5.7.44", sqlMode: "STRICT_TRANS_TABLES" },
        tables: ["users", "user_sessions", "password_reset_tokens"].map((name) => ({
          name,
          charset: charsetAlias,
          collation: charsetAlias === "utf8mb3" ? "utf8mb3_unicode_ci" : "utf8_unicode_ci",
          expectedCharset: "utf8mb4",
          expectedCollation: "utf8mb4_unicode_ci",
          requiresChange: true,
          lockRisk: "LOW",
        })),
        blockers: [],
      },
    },
    runner: { reused: true, dryRun: true, migrations: migrations.length },
  };
}

function catalogMigration({ id, checksum, dependencies, ledgerState, checksumMatches }) {
  return {
    id,
    name: id.slice(15),
    fileName: `${id}.js`,
    checksum,
    dependencies,
    ledgerState,
    ledgerStatus: ledgerState === LEDGER_STATES.APPLIED ? "APPLIED" : null,
    appliedAt: null,
    checksumMatches,
  };
}

function historicalMigration(state) {
  return state.doctorReport.migrations.find(
    (migration) => migration.id === AUTH_RUNTIME_HISTORICAL_MIGRATION,
  );
}

function historicalFindings(state) {
  return state.doctorReport.findings
    .filter(
      (finding) =>
        finding.details?.migrationId === AUTH_RUNTIME_HISTORICAL_MIGRATION,
    )
    .map((finding) => structuredClone(finding));
}

function adoptionFor(state) {
  return evaluateTableOptionAdoption({
    migration: historicalMigration(state),
    findings: historicalFindings(state),
    catalogMigrations: state.doctorReport.migrations,
    schemaSnapshot: state.doctorReport.schemaSnapshot,
  });
}

function expectedDifferencePaths() {
  return [
    "j12_usuarios.charset",
    "j12_usuarios.collation",
    "users.charset",
    "users.collation",
    "user_sessions.charset",
    "user_sessions.collation",
    "password_reset_tokens.charset",
    "password_reset_tokens.collation",
  ];
}
