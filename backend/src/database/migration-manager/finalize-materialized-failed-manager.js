"use strict";

const { createHash } = require("node:crypto");
const { LEDGER_STATES, PHYSICAL_STATES } = require("../j12-doctor/constants");
const { assessManifest } = require("../j12-doctor/checks/schema-manifest-check");
const { draftChainManifests } = require("../j12-doctor/manifests/draft-chain.manifests");
const { materializedFinalizeError } = require("./finalize-materialized-failed-errors");

const MATERIALIZED_FINALIZE_TOKEN_VERSION = "finalize-materialized-failed-v1";
const MAX_LEDGER_ERROR_MESSAGE_LENGTH = 1000;

function buildFinalizeMaterializedFailedPlan(state, migrationId, options) {
  const assessment = assessMaterializedFinalizeRequest(state, migrationId, options);
  return {
    command: "finalize-materialized-failed",
    mode: "DRY_RUN",
    dryRun: true,
    writesPerformed: false,
    valid: assessment.eligible,
    eligible: assessment.eligible,
    reasons: assessment.reasons,
    database: state.doctorReport.database,
    migration: describeMigration(assessment),
    structuralValidation: describeStructuralValidation(assessment.structural),
    confirmation: {
      algorithm: "SHA-256",
      tokenVersion: MATERIALIZED_FINALIZE_TOKEN_VERSION,
      expectedToken: assessment.token,
      requiredBackupFlag: "--confirm-backup=<IDENTIFICADOR>",
    },
  };
}

function assessMaterializedFinalizeRequest(state, migrationId, { manifestResolver } = {}) {
  if (!migrationId)
    throw materializedFinalizeError(
      "finalize-materialized-failed requires --migration.",
      "MATERIALIZED_FINALIZE_MIGRATION_REQUIRED",
    );

  const migrations = state.doctorReport?.migrations || [];
  const byId = new Map(migrations.map((migration) => [migration.id, migration]));
  const migration = byId.get(migrationId);
  if (!migration)
    throw materializedFinalizeError(
      `Migration ${migrationId} is outside the canonical catalog.`,
      "MATERIALIZED_FINALIZE_MIGRATION_NOT_FOUND",
    );

  const resolveManifest = manifestResolver || getFullMaterializedManifest;
  const structural = buildStructuralProof(state.doctorReport, migration, resolveManifest);
  const dependencies = (migration.dependencies || []).map((id) => byId.get(id)).filter(Boolean);
  const missingDependencies = (migration.dependencies || []).filter((id) => !byId.has(id));
  const dependents = migrations.filter((candidate) =>
    (candidate.dependencies || []).includes(migration.id),
  );
  const reasons = [];

  if (migration.ledgerState !== LEDGER_STATES.UNKNOWN) reasons.push("LEDGER_STATE_NOT_FAILED");
  if (migration.ledgerStatus !== "FAILED") reasons.push("LEDGER_STATUS_NOT_FAILED");
  if (migration.appliedAt) reasons.push("MIGRATION_HAS_APPLIED_AT");
  if (migration.checksumMatches !== true) reasons.push("CHECKSUM_MISMATCH");
  if (!migration.ledgerChecksum) reasons.push("LEDGER_CHECKSUM_UNAVAILABLE");
  if (migration.ledgerName !== migration.name || migration.ledgerTimestamp !== migration.timestamp)
    reasons.push("LEDGER_IDENTITY_MISMATCH");
  if (!migration.failureEvidenceFingerprint) reasons.push("FAILURE_EVIDENCE_UNAVAILABLE");
  if (migration.physicalState !== PHYSICAL_STATES.PRESENT)
    reasons.push("PHYSICAL_STATE_NOT_PRESENT");
  if (migration.structuralDrift === true) reasons.push("STRUCTURAL_DRIFT_DETECTED");
  if (migration.tableOptionDrift === true || (migration.tableOptionDifferences || []).length > 0)
    reasons.push("TABLE_OPTION_MISMATCH");
  if (
    (migration.artifactMismatches || []).length > 0 ||
    (migration.requiredArtifactsMissing || []).length > 0
  )
    reasons.push("ARTIFACT_MISMATCH");
  if (!structural.available) reasons.push("FULL_MANIFEST_UNAVAILABLE");
  if (!isCompleteStructuralProof(structural)) reasons.push("STRUCTURAL_PROOF_INCOMPLETE");
  if (missingDependencies.length) reasons.push("DEPENDENCY_MISSING");
  if (dependencies.some(isUnsafeAppliedDependency)) reasons.push("DEPENDENCY_NOT_APPLIED");
  if (dependents.some(isIncompatibleAppliedDependent))
    reasons.push("APPLIED_DEPENDENT_INCOMPATIBLE");

  const token = computeMaterializedFinalizeToken({
    databaseName: state.doctorReport.database?.name,
    migration,
    dependencies,
    dependents,
    structural,
  });
  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    migration,
    dependencies,
    dependents,
    structural,
    token,
  };
}

function getFullMaterializedManifest(migrationId) {
  return draftChainManifests.find((manifest) => manifest.migrationId === migrationId) || null;
}

function buildStructuralProof(doctorReport, migration, manifestResolver) {
  const manifest = manifestResolver(migration.id);
  const schema = doctorReport?.schemaSnapshot;
  if (!manifest || !schema?.tables)
    return {
      available: false,
      manifest: null,
      assessment: null,
      manifestFingerprint: null,
      physicalFingerprint: null,
    };
  const actualTables = Object.fromEntries(
    (manifest.tables || []).map((table) => [table.name, schema.tables[table.name] || null]),
  );
  return {
    available: true,
    manifest,
    assessment: assessManifest(schema, manifest),
    manifestFingerprint: fingerprint(manifest),
    physicalFingerprint: fingerprint(actualTables),
  };
}

function isCompleteStructuralProof(structural) {
  const assessment = structural.assessment;
  return Boolean(
    structural.available &&
    assessment?.physicalState === PHYSICAL_STATES.PRESENT &&
    assessment.structurallyPresent === true &&
    assessment.expectedCount === assessment.presentCount &&
    assessment.mismatchCount === 0 &&
    assessment.structuralMismatchCount === 0 &&
    assessment.tableOptionMismatchCount === 0 &&
    assessment.requiredArtifactsMissing.length === 0 &&
    assessment.artifactMismatches.length === 0 &&
    assessment.tableOptionDifferences.length === 0,
  );
}

function isUnsafeAppliedDependency(dependency) {
  return (
    dependency.ledgerState !== LEDGER_STATES.APPLIED ||
    dependency.ledgerStatus !== "APPLIED" ||
    dependency.checksumMatches !== true ||
    dependency.manifestAvailable !== true ||
    dependency.physicalState !== PHYSICAL_STATES.PRESENT ||
    dependency.structuralDrift === true ||
    dependency.tableOptionDrift === true
  );
}

function isIncompatibleAppliedDependent(dependent) {
  return (
    dependent.ledgerState === LEDGER_STATES.APPLIED &&
    (dependent.ledgerStatus !== "APPLIED" ||
      dependent.checksumMatches !== true ||
      dependent.physicalState !== PHYSICAL_STATES.PRESENT ||
      dependent.structuralDrift === true ||
      dependent.tableOptionDrift === true)
  );
}

function computeMaterializedFinalizeToken({
  databaseName,
  migration,
  dependencies = [],
  dependents = [],
  structural,
}) {
  return fingerprint({
    version: MATERIALIZED_FINALIZE_TOKEN_VERSION,
    databaseName: databaseName || null,
    migration: {
      id: migration.id,
      timestamp: migration.timestamp,
      name: migration.name,
      checksum: migration.checksum,
      ledgerChecksum: migration.ledgerChecksum || null,
      ledgerStatus: migration.ledgerStatus,
      appliedAt: migration.appliedAt || null,
      physicalState: migration.physicalState,
      failureEvidenceFingerprint: migration.failureEvidenceFingerprint || null,
    },
    structural: {
      available: structural.available,
      assessment: structural.assessment,
      manifestFingerprint: structural.manifestFingerprint,
      physicalFingerprint: structural.physicalFingerprint,
    },
    dependencies: dependencies.map(describeLedgerState).sort(sortById),
    dependents: dependents.map(describeLedgerState).sort(sortById),
  });
}

async function executeMaterializedFinalize({
  stateCollector,
  writeClientFactory,
  context,
  migrationId,
  confirmationToken,
  backupIdentifier,
  clock = () => new Date(),
  manifestResolver,
}) {
  if (!backupIdentifier)
    throw materializedFinalizeError(
      "finalize-materialized-failed --write requires --confirm-backup.",
      "MATERIALIZED_FINALIZE_BACKUP_REQUIRED",
    );
  const options = { manifestResolver };
  const initialState = await stateCollector(context);
  const initial = assessMaterializedFinalizeRequest(initialState, migrationId, options);
  assertEligible(initial);
  assertToken(initial.token, confirmationToken);

  const immediateState = await stateCollector(context);
  const immediate = assessMaterializedFinalizeRequest(immediateState, migrationId, options);
  assertEligible(immediate);
  assertSameToken(initial.token, immediate.token);
  assertToken(immediate.token, confirmationToken);

  const client = await writeClientFactory();
  try {
    assertWriteClient(client);
    return await client.ledger.withLock(() =>
      client.ledger.withTransaction(async () => {
        const lockedContext = {
          ...context,
          reader: { query: (sql, params) => client.ledger.queryReadOnly(sql, params) },
        };
        const lockedBeforeState = await stateCollector(lockedContext);
        const locked = assessMaterializedFinalizeRequest(lockedBeforeState, migrationId, options);
        assertEligible(locked);
        assertSameToken(immediate.token, locked.token);
        assertToken(locked.token, confirmationToken);

        const failureRecord = await client.ledger.readMaterializedFailedRecord(locked.migration);
        assertFailureRecord(locked.migration, failureRecord);
        const appliedAt = clock();
        const auditEvidence = buildAuditEvidence({
          backupIdentifier,
          failureRecord,
          finalizedAt: appliedAt,
        });
        try {
          await client.ledger.finalizeMaterializedFailed(locked.migration, {
            appliedAt,
            auditEvidence,
          });
        } catch (error) {
          if (error?.code === "MIGRATION_LEDGER_MATERIALIZED_FINALIZE_REJECTED")
            throw materializedFinalizeError(
              "The conditioned materialized-finalization update was rejected.",
              "MATERIALIZED_FINALIZE_UPDATE_REJECTED",
            );
          throw error;
        }

        const lockedAfterState = await stateCollector(lockedContext);
        const finalizedRecord = await client.ledger.readMaterializedFailedRecord(locked.migration);
        const postValidation = validateMaterializedFinalizePostState({
          beforeState: lockedBeforeState,
          afterState: lockedAfterState,
          assessment: locked,
          failureRecord,
          finalizedRecord,
          appliedAt,
          auditEvidence,
          manifestResolver,
        });
        if (!postValidation.passed)
          throw materializedFinalizeError(
            `Post-finalization validation failed; transaction was rolled back (${postValidationReasons(postValidation).join(", ")}).`,
            "MATERIALIZED_FINALIZE_POST_VALIDATION_FAILED",
            { ...postValidation, reasons: postValidationReasons(postValidation) },
          );
        return {
          command: "finalize-materialized-failed",
          mode: "WRITE",
          database: lockedAfterState.doctorReport.database,
          migrationId,
          checksum: locked.migration.checksum,
          backupIdentifier,
          tokenConfirmed: confirmationToken,
          writesPerformed: true,
          timestamp: appliedAt.toISOString(),
          audit: {
            preservedFailedAt: failureRecord.failedAt,
            previousErrorFingerprint: fingerprint(failureRecord.errorMessage || ""),
            finalizationEvidenceStored: true,
          },
          structuralValidation: describeStructuralValidation(locked.structural),
          postValidation,
        };
      }),
    );
  } finally {
    await client.close();
  }
}

function assertWriteClient(client) {
  const methods = [
    "withLock",
    "withTransaction",
    "queryReadOnly",
    "readMaterializedFailedRecord",
    "finalizeMaterializedFailed",
  ];
  if (!client?.ledger || methods.some((method) => typeof client.ledger[method] !== "function"))
    throw materializedFinalizeError(
      "Materialized finalization requires the canonical transactional ledger adapter.",
      "MATERIALIZED_FINALIZE_WRITER_INVALID",
    );
}

function assertFailureRecord(migration, record) {
  if (
    record.id !== migration.id ||
    record.timestamp !== migration.timestamp ||
    record.name !== migration.name ||
    record.checksum !== migration.checksum ||
    record.status !== "FAILED" ||
    record.appliedAt != null ||
    !record.failedAt ||
    !record.errorMessage ||
    fingerprintFailureEvidence(record) !== migration.failureEvidenceFingerprint
  )
    throw materializedFinalizeError(
      "Failure evidence changed or is incomplete under the canonical lock.",
      "MATERIALIZED_FINALIZE_STATE_CHANGED",
    );
}

function buildAuditEvidence({ backupIdentifier, failureRecord, finalizedAt }) {
  const evidence = [
    "MATERIALIZED_FINALIZATION",
    `prior_failed_at=${String(failureRecord.failedAt)}`,
    `finalized_at=${finalizedAt.toISOString()}`,
    `backup=${String(backupIdentifier)}`,
    "reason=verified_integral_materialization",
    `prior_error=${failureRecord.errorMessage}`,
  ].join("; ");
  if (evidence.length > MAX_LEDGER_ERROR_MESSAGE_LENGTH)
    throw materializedFinalizeError(
      "Failure evidence is too long to preserve losslessly in the canonical ledger.",
      "MATERIALIZED_FINALIZE_AUDIT_EVIDENCE_TOO_LONG",
    );
  return evidence;
}

function validateMaterializedFinalizePostState({
  beforeState,
  afterState,
  assessment,
  failureRecord,
  finalizedRecord,
  appliedAt,
  auditEvidence,
  manifestResolver,
}) {
  const after = assessMaterializedFinalizeRequest(afterState, assessment.migration.id, {
    manifestResolver,
  });
  const selected = after.migration;
  const checks = {
    selectedLedgerStateApplied: selected?.ledgerState === LEDGER_STATES.APPLIED,
    selectedLedgerStatusApplied: selected?.ledgerStatus === "APPLIED",
    selectedChecksumMatches: selected?.checksumMatches === true,
    selectedAppliedAtRecorded: selected?.appliedAt != null,
    structuralProofStillComplete: isCompleteStructuralProof(after.structural),
    selectedPhysicalStatePresent: selected?.physicalState === PHYSICAL_STATES.PRESENT,
    failedAtPreserved: timestampsEqual(finalizedRecord.failedAt, failureRecord.failedAt),
    startedAtPreserved: timestampsEqual(finalizedRecord.startedAt, failureRecord.startedAt),
    executionMsPreserved: finalizedRecord.executionMs === failureRecord.executionMs,
    originalErrorAudited: finalizedRecord.errorMessage === auditEvidence,
    finalizedRecordApplied: finalizedRecord.status === "APPLIED",
    appliedAtMatches: timestampsEqual(finalizedRecord.appliedAt, appliedAt),
    unselectedLedgerUnchanged:
      ledgerFingerprint(beforeState.doctorReport, assessment.migration.id) ===
      ledgerFingerprint(afterState.doctorReport, assessment.migration.id),
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

function postValidationReasons(postValidation) {
  const codes = {
    selectedLedgerStateApplied: "LEDGER_STATE_NOT_APPLIED",
    selectedLedgerStatusApplied: "LEDGER_STATUS_NOT_APPLIED",
    selectedChecksumMatches: "CHECKSUM_NOT_CONFIRMED",
    selectedAppliedAtRecorded: "APPLIED_AT_MISSING",
    structuralProofStillComplete: "STRUCTURAL_PROOF_INCOMPLETE",
    selectedPhysicalStatePresent: "PHYSICAL_STATE_NOT_PRESENT",
    failedAtPreserved: "FAILED_AT_MISMATCH",
    startedAtPreserved: "STARTED_AT_MISMATCH",
    executionMsPreserved: "EXECUTION_MS_MISMATCH",
    originalErrorAudited: "AUDIT_EVIDENCE_MISMATCH",
    finalizedRecordApplied: "FINALIZED_RECORD_STATUS_NOT_APPLIED",
    appliedAtMatches: "APPLIED_AT_MISMATCH",
    unselectedLedgerUnchanged: "UNSELECTED_LEDGER_CHANGED",
  };
  return Object.entries(postValidation.checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => codes[name] || name);
}

function timestampsEqual(left, right) {
  if (left === right) return true;
  if (left == null || right == null) return false;
  const leftTime = left instanceof Date ? left.getTime() : new Date(left).getTime();
  const rightTime = right instanceof Date ? right.getTime() : new Date(right).getTime();
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime === rightTime;
  return String(left) === String(right);
}

function assertEligible(assessment) {
  if (!assessment.eligible)
    throw materializedFinalizeError(
      "The selected migration is not eligible for materialized finalization.",
      "MATERIALIZED_FINALIZE_NOT_ELIGIBLE",
      { reasons: assessment.reasons },
    );
}

function assertToken(expected, supplied) {
  if (!supplied || supplied !== expected)
    throw materializedFinalizeError(
      "Materialized finalization confirmation token does not match the current plan.",
      "MATERIALIZED_FINALIZE_TOKEN_MISMATCH",
    );
}

function assertSameToken(expected, actual) {
  if (expected !== actual)
    throw materializedFinalizeError(
      "Materialized finalization state changed during locked revalidation.",
      "MATERIALIZED_FINALIZE_STATE_CHANGED",
    );
}

function describeMigration(assessment) {
  const migration = assessment.migration;
  return {
    id: migration.id,
    timestamp: migration.timestamp,
    name: migration.name,
    fileName: migration.fileName,
    catalogChecksum: migration.checksum,
    ledgerChecksum: migration.ledgerChecksum || null,
    ledgerStatus: migration.ledgerStatus,
    appliedAt: migration.appliedAt || null,
    physicalState: migration.physicalState,
    dependencies: migration.dependencies || [],
    failureEvidenceFingerprint: migration.failureEvidenceFingerprint || null,
  };
}

function describeStructuralValidation(structural) {
  const assessment = structural.assessment;
  return {
    available: structural.available,
    physicalState: assessment?.physicalState || null,
    expectedArtifacts: assessment?.expectedCount ?? 0,
    foundArtifacts: assessment?.presentCount ?? 0,
    mismatches: assessment?.mismatchCount ?? 0,
    structuralMismatches: assessment?.structuralMismatchCount ?? 0,
    tableOptionMismatches: assessment?.tableOptionMismatchCount ?? 0,
    manifestFingerprint: structural.manifestFingerprint,
    physicalFingerprint: structural.physicalFingerprint,
  };
}

function describeLedgerState(migration) {
  return {
    id: migration.id,
    checksum: migration.checksum,
    ledgerChecksum: migration.ledgerChecksum || null,
    ledgerState: migration.ledgerState,
    ledgerStatus: migration.ledgerStatus,
    checksumMatches: migration.checksumMatches,
    appliedAt: migration.appliedAt || null,
    physicalState: migration.physicalState,
    structuralDrift: migration.structuralDrift === true,
    tableOptionDrift: migration.tableOptionDrift === true,
  };
}

function ledgerFingerprint(doctorReport, selectedMigrationId) {
  return fingerprint(
    (doctorReport.migrations || [])
      .filter((migration) => migration.id !== selectedMigrationId)
      .map((migration) => ({
        ...describeLedgerState(migration),
        failureEvidenceFingerprint: migration.failureEvidenceFingerprint || null,
      }))
      .sort(sortById),
  );
}

function fingerprintFailureEvidence(record) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        failedAt: record.failedAt || null,
        errorMessage: record.errorMessage || null,
      }),
      "utf8",
    )
    .digest("hex");
}

function fingerprint(value) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)), "utf8")
    .digest("hex");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
}

function sortById(left, right) {
  return left.id.localeCompare(right.id);
}

module.exports = {
  MATERIALIZED_FINALIZE_TOKEN_VERSION,
  assessMaterializedFinalizeRequest,
  buildAuditEvidence,
  buildFinalizeMaterializedFailedPlan,
  computeMaterializedFinalizeToken,
  executeMaterializedFinalize,
  getFullMaterializedManifest,
  isCompleteStructuralProof,
  postValidationReasons,
  timestampsEqual,
  validateMaterializedFinalizePostState,
};
