"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { LEDGER_STATES, PHYSICAL_STATES } = require("../../j12-doctor/constants");
const { parseArguments } = require("../cli");
const {
  assessChecksumReconciliationRequest,
  buildReconcileFailedChecksumPlan,
  computeChecksumReconciliationToken,
  executeChecksumReconciliation,
} = require("../reconcile-failed-checksum-manager");

const TARGET = "20260724123000_create_user_unit_memberships_table";
const AUTH = "20260724120000_create_auth_identities_table";
const UNIT_FIX = "20260810171000_reconcile_j12_unidades_id_bigint";
const NEW_CHECKSUM = "b".repeat(64);
const OLD_CHECKSUM = "a".repeat(64);

function migration(overrides = {}) {
  return {
    id: TARGET,
    timestamp: "20260724123000",
    name: "create_user_unit_memberships_table",
    fileName: `${TARGET}.js`,
    checksum: NEW_CHECKSUM,
    ledgerChecksum: OLD_CHECKSUM,
    ledgerName: "create_user_unit_memberships_table",
    ledgerTimestamp: "20260724123000",
    dependencies: [AUTH, UNIT_FIX],
    ledgerState: LEDGER_STATES.UNKNOWN,
    ledgerStatus: "FAILED",
    checksumMatches: false,
    appliedAt: null,
    manifestAvailable: true,
    physicalState: PHYSICAL_STATES.ABSENT,
    structuralDrift: true,
    tableOptionDrift: false,
    artifactMismatches: [],
    ...overrides,
  };
}

function dependency(id, overrides = {}) {
  return {
    id,
    checksum: "c".repeat(64),
    ledgerChecksum: "c".repeat(64),
    ledgerState: LEDGER_STATES.APPLIED,
    ledgerStatus: "APPLIED",
    checksumMatches: true,
    appliedAt: "2026-08-10T12:00:00.000Z",
    manifestAvailable: true,
    physicalState: PHYSICAL_STATES.PRESENT,
    structuralDrift: false,
    tableOptionDrift: false,
    ...overrides,
  };
}

function state(targetOverrides = {}, dependencyOverrides = {}) {
  return {
    doctorReport: {
      database: { name: "bestt486_appj12", host: "108.167.168.27" },
      migrations: [
        dependency(AUTH, dependencyOverrides),
        dependency(UNIT_FIX, dependencyOverrides),
        migration(targetOverrides),
      ],
    },
  };
}

test("FAILED ausente com checksum antigo explícito é elegível e gera token estável", () => {
  const input = state();
  const assessment = assessChecksumReconciliationRequest(input, TARGET);
  const plan = buildReconcileFailedChecksumPlan(input, TARGET);

  assert.equal(assessment.eligible, true);
  assert.deepEqual(assessment.reasons, []);
  assert.equal(plan.migration.oldChecksum, OLD_CHECKSUM);
  assert.equal(plan.migration.newChecksum, NEW_CHECKSUM);
  assert.equal(
    assessment.token,
    computeChecksumReconciliationToken({
      database: input.doctorReport.database,
      migration: input.doctorReport.migrations[2],
      dependencies: input.doctorReport.migrations.slice(0, 2),
      fingerprints: assessment.fingerprints,
      dependenciesFingerprint: assessment.dependenciesFingerprint,
    }),
  );
});

test("bloqueia APPLIED, APPLYING, PENDING e applied_at preenchido", () => {
  const cases = [
    { ledgerState: LEDGER_STATES.APPLIED, ledgerStatus: "APPLIED", checksumMatches: false },
    { ledgerState: LEDGER_STATES.UNKNOWN, ledgerStatus: "APPLYING" },
    { ledgerState: LEDGER_STATES.PENDING, ledgerStatus: null },
    { appliedAt: "2026-08-10T18:00:00.000Z" },
  ];

  for (const overrides of cases)
    assert.equal(assessChecksumReconciliationRequest(state(overrides), TARGET).eligible, false);
});

test("bloqueia estados físicos inseguros e artefatos incompatíveis", () => {
  const cases = [
    { physicalState: PHYSICAL_STATES.PARTIAL },
    { physicalState: PHYSICAL_STATES.INCOMPATIBLE },
    { physicalState: PHYSICAL_STATES.TABLE_OPTION_DRIFT, tableOptionDrift: true },
    { artifactMismatches: [{ code: "INDEX_MISMATCH" }] },
  ];

  for (const overrides of cases) {
    const result = assessChecksumReconciliationRequest(state(overrides), TARGET);
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes("PHYSICAL_STATE_UNSAFE"));
  }
});

test("bloqueia identidade de ledger e dependências inválidas", () => {
  const identity = assessChecksumReconciliationRequest(
    state({ ledgerName: "other_migration" }),
    TARGET,
  );
  const dependencyFailure = assessChecksumReconciliationRequest(
    state({}, { physicalState: PHYSICAL_STATES.PARTIAL }),
    TARGET,
  );

  assert.ok(identity.reasons.includes("LEDGER_IDENTITY_MISMATCH"));
  assert.ok(dependencyFailure.reasons.includes("DEPENDENCY_UNSAFE"));
});

test("WRITE revalida o plano, altera somente o checksum selecionado e preserva FAILED", async () => {
  const before = state();
  const after = state({ checksumMatches: true, ledgerChecksum: NEW_CHECKSUM });
  const token = assessChecksumReconciliationRequest(before, TARGET).token;
  const states = [before, before, after];
  const calls = [];

  const result = await executeChecksumReconciliation({
    stateCollector: async () => states.shift(),
    writeClientFactory: async () => ({
      ledger: {
        async withLock(work) {
          return work();
        },
        async reconcileFailedChecksum(selected, oldChecksum) {
          calls.push({ id: selected.id, oldChecksum, newChecksum: selected.checksum });
        },
      },
      async close() {},
    }),
    context: {},
    migrationId: TARGET,
    confirmationToken: token,
    backupIdentifier: "backup-20260810",
    clock: () => new Date("2026-08-10T19:00:00.000Z"),
  });

  assert.deepEqual(calls, [{ id: TARGET, oldChecksum: OLD_CHECKSUM, newChecksum: NEW_CHECKSUM }]);
  assert.equal(result.postValidation.passed, true);
  assert.equal(result.oldChecksum, OLD_CHECKSUM);
  assert.equal(result.newChecksum, NEW_CHECKSUM);
});

test("WRITE bloqueia mudança de plano e checksum antigo divergente antes da pós-validação", async () => {
  const before = state();
  const changed = state({ ledgerChecksum: "d".repeat(64) });
  const token = assessChecksumReconciliationRequest(before, TARGET).token;
  const states = [before, changed];
  let opened = 0;

  await assert.rejects(
    () =>
      executeChecksumReconciliation({
        stateCollector: async () => states.shift(),
        writeClientFactory: async () => {
          opened += 1;
          return {};
        },
        context: {},
        migrationId: TARGET,
        confirmationToken: token,
        backupIdentifier: "backup-20260810",
      }),
    (error) => error.code === "CHECKSUM_RECONCILIATION_PLAN_CHANGED",
  );

  assert.equal(opened, 0);
});

test("pós-validação rejeita mudança em qualquer ledger não selecionado", async () => {
  const before = state();
  const after = state(
    { checksumMatches: true, ledgerChecksum: NEW_CHECKSUM },
    { ledgerChecksum: "d".repeat(64) },
  );
  const token = assessChecksumReconciliationRequest(before, TARGET).token;
  const states = [before, before, after];

  await assert.rejects(
    () =>
      executeChecksumReconciliation({
        stateCollector: async () => states.shift(),
        writeClientFactory: async () => ({
          ledger: {
            async withLock(work) {
              return work();
            },
            async reconcileFailedChecksum() {},
          },
          async close() {},
        }),
        context: {},
        migrationId: TARGET,
        confirmationToken: token,
        backupIdentifier: "backup-20260810",
      }),
    (error) => error.code === "CHECKSUM_RECONCILIATION_POST_VALIDATION_FAILED",
  );
});

test("dry-run cria plano sem mutar o estado observado", () => {
  const input = state();
  const before = JSON.stringify(input);

  const plan = buildReconcileFailedChecksumPlan(input, TARGET);

  assert.equal(plan.writesPerformed, false);
  assert.equal(JSON.stringify(input), before);
});

test("CLI usa dry-run por padrão e exige token e backup exclusivos no WRITE", () => {
  assert.equal(parseArguments(["reconcile-failed-checksum", `--migration=${TARGET}`]).dryRun, true);
  assert.throws(
    () => parseArguments(["reconcile-failed-checksum", "--write", `--migration=${TARGET}`]),
    (error) => error.code === "MIGRATION_MANAGER_USAGE",
  );
  assert.throws(
    () =>
      parseArguments([
        "reconcile-failed-checksum",
        "--write",
        `--migration=${TARGET}`,
        "--confirm-checksum-reconcile=token",
      ]),
    (error) => error.code === "MIGRATION_MANAGER_USAGE",
  );
});
