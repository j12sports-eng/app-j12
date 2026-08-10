"use strict";

const { createHash } = require("node:crypto");
const { LEDGER_STATES, PHYSICAL_STATES } = require("../j12-doctor/constants");
const { retryFailedError } = require("./retry-failed-errors");

const RETRY_FAILED_TOKEN_VERSION = "retry-failed-v1";

function buildRetryFailedPlan(state, migrationId) {
  const assessment = assessRetryFailedRequest(state, migrationId);

  return {
    command: "retry-failed",
    mode: "DRY_RUN",
    dryRun: true,
    writesPerformed: false,
    valid: assessment.eligible,
    eligible: assessment.eligible,
    reasons: assessment.reasons,
    database: state.doctorReport.database,
    migration: {
      id: assessment.migration.id,
      fileName: assessment.migration.fileName,
      checksum: assessment.migration.checksum,
      dependencies: assessment.migration.dependencies || [],
      ledgerState: assessment.migration.ledgerState,
      ledgerStatus: assessment.migration.ledgerStatus,
      checksumMatches: assessment.migration.checksumMatches,
      appliedAt: assessment.migration.appliedAt || null,
      physicalState: assessment.migration.physicalState,
    },
    confirmation: {
      algorithm: "SHA-256",
      tokenVersion: RETRY_FAILED_TOKEN_VERSION,
      expectedToken: assessment.token,
      requiredBackupFlag: "--confirm-backup=<IDENTIFICADOR>",
    },
  };
}

function assessRetryFailedRequest(state, migrationId) {
  if (!migrationId) {
    throw retryFailedError("retry-failed requires --migration.", "RETRY_FAILED_MIGRATION_REQUIRED");
  }

  const migrations = state.doctorReport.migrations || [];
  const byId = new Map(migrations.map((migration) => [migration.id, migration]));

  const migration = byId.get(migrationId);

  if (!migration) {
    throw retryFailedError(
      `Migration ${migrationId} is outside the canonical catalog.`,
      "RETRY_FAILED_MIGRATION_NOT_FOUND",
    );
  }

  const reasons = [];

  if (migration.ledgerState !== LEDGER_STATES.UNKNOWN) {
    reasons.push("LEDGER_STATE_NOT_UNKNOWN");
  }

  if (migration.ledgerStatus !== "FAILED") {
    reasons.push("LEDGER_STATUS_NOT_FAILED");
  }

  if (migration.checksumMatches !== true) {
    reasons.push("CHECKSUM_NOT_CONFIRMED");
  }

  if (migration.appliedAt) {
    reasons.push("MIGRATION_HAS_APPLIED_AT");
  }

  if (migration.manifestAvailable !== true) {
    reasons.push("MIGRATION_MANIFEST_UNAVAILABLE");
  }

  if (migration.physicalState !== PHYSICAL_STATES.ABSENT) {
    reasons.push("PHYSICAL_STATE_NOT_ABSENT");
  }

  // The Doctor marks expected missing artifacts as structuralDrift. For a fully absent
  // FAILED migration, that is the expected evidence that no partial application remains.
  // Continue to fail closed for any present/partial state, table-option difference, or
  // incompatible artifact reported independently by the manifest assessment.
  if (hasUnsafeRetryPhysicalEvidence(migration)) {
    reasons.push("PHYSICAL_STATE_UNSAFE");
  }

  const dependencies = (migration.dependencies || []).map((id) => byId.get(id)).filter(Boolean);

  const missingDependencies = (migration.dependencies || []).filter((id) => !byId.has(id));

  if (missingDependencies.length) {
    reasons.push("DEPENDENCY_MISSING");
  }

  const invalidDependencies = dependencies.filter(
    (dependency) =>
      dependency.ledgerState !== LEDGER_STATES.APPLIED ||
      dependency.ledgerStatus !== "APPLIED" ||
      dependency.checksumMatches !== true,
  );

  if (invalidDependencies.length) {
    reasons.push("DEPENDENCY_NOT_APPLIED");
  }

  if (
    dependencies.some(
      (dependency) =>
        dependency.manifestAvailable !== true ||
        dependency.physicalState !== PHYSICAL_STATES.PRESENT ||
        dependency.structuralDrift === true ||
        dependency.tableOptionDrift === true,
    )
  ) {
    reasons.push("DEPENDENCY_PHYSICAL_STATE_UNSAFE");
  }

  const token = computeRetryFailedToken({
    databaseName: state.doctorReport.database.name,
    migration,
    dependencies,
  });

  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    migration,
    dependencies,
    token,
  };
}

function computeRetryFailedToken({ databaseName, migration, dependencies = [] }) {
  const payload = {
    version: RETRY_FAILED_TOKEN_VERSION,
    databaseName,
    migration: {
      id: migration.id,
      checksum: migration.checksum,
      ledgerState: migration.ledgerState,
      ledgerStatus: migration.ledgerStatus,
      checksumMatches: migration.checksumMatches,
      appliedAt: migration.appliedAt || null,
      physicalState: migration.physicalState,
    },
    dependencies: [...dependencies]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((dependency) => ({
        id: dependency.id,
        checksum: dependency.checksum,
        ledgerState: dependency.ledgerState,
        ledgerStatus: dependency.ledgerStatus,
        checksumMatches: dependency.checksumMatches,
        appliedAt: dependency.appliedAt || null,
        physicalState: dependency.physicalState,
      })),
  };

  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

function hasUnsafeRetryPhysicalEvidence(migration) {
  if (migration.physicalState !== PHYSICAL_STATES.ABSENT) return true;
  if (migration.tableOptionDrift === true) return true;
  return Array.isArray(migration.artifactMismatches) && migration.artifactMismatches.length > 0;
}

async function executeRetryFailed({
  stateCollector,
  writeClientFactory,
  context,
  migrationId,
  confirmationToken,
  backupIdentifier,
  clock = () => new Date(),
}) {
  if (!backupIdentifier)
    throw retryFailedError(
      "retry-failed --write requires --confirm-backup.",
      "RETRY_FAILED_BACKUP_REQUIRED",
    );

  const initialState = await stateCollector(context);
  const initial = assessRetryFailedRequest(initialState, migrationId);
  assertEligible(initial);
  assertToken(initial.token, confirmationToken);

  const immediateState = await stateCollector(context);
  const immediate = assessRetryFailedRequest(immediateState, migrationId);
  assertEligible(immediate);
  if (initial.token !== immediate.token)
    throw retryFailedError(
      "The retry-failed plan changed during immediate revalidation.",
      "RETRY_FAILED_PLAN_CHANGED",
    );
  assertToken(immediate.token, confirmationToken);

  const client = await writeClientFactory();
  let runnerResult;
  try {
    runnerResult = await client.runner.retryFailed(migrationId, { dryRun: false });
  } finally {
    await client.close();
  }

  if (
    !Array.isArray(runnerResult?.applied) ||
    runnerResult.applied.length !== 1 ||
    runnerResult.applied[0] !== migrationId
  ) {
    throw retryFailedError(
      "The canonical runner did not retry exactly the selected migration.",
      "RETRY_FAILED_RUNNER_RESULT_INVALID",
    );
  }

  const afterState = await stateCollector(context);
  const postValidation = validateRetryFailedPostState({
    beforeState: immediateState,
    afterState,
    assessment: immediate,
  });
  if (!postValidation.passed)
    throw retryFailedError(
      "Post-retry validation failed; manual intervention is required.",
      "RETRY_FAILED_POST_VALIDATION_FAILED",
      postValidation,
    );

  return {
    command: "retry-failed",
    mode: "WRITE",
    database: afterState.doctorReport.database,
    migrationId,
    checksum: immediate.migration.checksum,
    dependencies: immediate.migration.dependencies,
    backupIdentifier,
    tokenConfirmed: confirmationToken,
    appliedIds: runnerResult.applied,
    writesPerformed: true,
    timestamp: clock().toISOString(),
    postValidation,
  };
}

function assertEligible(assessment) {
  if (!assessment.eligible)
    throw retryFailedError(
      "The selected migration is blocked by the current retry plan.",
      "RETRY_FAILED_BLOCKED",
      { reasons: assessment.reasons },
    );
}

function assertToken(expected, supplied) {
  if (!supplied || supplied !== expected)
    throw retryFailedError(
      "retry-failed confirmation token does not match the current plan.",
      "RETRY_FAILED_CONFIRMATION_MISMATCH",
    );
}

function validateRetryFailedPostState({ beforeState, afterState, assessment }) {
  const migration = afterState.doctorReport.migrations.find(
    (entry) => entry.id === assessment.migration.id,
  );
  const checks = {
    selectedApplied:
      migration?.ledgerState === LEDGER_STATES.APPLIED &&
      migration?.ledgerStatus === "APPLIED" &&
      migration?.checksumMatches === true,
    selectedPhysicalStatePresent: migration?.physicalState === PHYSICAL_STATES.PRESENT,
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
      checksumMatches: migration.checksumMatches,
      ledgerState: migration.ledgerState,
      ledgerStatus: migration.ledgerStatus,
      appliedAt: migration.appliedAt || null,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return createHash("sha256").update(JSON.stringify(snapshot), "utf8").digest("hex");
}

module.exports = {
  RETRY_FAILED_TOKEN_VERSION,
  assessRetryFailedRequest,
  buildRetryFailedPlan,
  computeRetryFailedToken,
  executeRetryFailed,
  hasUnsafeRetryPhysicalEvidence,
  validateRetryFailedPostState,
};
