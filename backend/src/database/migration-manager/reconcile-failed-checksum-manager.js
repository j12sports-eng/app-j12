"use strict";

const { createHash } = require("node:crypto");
const { LEDGER_STATES, PHYSICAL_STATES } = require("../j12-doctor/constants");
const { checksumReconciliationError } = require("./reconcile-failed-checksum-errors");
const {
  assessReviewedReconciliationState,
  databaseIdentity,
  dependencyFingerprint,
  recoveryFingerprints,
} = require("./reconciliation-policy");

const CHECKSUM_RECONCILIATION_TOKEN_VERSION = "reconcile-failed-checksum-v2";

function buildReconcileFailedChecksumPlan(state, migrationId) {
  const assessment = assessChecksumReconciliationRequest(state, migrationId);

  return {
    command: "reconcile-failed-checksum",
    mode: "DRY_RUN",
    dryRun: true,
    writesPerformed: false,
    valid: assessment.eligible,
    eligible: assessment.eligible,
    reasons: assessment.reasons,
    database: state.doctorReport.database,
    migration: describeMigration(assessment.migration),
    evidence: {
      policyFingerprint: assessment.fingerprints.policy,
      findingsFingerprint: assessment.fingerprints.findings,
      physicalFingerprint: assessment.fingerprints.physical,
      dependenciesFingerprint: assessment.dependenciesFingerprint,
    },
    confirmation: {
      algorithm: "SHA-256",
      tokenVersion: CHECKSUM_RECONCILIATION_TOKEN_VERSION,
      expectedToken: assessment.token,
      requiredBackupFlag: "--confirm-backup=<IDENTIFICADOR>",
    },
  };
}

function assessChecksumReconciliationRequest(state, migrationId) {
  if (!migrationId)
    throw checksumReconciliationError(
      "reconcile-failed-checksum requires --migration.",
      "CHECKSUM_RECONCILIATION_MIGRATION_REQUIRED",
    );

  const migrations = state.doctorReport.migrations || [];
  const byId = new Map(migrations.map((migration) => [migration.id, migration]));
  const migration = byId.get(migrationId);

  if (!migration)
    throw checksumReconciliationError(
      `Migration ${migrationId} is outside the canonical catalog.`,
      "CHECKSUM_RECONCILIATION_MIGRATION_NOT_FOUND",
    );

  const reasons = [];
  if (migration.ledgerState !== LEDGER_STATES.UNKNOWN) reasons.push("LEDGER_STATE_NOT_FAILED");
  if (migration.ledgerStatus !== "FAILED") reasons.push("LEDGER_STATUS_NOT_FAILED");
  if (migration.checksumMatches !== false) reasons.push("CHECKSUM_RECONCILIATION_NOT_REQUIRED");
  if (!migration.ledgerChecksum) reasons.push("LEDGER_CHECKSUM_UNAVAILABLE");
  if (migration.appliedAt) reasons.push("MIGRATION_HAS_APPLIED_AT");
  if (migration.manifestAvailable !== true) reasons.push("MIGRATION_MANIFEST_UNAVAILABLE");
  const reconciliation =
    migration.applyPolicy?.reconciliation === true
      ? assessReviewedReconciliationState({
          doctorReport: state.doctorReport,
          migration,
          allowPartial: false,
          allowTableOptionDrift: false,
        })
      : null;
  if (reconciliation) reasons.push(...reconciliation.reasons);
  else {
    if (migration.physicalState !== PHYSICAL_STATES.ABSENT)
      reasons.push("PHYSICAL_STATE_NOT_ABSENT");
    if (hasUnsafePhysicalEvidence(migration)) reasons.push("PHYSICAL_STATE_UNSAFE");
  }
  if (migration.ledgerName !== migration.name || migration.ledgerTimestamp !== migration.timestamp)
    reasons.push("LEDGER_IDENTITY_MISMATCH");

  const dependencies = (migration.dependencies || []).map((id) => byId.get(id)).filter(Boolean);
  const missingDependencies = (migration.dependencies || []).filter((id) => !byId.has(id));
  if (missingDependencies.length) reasons.push("DEPENDENCY_MISSING");
  if (
    dependencies.some(
      (dependency) =>
        dependency.ledgerState !== LEDGER_STATES.APPLIED ||
        dependency.ledgerStatus !== "APPLIED" ||
        dependency.checksumMatches !== true ||
        dependency.manifestAvailable !== true ||
        dependency.physicalState !== PHYSICAL_STATES.PRESENT ||
        dependency.structuralDrift === true ||
        dependency.tableOptionDrift === true,
    )
  )
    reasons.push("DEPENDENCY_UNSAFE");

  const fingerprints =
    reconciliation?.fingerprints ||
    recoveryFingerprints({ doctorReport: state.doctorReport, migration });
  const dependenciesFingerprint = dependencyFingerprint(dependencies);
  const token = computeChecksumReconciliationToken({
    database: state.doctorReport.database,
    migration,
    dependencies,
    fingerprints,
    dependenciesFingerprint,
  });

  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    migration,
    dependencies,
    dependenciesFingerprint,
    fingerprints,
    oldChecksum: migration.ledgerChecksum || null,
    token,
  };
}

function hasUnsafePhysicalEvidence(migration) {
  if (migration.physicalState !== PHYSICAL_STATES.ABSENT) return true;
  if (migration.tableOptionDrift === true) return true;
  return Array.isArray(migration.artifactMismatches) && migration.artifactMismatches.length > 0;
}

function computeChecksumReconciliationToken({
  database,
  databaseName,
  migration,
  dependencies = [],
  fingerprints = {},
  dependenciesFingerprint = dependencyFingerprint(dependencies),
}) {
  const payload = {
    version: CHECKSUM_RECONCILIATION_TOKEN_VERSION,
    database: databaseIdentity(database || { name: databaseName }),
    migration: {
      id: migration.id,
      timestamp: migration.timestamp,
      name: migration.name,
      oldChecksum: migration.ledgerChecksum || null,
      newChecksum: migration.checksum,
      ledgerState: migration.ledgerState,
      ledgerStatus: migration.ledgerStatus,
      ledgerName: migration.ledgerName || null,
      ledgerTimestamp: migration.ledgerTimestamp || null,
      appliedAt: migration.appliedAt || null,
      failedAt: migration.failedAt || null,
      failureEvidenceFingerprint: migration.failureEvidenceFingerprint || null,
      physicalState: migration.physicalState,
      policyFingerprint: fingerprints.policy || null,
      findingsFingerprint: fingerprints.findings || null,
      physicalFingerprint: fingerprints.physical || null,
    },
    dependenciesFingerprint,
    dependencies: [...dependencies]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((dependency) => ({
        id: dependency.id,
        checksum: dependency.checksum,
        ledgerChecksum: dependency.ledgerChecksum || null,
        ledgerStatus: dependency.ledgerStatus,
        checksumMatches: dependency.checksumMatches,
        appliedAt: dependency.appliedAt || null,
        physicalState: dependency.physicalState,
      })),
  };
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

async function executeChecksumReconciliation({
  stateCollector,
  writeClientFactory,
  context,
  migrationId,
  confirmationToken,
  backupIdentifier,
  clock = () => new Date(),
}) {
  if (!backupIdentifier)
    throw checksumReconciliationError(
      "reconcile-failed-checksum --write requires --confirm-backup.",
      "CHECKSUM_RECONCILIATION_BACKUP_REQUIRED",
    );

  const initialState = await stateCollector(context);
  const initial = assessChecksumReconciliationRequest(initialState, migrationId);
  assertEligible(initial);
  assertToken(initial.token, confirmationToken);

  const immediateState = await stateCollector(context);
  const immediate = assessChecksumReconciliationRequest(immediateState, migrationId);
  assertEligible(immediate);
  if (initial.token !== immediate.token)
    throw checksumReconciliationError(
      "The checksum reconciliation plan changed during immediate revalidation.",
      "CHECKSUM_RECONCILIATION_PLAN_CHANGED",
    );
  assertToken(immediate.token, confirmationToken);

  const client = await writeClientFactory();
  try {
    assertWriteClient(client);
    await client.ledger.withLock(() =>
      client.ledger.reconcileFailedChecksum(immediate.migration, immediate.oldChecksum),
    );
  } finally {
    await client.close();
  }

  const afterState = await stateCollector(context);
  const postValidation = validateChecksumReconciliationPostState({
    beforeState: immediateState,
    afterState,
    assessment: immediate,
  });
  if (!postValidation.passed)
    throw checksumReconciliationError(
      "Post-reconciliation validation failed; manual intervention is required.",
      "CHECKSUM_RECONCILIATION_POST_VALIDATION_FAILED",
      postValidation,
    );

  return {
    command: "reconcile-failed-checksum",
    mode: "WRITE",
    database: afterState.doctorReport.database,
    migrationId,
    oldChecksum: immediate.oldChecksum,
    newChecksum: immediate.migration.checksum,
    backupIdentifier,
    tokenConfirmed: confirmationToken,
    writesPerformed: true,
    timestamp: clock().toISOString(),
    postValidation,
  };
}

function assertWriteClient(client) {
  if (
    !client?.ledger ||
    typeof client.ledger.withLock !== "function" ||
    typeof client.ledger.reconcileFailedChecksum !== "function"
  )
    throw checksumReconciliationError(
      "Checksum reconciliation requires the canonical ledger adapter.",
      "CHECKSUM_RECONCILIATION_WRITER_INVALID",
    );
}

function assertEligible(assessment) {
  if (!assessment.eligible)
    throw checksumReconciliationError(
      "The selected migration is blocked by the current checksum reconciliation plan.",
      "CHECKSUM_RECONCILIATION_BLOCKED",
      { reasons: assessment.reasons },
    );
}

function assertToken(expected, supplied) {
  if (!supplied || supplied !== expected)
    throw checksumReconciliationError(
      "Checksum reconciliation confirmation token does not match the current plan.",
      "CHECKSUM_RECONCILIATION_CONFIRMATION_MISMATCH",
    );
}

function validateChecksumReconciliationPostState({ beforeState, afterState, assessment }) {
  const migration = afterState.doctorReport.migrations.find(
    (entry) => entry.id === assessment.migration.id,
  );
  const afterDependencies = (migration?.dependencies || [])
    .map((id) => afterState.doctorReport.migrations.find((entry) => entry.id === id))
    .filter(Boolean);
  const afterFingerprints = migration
    ? recoveryFingerprints({ doctorReport: afterState.doctorReport, migration })
    : {};
  const reconciliation = migration?.applyPolicy?.reconciliation
    ? assessReviewedReconciliationState({
        doctorReport: afterState.doctorReport,
        migration,
        allowPartial: false,
        allowTableOptionDrift: false,
      })
    : null;
  const checks = {
    selectedIdentityUnchanged:
      migration?.id === assessment.migration.id &&
      migration?.timestamp === assessment.migration.timestamp &&
      migration?.name === assessment.migration.name,
    selectedStillFailed:
      migration?.ledgerState === LEDGER_STATES.UNKNOWN && migration?.ledgerStatus === "FAILED",
    selectedStillUnapplied: migration?.appliedAt == null,
    selectedChecksumMatches: migration?.checksumMatches === true,
    selectedPhysicalStateSafe: reconciliation
      ? reconciliation.eligible
      : migration?.physicalState === PHYSICAL_STATES.ABSENT &&
        !hasUnsafePhysicalEvidence(migration),
    selectedPolicyFingerprintUnchanged: afterFingerprints.policy === assessment.fingerprints.policy,
    selectedPhysicalFingerprintUnchanged:
      afterFingerprints.physical === assessment.fingerprints.physical,
    dependenciesUnchanged:
      dependencyFingerprint(afterDependencies) === assessment.dependenciesFingerprint,
    unselectedLedgerUnchanged:
      ledgerFingerprint(beforeState.doctorReport, assessment.migration.id) ===
      ledgerFingerprint(afterState.doctorReport, assessment.migration.id),
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

function ledgerFingerprint(doctorReport, selectedMigrationId) {
  const snapshot = (doctorReport.migrations || [])
    .filter((migration) => migration.id !== selectedMigrationId)
    .map((migration) => ({
      id: migration.id,
      checksum: migration.checksum,
      ledgerChecksum: migration.ledgerChecksum || null,
      ledgerStatus: migration.ledgerStatus,
      ledgerState: migration.ledgerState,
      appliedAt: migration.appliedAt || null,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return createHash("sha256").update(JSON.stringify(snapshot), "utf8").digest("hex");
}

function describeMigration(migration) {
  return {
    id: migration.id,
    timestamp: migration.timestamp,
    name: migration.name,
    fileName: migration.fileName,
    oldChecksum: migration.ledgerChecksum || null,
    newChecksum: migration.checksum,
    dependencies: migration.dependencies || [],
    ledgerStatus: migration.ledgerStatus,
    appliedAt: migration.appliedAt || null,
    physicalState: migration.physicalState,
  };
}

module.exports = {
  CHECKSUM_RECONCILIATION_TOKEN_VERSION,
  assessChecksumReconciliationRequest,
  buildReconcileFailedChecksumPlan,
  computeChecksumReconciliationToken,
  executeChecksumReconciliation,
  hasUnsafePhysicalEvidence,
  validateChecksumReconciliationPostState,
};
