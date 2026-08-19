"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { LEDGER_STATES, PHYSICAL_STATES } = require("../../j12-doctor/constants");
const {
  assessChecksumReconciliationRequest,
  buildReconcileFailedChecksumPlan,
  executeChecksumReconciliation,
} = require("../reconcile-failed-checksum-manager");
const {
  assessRetryFailedRequest,
  buildRetryFailedPlan,
  executeRetryFailed,
} = require("../retry-failed-manager");

const TARGET = "20260803123000_reconcile_enrollment_multiunit_invariants";
const DEPENDENCY = "20260729210000_add_people_digital_columns";
const NEW_CHECKSUM = "b".repeat(64);
const OLD_CHECKSUM = "a".repeat(64);
const LEGACY_INDEX = "ux_enrollments_active_draft_student_profile";

const reviewedPolicy = Object.freeze({
  reconciliation: true,
  allowedPhysicalStates: [PHYSICAL_STATES.INCOMPATIBLE, PHYSICAL_STATES.PARTIAL],
  reviewedFindingCodes: [
    "COLUMN_MISSING",
    "INDEX_MISSING",
    "INDEX_MISMATCH",
    "FORMAL_PHYSICAL_DRIFT",
  ],
  reviewedIndexMismatches: [
    {
      table: "enrollments",
      name: LEGACY_INDEX,
      unique: true,
      columns: ["active_draft_student_person_id", "active_draft_student_profile_id"],
    },
  ],
  plannedActions: [
    {
      kind: "INDEX",
      table: "enrollments",
      name: LEGACY_INDEX,
      action: "REPLACE_LEGACY_IF_EXACT",
    },
  ],
});

function exactFindingSet() {
  return [
    {
      code: "COLUMN_MISSING",
      details: { migrationId: TARGET, table: "enrollments", column: "active_person_id" },
    },
    {
      code: "INDEX_MISSING",
      details: { migrationId: TARGET, table: "enrollments", index: "ux_active_current" },
    },
    {
      code: "INDEX_MISMATCH",
      details: {
        migrationId: TARGET,
        table: "enrollments",
        index: LEGACY_INDEX,
        actual: {
          unique: true,
          columns: ["active_draft_student_person_id", "active_draft_student_profile_id"],
        },
      },
    },
  ];
}

function targetMigration(overrides = {}) {
  return {
    id: TARGET,
    timestamp: "20260803123000",
    name: "reconcile_enrollment_multiunit_invariants",
    fileName: TARGET + ".js",
    checksum: NEW_CHECKSUM,
    ledgerChecksum: OLD_CHECKSUM,
    ledgerName: "reconcile_enrollment_multiunit_invariants",
    ledgerTimestamp: "20260803123000",
    dependencies: [DEPENDENCY],
    ledgerState: LEDGER_STATES.UNKNOWN,
    ledgerStatus: "FAILED",
    checksumMatches: false,
    appliedAt: null,
    manifestAvailable: true,
    physicalState: PHYSICAL_STATES.INCOMPATIBLE,
    structuralDrift: true,
    tableOptionDrift: false,
    tableOptionDifferences: [],
    requiredArtifactsMissing: [
      { code: "COLUMN_MISSING", table: "enrollments", column: "active_person_id" },
      { code: "INDEX_MISSING", table: "enrollments", index: "ux_active_current" },
    ],
    artifactMismatches: [
      {
        code: "INDEX_MISMATCH",
        table: "enrollments",
        index: LEGACY_INDEX,
        actual: {
          unique: true,
          columns: ["active_draft_student_person_id", "active_draft_student_profile_id"],
        },
      },
    ],
    applyPolicy: reviewedPolicy,
    ...overrides,
  };
}

function dependency(overrides = {}) {
  return {
    id: DEPENDENCY,
    checksum: "c".repeat(64),
    ledgerChecksum: "c".repeat(64),
    ledgerState: LEDGER_STATES.APPLIED,
    ledgerStatus: "APPLIED",
    checksumMatches: true,
    appliedAt: "2026-08-01T12:00:00.000Z",
    manifestAvailable: true,
    physicalState: PHYSICAL_STATES.PRESENT,
    structuralDrift: false,
    tableOptionDrift: false,
    ...overrides,
  };
}

function reconciliationState({
  targetOverrides = {},
  dependencyOverrides = {},
  findings = exactFindingSet(),
} = {}) {
  return {
    doctorReport: {
      database: { host: "db.example.test", name: "j12", remote: true },
      migrations: [dependency(dependencyOverrides), targetMigration(targetOverrides)],
      findings,
      expectedSchema: [{ migrationId: TARGET, requiredTables: ["enrollments"] }],
      schemaSnapshot: {
        tables: {
          enrollments: {
            columns: {
              person_id: { columnType: "bigint", nullable: false },
              profile_id: { columnType: "bigint", nullable: false },
            },
            indexes: {
              [LEGACY_INDEX]: {
                unique: true,
                columns: ["active_draft_student_person_id", "active_draft_student_profile_id"],
              },
            },
          },
        },
      },
    },
  };
}

function retryState(options = {}) {
  const state = reconciliationState(options);
  Object.assign(selected(state), {
    ledgerChecksum: NEW_CHECKSUM,
    checksumMatches: true,
  });
  return state;
}

function selected(state) {
  return state.doctorReport.migrations.find((migration) => migration.id === TARGET);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalFailedState({ checksumMatches }) {
  return reconciliationState({
    targetOverrides: { applyPolicy: null, checksumMatches, ledgerChecksum: NEW_CHECKSUM },
  });
}

test("A/K normal FAILED com drift permanece bloqueada nos dois fluxos", async () => {
  const reconcileState = normalFailedState({ checksumMatches: false });
  const retryInput = normalFailedState({ checksumMatches: true });
  const reconcile = assessChecksumReconciliationRequest(reconcileState, TARGET);
  const retry = assessRetryFailedRequest(retryInput, TARGET);

  assert.equal(reconcile.eligible, false);
  assert.ok(reconcile.reasons.includes("PHYSICAL_STATE_NOT_ABSENT"));
  assert.equal(retry.eligible, false);
  assert.ok(retry.reasons.includes("PHYSICAL_STATE_NOT_ABSENT"));

  let writersOpened = 0;
  await assert.rejects(
    () =>
      executeChecksumReconciliation({
        stateCollector: async () => reconcileState,
        writeClientFactory: async () => {
          writersOpened += 1;
          return {};
        },
        context: {},
        migrationId: TARGET,
        confirmationToken: reconcile.token,
        backupIdentifier: "unit-test-only",
      }),
    (error) => error.code === "CHECKSUM_RECONCILIATION_BLOCKED",
  );
  await assert.rejects(
    () =>
      executeRetryFailed({
        stateCollector: async () => retryInput,
        writeClientFactory: async () => {
          writersOpened += 1;
          return {};
        },
        context: {},
        migrationId: TARGET,
        confirmationToken: retry.token,
        backupIdentifier: "unit-test-only",
      }),
    (error) => error.code === "RETRY_FAILED_BLOCKED",
  );
  assert.equal(writersOpened, 0);
});

test("B reconciliação FAILED em DRIFT_DETECTED exato é elegível para checksum", () => {
  const input = reconciliationState();
  const assessment = assessChecksumReconciliationRequest(input, TARGET);
  const plan = buildReconcileFailedChecksumPlan(input, TARGET);
  const changedFailureEvidence = clone(input);
  selected(changedFailureEvidence).failureEvidenceFingerprint = "d".repeat(64);

  assert.equal(assessment.eligible, true);
  assert.deepEqual(assessment.reasons, []);
  assert.equal(plan.confirmation.tokenVersion, "reconcile-failed-checksum-v2");
  for (const value of Object.values(plan.evidence)) assert.match(value, /^[a-f0-9]{64}$/u);
  assert.notEqual(
    assessment.token,
    assessChecksumReconciliationRequest(changedFailureEvidence, TARGET).token,
  );
});

test("C achado estrutural extra não revisado bloqueia a reconciliação", () => {
  const findings = exactFindingSet();
  findings.push({
    code: "FOREIGN_KEY_MISMATCH",
    details: { migrationId: TARGET, table: "enrollments", foreignKey: "fk_unexpected" },
  });
  const assessment = assessChecksumReconciliationRequest(reconciliationState({ findings }), TARGET);

  assert.equal(assessment.eligible, false);
  assert.ok(assessment.reasons.includes("UNREVIEWED_STRUCTURAL_DRIFT"));
});

test("D estado PARTIAL continua bloqueado mesmo quando listado na policy", () => {
  const assessment = assessChecksumReconciliationRequest(
    reconciliationState({ targetOverrides: { physicalState: PHYSICAL_STATES.PARTIAL } }),
    TARGET,
  );

  assert.equal(assessment.eligible, false);
  assert.ok(assessment.reasons.includes("RECONCILIATION_PARTIAL_STATE_UNSAFE"));
});

test("E mismatch físico diferente do revisado bloqueia", () => {
  const input = reconciliationState();
  selected(input).artifactMismatches[0].actual.columns = ["person_id", "unexpected"];
  const assessment = assessChecksumReconciliationRequest(input, TARGET);

  assert.equal(assessment.eligible, false);
  assert.ok(assessment.reasons.includes("UNREVIEWED_ARTIFACT_MISMATCH"));
});

test("F checksum reconciliation altera somente o checksum lógico e preserva o físico", async () => {
  const before = reconciliationState();
  const after = clone(before);
  selected(after).ledgerChecksum = NEW_CHECKSUM;
  selected(after).checksumMatches = true;
  const assessment = assessChecksumReconciliationRequest(before, TARGET);
  const states = [before, before, after];
  const calls = [];

  const result = await executeChecksumReconciliation({
    stateCollector: async () => states.shift(),
    writeClientFactory: async () => ({
      ledger: {
        async withLock(work) {
          return work();
        },
        async reconcileFailedChecksum(migration, oldChecksum) {
          calls.push({ id: migration.id, oldChecksum, newChecksum: migration.checksum });
        },
      },
      async close() {},
    }),
    context: {},
    migrationId: TARGET,
    confirmationToken: assessment.token,
    backupIdentifier: "unit-test-only",
  });

  assert.deepEqual(calls, [{ id: TARGET, oldChecksum: OLD_CHECKSUM, newChecksum: NEW_CHECKSUM }]);
  assert.equal(result.postValidation.passed, true);
  assert.equal(result.postValidation.checks.selectedPhysicalFingerprintUnchanged, true);
  assert.deepEqual(after.doctorReport.schemaSnapshot, before.doctorReport.schemaSnapshot);
});

test("G retry aceita o estado reconciliado exato e bloqueia evidência extra", () => {
  const exact = retryState();
  const eligible = assessRetryFailedRequest(exact, TARGET);
  const plan = buildRetryFailedPlan(exact, TARGET);
  const changed = clone(exact);
  changed.doctorReport.findings.push({
    code: "FOREIGN_KEY_MISMATCH",
    details: { migrationId: TARGET, table: "enrollments", foreignKey: "fk_unexpected" },
  });

  assert.equal(eligible.eligible, true);
  assert.equal(plan.confirmation.tokenVersion, "retry-failed-v2");
  assert.equal(assessRetryFailedRequest(changed, TARGET).eligible, false);
});

test("H mudança nos achados invalida a revalidação de checksum e retry", async () => {
  const beforeChecksum = reconciliationState();
  const changedChecksum = clone(beforeChecksum);
  changedChecksum.doctorReport.findings.push({
    code: "FORMAL_PHYSICAL_DRIFT",
    details: { migrationId: TARGET, evidence: "changed" },
  });
  const beforeRetry = retryState();
  const changedRetry = clone(beforeRetry);
  changedRetry.doctorReport.findings.push({
    code: "FORMAL_PHYSICAL_DRIFT",
    details: { migrationId: TARGET, evidence: "changed" },
  });
  const checksumStates = [beforeChecksum, changedChecksum];
  const retryStates = [beforeRetry, changedRetry];
  let writersOpened = 0;

  await assert.rejects(
    () =>
      executeChecksumReconciliation({
        stateCollector: async () => checksumStates.shift(),
        writeClientFactory: async () => {
          writersOpened += 1;
          return {};
        },
        context: {},
        migrationId: TARGET,
        confirmationToken: assessChecksumReconciliationRequest(beforeChecksum, TARGET).token,
        backupIdentifier: "unit-test-only",
      }),
    (error) => error.code === "CHECKSUM_RECONCILIATION_PLAN_CHANGED",
  );

  await assert.rejects(
    () =>
      executeRetryFailed({
        stateCollector: async () => retryStates.shift(),
        writeClientFactory: async () => {
          writersOpened += 1;
          return {};
        },
        context: {},
        migrationId: TARGET,
        confirmationToken: assessRetryFailedRequest(beforeRetry, TARGET).token,
        backupIdentifier: "unit-test-only",
      }),
    (error) => error.code === "RETRY_FAILED_PLAN_CHANGED",
  );
  assert.equal(writersOpened, 0);
});

test("I mudança no fingerprint físico invalida a revalidação imediata", async () => {
  const before = reconciliationState();
  const changed = clone(before);
  changed.doctorReport.schemaSnapshot.tables.enrollments.columns.unexpected = {
    columnType: "varchar(10)",
    nullable: true,
  };
  const states = [before, changed];
  let writersOpened = 0;

  await assert.rejects(
    () =>
      executeChecksumReconciliation({
        stateCollector: async () => states.shift(),
        writeClientFactory: async () => {
          writersOpened += 1;
          return {};
        },
        context: {},
        migrationId: TARGET,
        confirmationToken: assessChecksumReconciliationRequest(before, TARGET).token,
        backupIdentifier: "unit-test-only",
      }),
    (error) => error.code === "CHECKSUM_RECONCILIATION_PLAN_CHANGED",
  );
  assert.equal(writersOpened, 0);
});

test("J mudança nas dependências invalida a revalidação imediata", async () => {
  const before = reconciliationState();
  const changed = clone(before);
  const changedDependency = changed.doctorReport.migrations[0];
  changedDependency.checksum = "d".repeat(64);
  changedDependency.ledgerChecksum = "d".repeat(64);
  const states = [before, changed];
  let writersOpened = 0;

  await assert.rejects(
    () =>
      executeChecksumReconciliation({
        stateCollector: async () => states.shift(),
        writeClientFactory: async () => {
          writersOpened += 1;
          return {};
        },
        context: {},
        migrationId: TARGET,
        confirmationToken: assessChecksumReconciliationRequest(before, TARGET).token,
        backupIdentifier: "unit-test-only",
      }),
    (error) => error.code === "CHECKSUM_RECONCILIATION_PLAN_CHANGED",
  );
  assert.equal(writersOpened, 0);
});
