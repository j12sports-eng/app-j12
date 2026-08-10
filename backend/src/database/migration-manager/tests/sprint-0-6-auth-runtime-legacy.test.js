"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  AUTH_RUNTIME_CLASSIFICATION,
  AUTH_RUNTIME_ROLES,
} = require("../../auth-runtime-legacy-contract");
const { assessManifest } = require("../../j12-doctor/checks/schema-manifest-check");
const { LEDGER_STATES } = require("../../j12-doctor/constants");
const { correlateMigrations } = require("../../j12-doctor/doctor");
const { MIGRATION_DEPENDENCIES } = require("../../migration-runner/migration-dependencies");
const { analyzeAuthLegacyPreflight, runAuthLegacyPreflight } = require("../auth-legacy-preflight");
const {
  AUTH_RUNTIME_CORRECTIVE_MIGRATION,
  AUTH_RUNTIME_HISTORICAL_MIGRATION,
  authRuntimeBaselineAdoption,
} = require("../baseline-adoptions/auth-runtime.adoption");
const {
  assessExactLegacyTable,
  evaluateTableOptionAdoption,
} = require("../baseline-adoption-policy");
const { buildBaselinePlan } = require("../baseline-manager");
const {
  assertCanonicalAuthBoundary,
  findCanonicalLegacyAuthDependencies,
} = require("../canonical-auth-boundary");
const { J12_USUARIOS_RUNTIME_CONSUMERS } = require("../auth-runtime-consumers.manifest");
const { assessApplyOneRequest } = require("../apply-manager");
const { MigrationManager } = require("../manager");
const {
  CORRECTIVE_MANIFEST,
  HISTORICAL_MANIFEST,
  createAuthRuntimeRealSchemaFixture,
} = require("./auth-runtime-real.fixture");

const ROOT = path.resolve(__dirname, "../../../../..");
const AUTH_IDENTITIES_MIGRATION = "20260724120000_create_auth_identities_table";

test("1. todos os consumidores runtime de j12_usuarios estao classificados", () => {
  const observed = findRuntimeConsumers().sort();
  const classified = J12_USUARIOS_RUNTIME_CONSUMERS.map((item) => item.file).sort();
  assert.deepEqual(observed, classified);
  for (const consumer of J12_USUARIOS_RUNTIME_CONSUMERS) {
    assert.ok(consumer.classification);
    assert.ok(consumer.access.length > 0);
    assert.ok(consumer.useCases.length > 0);
  }
});

test("2. nenhum repository canonico depende diretamente de j12_usuarios", () => {
  const files = readCanonicalRepositoryFiles();
  assert.deepEqual(findCanonicalLegacyAuthDependencies(files), []);
  assert.deepEqual(assertCanonicalAuthBoundary(files).violations, []);
  assert.throws(
    () =>
      assertCanonicalAuthBoundary([
        {
          path: "backend/src/domains/auth/infrastructure/repositories/new.repository.js",
          content: "SELECT * FROM j12_usuarios",
        },
      ]),
    (error) => error.code === "CANONICAL_REPOSITORY_DEPENDS_ON_LEGACY_AUTH",
  );
});

test("3. j12_usuarios e reconhecida como LEGACY_READ_WRITE", () => {
  assert.equal(AUTH_RUNTIME_CLASSIFICATION.legacyRole, "LEGACY_AUTH_TABLE");
  assert.equal(AUTH_RUNTIME_CLASSIFICATION.legacyAccess, "LEGACY_READ_WRITE");
  assert.equal(AUTH_RUNTIME_ROLES.J12_USUARIOS, "LEGACY_READ_WRITE");
  assert.equal(authRuntimeBaselineAdoption.classification, "LEGACY_READ_WRITE");
});

test("4. qualquer diferenca adicional bloqueia a adoption", () => {
  const state = createState();
  state.doctorReport.schemaSnapshot.tables.j12_usuarios.columns.unreviewed = {
    name: "unreviewed",
    position: 12,
    columnType: "varchar(1)",
  };
  const result = adoptionFor(state);
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("LEGACY_ADOPTION_STRUCTURE_MISMATCH"));
  assert.ok(
    result.legacyStructure.differences.some((difference) => difference.path === "columns.__keys"),
  );
});

test("5. checksum divergente bloqueia a adoption", () => {
  const state = createState();
  historicalMigration(state).checksum = "f".repeat(64);
  const result = adoptionFor(state);
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes("LEGACY_ADOPTION_CHECKSUM_MISMATCH"));
});

test("6. estrutura legada real exata permite adoption", () => {
  const state = createState();
  const exact = assessExactLegacyTable(
    state.doctorReport.schemaSnapshot,
    authRuntimeBaselineAdoption.legacyTable,
  );
  assert.equal(exact.accepted, true);
  assert.deepEqual(exact.differences, []);
  assert.equal(adoptionFor(state).accepted, true);
});

test("7. nao existe conversao automatica de IDs legados", () => {
  const corrective = read(
    "backend/src/database/migrations/20260803133000_reconcile_auth_runtime_charset_collation.js",
  );
  assert.doesNotMatch(
    corrective,
    /ALTER\s+TABLE\s+j12_usuarios[\s\S]*(BIGINT|VARCHAR\s*\(\s*64\s*\))/iu,
  );
  assert.ok(authRuntimeBaselineAdoption.restrictions.includes("NO_AUTOMATIC_ID_TYPE_CONVERSION"));
});

test("8. nao existe conversao automatica de ENUM legado", () => {
  const corrective = read(
    "backend/src/database/migrations/20260803133000_reconcile_auth_runtime_charset_collation.js",
  );
  assert.doesNotMatch(corrective, /ALTER\s+TABLE\s+j12_usuarios[\s\S]*(perfil|status)/iu);
  assert.ok(authRuntimeBaselineAdoption.restrictions.includes("NO_AUTOMATIC_ENUM_CONVERSION"));
});

test("9. nao existe adicao automatica de UNIQUE(email)", () => {
  const corrective = read(
    "backend/src/database/migrations/20260803133000_reconcile_auth_runtime_charset_collation.js",
  );
  assert.doesNotMatch(corrective, /j12_usuarios[\s\S]*UNIQUE[\s\S]*email/iu);
  assert.ok(authRuntimeBaselineAdoption.restrictions.includes("NO_AUTOMATIC_UNIQUE_EMAIL_DDL"));
});

test("10. email duplicado bloquearia eventual UNIQUE", () => {
  const report = analyzeAuthLegacyPreflight({
    duplicate_emails: [{ email_key: "duplicado@j12.test", total: 2 }],
  });
  assert.equal(report.automaticUniqueEmailAllowed, false);
  assert.deepEqual(report.blockers[0], { code: "LEGACY_DUPLICATE_EMAILS", count: 2 });
});

test("11. status NULL e detectado no preflight", () => {
  const report = analyzeAuthLegacyPreflight({ null_status: [{ total: 3 }] });
  assert.ok(report.blockers.some((blocker) => blocker.code === "LEGACY_NULL_STATUS"));
  assert.equal(report.summary.nullStatus, 3);
});

test("12. IDs orfaos sao detectados no preflight", () => {
  const report = analyzeAuthLegacyPreflight({
    orphan_aluno_ids: [{ total: 1 }],
    orphan_professor_ids: [{ total: 2 }],
    orphan_responsavel_ids: [{ total: 3 }],
  });
  assert.deepEqual(
    report.blockers.map((blocker) => blocker.code),
    ["LEGACY_ORPHAN_ALUNO_IDS", "LEGACY_ORPHAN_PROFESSOR_IDS", "LEGACY_ORPHAN_RESPONSAVEL_IDS"],
  );
});

test("13. colisoes users/j12_usuarios sao detectadas", () => {
  const report = analyzeAuthLegacyPreflight({
    email_collisions: [{ email_key: "a@j12.test", total: 1 }],
  });
  assert.equal(report.summary.emailCollisions, 1);
  assert.ok(report.blockers.some((blocker) => blocker.code === "AUTH_EMAIL_COLLISIONS"));
});

test("14. baseline historico dry-run nao executa SQL", () => {
  const baseline = buildBaselinePlan(createState());
  assert.equal(baseline.dryRun, true);
  assert.equal(baseline.writesPerformed, false);
  assert.deepEqual(baseline.confirmation.only, [AUTH_RUNTIME_HISTORICAL_MIGRATION]);
  assert.doesNotMatch(JSON.stringify(baseline), /CREATE TABLE|ALTER TABLE|INSERT INTO/iu);
});

test("15. corretiva de charset continua dependente da historica", () => {
  assert.deepEqual(MIGRATION_DEPENDENCIES[AUTH_RUNTIME_CORRECTIVE_MIGRATION], [
    AUTH_RUNTIME_HISTORICAL_MIGRATION,
  ]);
});

test("16. depois da adoption fake a corretiva fica elegivel", () => {
  const assessment = assessApplyOneRequest(
    createState({ historicalApplied: true }),
    AUTH_RUNTIME_CORRECTIVE_MIGRATION,
  );
  assert.equal(assessment.eligible, true);
  assert.ok(!assessment.reasons.includes("DEPENDENCY_STRUCTURAL_DRIFT"));
});

test("17. auth_identities continua dependente da corretiva", () => {
  assert.deepEqual(MIGRATION_DEPENDENCIES[AUTH_IDENTITIES_MIGRATION], [
    AUTH_RUNTIME_CORRECTIVE_MIGRATION,
  ]);
});

test("18. migration historica nao foi reescrita", () => {
  const source = read(
    "backend/src/database/migrations/20260712184500_create_auth_runtime_tables.sql",
  );
  const checksum = createHash("sha256").update(source, "utf8").digest("hex");
  assert.equal(checksum, authRuntimeBaselineAdoption.migrationChecksum);
});

test("19. nenhuma tabela de matricula e tocada pela reconciliacao auth", () => {
  const corrective = read(
    "backend/src/database/migrations/20260803133000_reconcile_auth_runtime_charset_collation.js",
  );
  assert.doesNotMatch(
    corrective,
    /(?:ALTER|CREATE|DROP|TRUNCATE|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+.*(?:enrollments|matriculas?)/iu,
  );
});

test("20. fluxo focado abre zero conexoes reais", async () => {
  let connections = 0;
  const manager = new MigrationManager({
    async stateCollector() {
      return createState();
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

test("21. preflight fake realiza zero escritas reais", async () => {
  let writes = 0;
  let reads = 0;
  const report = await runAuthLegacyPreflight({
    async queryRunner(sql) {
      if (!/^SELECT\b/iu.test(sql.trim())) writes += 1;
      reads += 1;
      return [];
    },
  });
  assert.ok(reads > 0);
  assert.equal(writes, 0);
  assert.equal(report.writesPerformed, false);
});

test("22. Doctor, Manager e policy usam a mesma classificacao", () => {
  const state = createState();
  const doctor = historicalMigration(state).authRuntimeClassification;
  const manager = buildBaselinePlan(state).eligibility.find(
    (item) => item.migrationId === AUTH_RUNTIME_HISTORICAL_MIGRATION,
  );
  const policy = adoptionFor(state);
  assert.strictEqual(doctor, AUTH_RUNTIME_CLASSIFICATION);
  assert.equal(manager.legacyClassification, AUTH_RUNTIME_CLASSIFICATION.legacyAccess);
  assert.equal(policy.legacyClassification, AUTH_RUNTIME_CLASSIFICATION.legacyAccess);
});

function createState({ historicalApplied = false } = {}) {
  const schemaSnapshot = createAuthRuntimeRealSchemaFixture();
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
  return {
    doctorReport: {
      generatedAt: "2026-08-03T12:00:00.000Z",
      database: { host: "fake", name: "j12", remote: false },
      schemaSnapshot,
      schema: schemaSnapshot.counts,
      summary: {
        ledgerApplied: historicalApplied ? 1 : 0,
        ledgerPending: historicalApplied ? 1 : 2,
        physicallyPresent: 0,
        partiallyPresent: 0,
        physicallyAbsent: 0,
        tableOptionDrift: 2,
        structuralDrift: 1,
        formalDrift: 1,
        driftDetected: 2,
        unknown: 0,
      },
      migrations,
      findings: correlation.findings,
      expectedSchema: [HISTORICAL_MANIFEST, CORRECTIVE_MANIFEST].map((manifest) => ({
        migrationId: manifest.migrationId,
        requiredTables: manifest.requiredTables,
        requiredColumns: manifest.requiredColumns,
        requiredIndexes: manifest.requiredIndexes,
        requiredForeignKeys: manifest.requiredForeignKeys,
        applyPolicy: manifest.applyPolicy,
      })),
    },
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
          charset: "utf8",
          collation: "utf8_unicode_ci",
          expectedCharset: "utf8mb4",
          expectedCollation: "utf8mb4_unicode_ci",
          requiresChange: true,
          lockRisk: "LOW",
        })),
        blockers: [],
      },
    },
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
    appliedAt: ledgerState === LEDGER_STATES.APPLIED ? "2026-08-03T00:00:00.000Z" : null,
    checksumMatches,
  };
}

function historicalMigration(state) {
  return state.doctorReport.migrations.find(
    (migration) => migration.id === AUTH_RUNTIME_HISTORICAL_MIGRATION,
  );
}

function adoptionFor(state) {
  return evaluateTableOptionAdoption({
    migration: historicalMigration(state),
    findings: state.doctorReport.findings,
    catalogMigrations: state.doctorReport.migrations,
    schemaSnapshot: state.doctorReport.schemaSnapshot,
  });
}

function findRuntimeConsumers() {
  return walk(path.join(ROOT, "backend"))
    .filter((file) => file.endsWith(".js"))
    .map((file) => path.relative(ROOT, file).replace(/\\/gu, "/"))
    .filter((file) => !file.includes("/node_modules/"))
    .filter((file) => !file.includes("/tests/") && !file.endsWith(".test.js"))
    .filter((file) => !file.startsWith("backend/src/database/migrations/"))
    .filter((file) => !file.startsWith("backend/src/database/migration-manager/"))
    .filter((file) => !file.startsWith("backend/src/database/j12-doctor/"))
    .filter((file) => file !== "backend/src/database/auth-runtime-legacy-contract.js")
    .filter((file) => /\bj12_usuarios\b/iu.test(read(file)));
}

function readCanonicalRepositoryFiles() {
  return walk(path.join(ROOT, "backend/src/domains"))
    .filter((file) => /[\\/]infrastructure[\\/]repositories[\\/].*\.js$/u.test(file))
    .filter((file) => !file.endsWith(".test.js"))
    .map((file) => ({
      path: path.relative(ROOT, file).replace(/\\/gu, "/"),
      content: fs.readFileSync(file, "utf8"),
    }));
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(target);
    return [target];
  });
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}
