"use strict";

const { createHash } = require("node:crypto");
const { LEDGER_STATES, PHYSICAL_STATES } = require("../j12-doctor/constants");
const { LEGACY_TABLES } = require("../j12-doctor/doctor");
const { applyOneError } = require("./apply-one-errors");
const { APPLY_ONE_TOKEN_VERSION, computeApplyOneToken } = require("./apply-one-token");
const { analyzeDuplicateMigrations } = require("./duplicate-manager");
const { evaluateTableOptionAdoption } = require("./baseline-adoption-policy");
const {
  assessReviewedReconciliationState,
  isReviewedReconciliationFinding,
} = require("./reconciliation-policy");

function buildApplyOnePlan(state, migrationId) {
  const assessment = assessApplyOneRequest(state, migrationId);
  return {
    command: "apply-one",
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
      dependencies: assessment.migration.dependencies,
      ledgerState: assessment.migration.ledgerState,
      physicalState: assessment.migration.physicalState,
    },
    actions: assessment.actions,
    risk: assessment.risk,
    operationalPreflight: assessment.operationalPreflight,
    confirmation: {
      algorithm: "SHA-256",
      tokenVersion: APPLY_ONE_TOKEN_VERSION,
      expectedToken: assessment.token,
      requiredBackupFlag: "--confirm-backup=<IDENTIFICADOR>",
      requiredTableList: assessment.requiresTableConfirmation ? assessment.affectedTables : [],
      requiredTableFlag: assessment.requiresTableConfirmation
        ? `--confirm-tables=${assessment.affectedTables.join(",")}`
        : null,
    },
  };
}

function assessApplyOneRequest(state, migrationId) {
  if (!migrationId)
    throw applyOneError("apply-one requires --migration.", "APPLY_ONE_MIGRATION_REQUIRED");
  const migrations = state.doctorReport.migrations || [];
  const byId = new Map(migrations.map((migration) => [migration.id, migration]));
  const migration = byId.get(migrationId);
  if (!migration)
    throw applyOneError(
      `Migration ${migrationId} is outside the canonical catalog.`,
      "APPLY_ONE_MIGRATION_NOT_FOUND",
    );

  const reasons = [];
  if (migration.ledgerState === LEDGER_STATES.APPLIED) reasons.push("MIGRATION_ALREADY_APPLIED");
  else if (migration.ledgerState !== LEDGER_STATES.PENDING)
    reasons.push("LEDGER_STATE_NOT_PENDING");
  if (migration.checksumMatches === false) reasons.push("CHECKSUM_MISMATCH");
  if (!migration.manifestAvailable || migration.physicalState === PHYSICAL_STATES.NOT_ASSESSED)
    reasons.push("MIGRATION_UNKNOWN");

  const dependencies = (migration.dependencies || []).map((id) => byId.get(id)).filter(Boolean);
  const missingDependencies = (migration.dependencies || []).filter((id) => !byId.has(id));
  if (missingDependencies.length) reasons.push("DEPENDENCY_MISSING");
  const unappliedDependencies = dependencies.filter(
    (dependency) =>
      dependency.ledgerState !== LEDGER_STATES.APPLIED || dependency.checksumMatches !== true,
  );
  if (unappliedDependencies.length) reasons.push("DEPENDENCY_NOT_APPLIED");
  if (
    dependencies.some((dependency) => {
      const driftObserved =
        dependency.structuralDrift === true ||
        [
          PHYSICAL_STATES.PARTIAL,
          PHYSICAL_STATES.INCOMPATIBLE,
          PHYSICAL_STATES.NOT_ASSESSED,
        ].includes(dependency.physicalState);
      if (!driftObserved) return false;
      const adoption = evaluateTableOptionAdoption({
        migration: dependency,
        findings: (state.doctorReport.findings || []).filter(
          (finding) => finding.details?.migrationId === dependency.id,
        ),
        catalogMigrations: state.doctorReport.migrations || [],
        schemaSnapshot: state.doctorReport.schemaSnapshot,
      });
      return !adoption.accepted;
    })
  )
    reasons.push("DEPENDENCY_STRUCTURAL_DRIFT");

  const duplicateAnalysis = analyzeDuplicateMigrations(state.doctorReport);
  if (duplicateAnalysis.ambiguousMigrationIds.has(migration.id))
    reasons.push("AMBIGUOUS_MIGRATION_OWNERSHIP");

  const policy = migration.applyPolicy;
  if (policy?.reconciliation) {
    const reconciliation = assessReviewedReconciliationState({
      doctorReport: state.doctorReport,
      migration,
      allowPartial: true,
    });
    reasons.push(...reconciliation.reasons);
  } else if (migration.manifestAvailable && migration.physicalState !== PHYSICAL_STATES.ABSENT) {
    reasons.push(
      migration.physicalState === PHYSICAL_STATES.PRESENT
        ? "PHYSICAL_STATE_ALREADY_PRESENT"
        : "STRUCTURAL_DRIFT",
    );
  }

  const expectedSchema = (state.doctorReport.expectedSchema || []).find(
    (entry) => entry.migrationId === migration.id,
  );
  const operationalPreflight = state.operationalPreflightByMigration?.[migration.id] || null;
  if (policy?.operationalPreflight && !operationalPreflight)
    reasons.push("OPERATIONAL_PREFLIGHT_MISSING");
  if (operationalPreflight && !operationalPreflight.safeToApply)
    reasons.push("OPERATIONAL_PREFLIGHT_BLOCKED");
  const planSnapshot = (state.canonicalPlan || []).map((entry) => {
    const observed = byId.get(entry.id);
    return {
      id: entry.id,
      checksum: observed?.checksum || entry.checksum,
      ledgerState: observed?.ledgerState || entry.state,
      physicalState: observed?.physicalState || PHYSICAL_STATES.NOT_ASSESSED,
    };
  });
  const token = computeApplyOneToken({
    databaseName: state.doctorReport.database.name,
    migration,
    dependencies,
    planSnapshot,
    operationalPreflight,
  });
  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    migration,
    dependencies,
    planSnapshot,
    token,
    affectedTables: [...new Set(expectedSchema?.requiredTables || [])],
    requiresTableConfirmation: policy?.requiresTableConfirmation === true,
    operationalPreflight,
    policy,
    actions: summarizeActions(expectedSchema, policy),
    risk: {
      level: operationalPreflight?.riskLevel || (policy?.reconciliation ? "HIGH" : "MEDIUM"),
      ddlImplicitCommit: true,
      automaticRollback: false,
      reconciliation: Boolean(policy?.reconciliation),
    },
  };
}

function summarizeActions(expectedSchema, policy = null) {
  if (!expectedSchema) return [];
  const actions = [];
  for (const table of expectedSchema.requiredTables || [])
    actions.push({ kind: "TABLE", table, action: "CREATE_OR_VALIDATE" });
  for (const artifact of expectedSchema.requiredColumns || [])
    actions.push({
      kind: "COLUMN",
      table: artifact.table,
      name: artifact.name,
      action: "ADD_OR_VALIDATE",
    });
  for (const artifact of expectedSchema.requiredIndexes || [])
    actions.push({
      kind: "INDEX",
      table: artifact.table,
      name: artifact.name,
      action: "ADD_OR_VALIDATE",
    });
  for (const artifact of expectedSchema.requiredForeignKeys || [])
    actions.push({
      kind: "FOREIGN_KEY",
      table: artifact.table,
      name: artifact.name,
      action: "ADD_OR_VALIDATE",
    });
  actions.push(...(policy?.plannedActions || []).map((action) => ({ ...action })));
  return actions;
}

async function executeApplyOne({
  stateCollector,
  writeClientFactory,
  context,
  migrationId,
  confirmationToken,
  backupIdentifier,
  confirmedTables,
  clock = () => new Date(),
}) {
  if (!backupIdentifier)
    throw applyOneError(
      "apply-one --write requires --confirm-backup.",
      "APPLY_ONE_BACKUP_REQUIRED",
    );
  const initialState = await stateCollector(context);
  const initial = assessApplyOneRequest(initialState, migrationId);
  assertEligible(initial);
  assertConfirmedTables(initial, confirmedTables);
  assertToken(initial.token, confirmationToken);

  const immediateState = await stateCollector(context);
  const immediate = assessApplyOneRequest(immediateState, migrationId);
  assertEligible(immediate);
  assertConfirmedTables(immediate, confirmedTables);
  if (initial.token !== immediate.token)
    throw applyOneError(
      "The apply-one plan changed during immediate revalidation.",
      "APPLY_ONE_PLAN_CHANGED",
    );
  assertToken(immediate.token, confirmationToken);

  const client = await writeClientFactory();
  let runnerResult;
  try {
    runnerResult = await client.runner.applyOne(migrationId, { dryRun: false });
  } finally {
    await client.close();
  }
  if (
    !Array.isArray(runnerResult?.applied) ||
    runnerResult.applied.length !== 1 ||
    runnerResult.applied[0] !== migrationId
  ) {
    throw applyOneError(
      "The canonical runner did not apply exactly the selected migration.",
      "APPLY_ONE_RUNNER_RESULT_INVALID",
    );
  }

  const afterState = await stateCollector(context);
  const postValidation = validateApplyOnePostState({
    beforeState: immediateState,
    afterState,
    assessment: immediate,
  });
  if (!postValidation.passed)
    throw applyOneError(
      "Post-apply validation failed; manual intervention is required.",
      "APPLY_ONE_POST_VALIDATION_FAILED",
      postValidation,
    );
  return {
    command: "apply-one",
    mode: "WRITE",
    database: afterState.doctorReport.database,
    migrationId,
    checksum: immediate.migration.checksum,
    dependencies: immediate.migration.dependencies,
    backupIdentifier,
    confirmedTables: immediate.affectedTables,
    tokenConfirmed: confirmationToken,
    appliedIds: runnerResult.applied,
    writesPerformed: true,
    timestamp: clock().toISOString(),
    postValidation,
  };
}

function assertEligible(assessment) {
  if (!assessment.eligible)
    throw applyOneError(
      "The selected migration is blocked by the current plan.",
      "APPLY_ONE_BLOCKED",
      { reasons: assessment.reasons },
    );
}

function assertToken(expected, supplied) {
  if (!supplied || supplied !== expected)
    throw applyOneError(
      "apply-one confirmation token does not match the current plan.",
      "APPLY_ONE_CONFIRMATION_MISMATCH",
    );
}

function assertConfirmedTables(assessment, supplied) {
  if (!assessment.requiresTableConfirmation) return;
  const expected = [...assessment.affectedTables].sort();
  const actual = [...new Set(supplied || [])].sort();
  if (expected.length !== actual.length || expected.some((table, index) => table !== actual[index]))
    throw applyOneError(
      "apply-one table confirmation does not match the reviewed scope.",
      "APPLY_ONE_TABLE_CONFIRMATION_MISMATCH",
      { expectedTables: expected },
    );
}

function validateApplyOnePostState({ beforeState, afterState, assessment }) {
  const migration = afterState.doctorReport.migrations.find(
    (entry) => entry.id === assessment.migration.id,
  );
  const excluded = new Set(["j12_schema_migrations", ...assessment.affectedTables]);
  const checks = {
    selectedApplied:
      migration?.ledgerState === LEDGER_STATES.APPLIED && migration?.checksumMatches === true,
    selectedPhysicalStatePresent: migration?.physicalState === PHYSICAL_STATES.PRESENT,
    unselectedLedgerUnchanged:
      ledgerFingerprint(beforeState.doctorReport, assessment.migration.id) ===
      ledgerFingerprint(afterState.doctorReport, assessment.migration.id),
    unaffectedSchemaUnchanged:
      schemaFingerprint(beforeState.doctorReport, excluded) ===
      schemaFingerprint(afterState.doctorReport, excluded),
    legacyTablesUnchanged:
      schemaFingerprint(beforeState.doctorReport, new Set(), [...LEGACY_TABLES, "j12_usuarios"]) ===
      schemaFingerprint(afterState.doctorReport, new Set(), [...LEGACY_TABLES, "j12_usuarios"]),
    selectedTableOptionsExact:
      !assessment.policy?.operationalPreflight ||
      Boolean(
        afterState.operationalPreflightByMigration?.[assessment.migration.id]?.safeToApply &&
        afterState.operationalPreflightByMigration[assessment.migration.id].tables.every(
          (table) => table.requiresChange === false,
        ),
      ),
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
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return createHash("sha256").update(JSON.stringify(snapshot), "utf8").digest("hex");
}

function schemaFingerprint(doctorReport, excluded = new Set(), onlyTables = null) {
  const tables = doctorReport.schemaSnapshot?.tables || {};
  const names = (onlyTables || Object.keys(tables)).filter((name) => !excluded.has(name)).sort();
  const selected = Object.fromEntries(
    names.map((name) => [name, canonicalize(tables[name] || null)]),
  );
  return createHash("sha256").update(JSON.stringify(selected), "utf8").digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

module.exports = {
  assessApplyOneRequest,
  assertConfirmedTables,
  buildApplyOnePlan,
  executeApplyOne,
  isReviewedReconciliationFinding,
  ledgerFingerprint,
  schemaFingerprint,
  summarizeActions,
  validateApplyOnePostState,
};
