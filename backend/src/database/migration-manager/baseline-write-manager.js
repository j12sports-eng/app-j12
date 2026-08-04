"use strict";

const { createHash } = require("node:crypto");
const { LEDGER_STATES } = require("../j12-doctor/constants");
const { evaluateCatalogBaselineEligibility } = require("./baseline-eligibility-policy");
const { baselineError } = require("./baseline-errors");
const { computeBaselineToken } = require("./baseline-token");
const { buildValidationReport } = require("./validate-manager");

function sameList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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

function domainSchemaFingerprint(doctorReport) {
  const tables = { ...(doctorReport.schemaSnapshot?.tables || {}) };
  delete tables.j12_schema_migrations;
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(tables)), "utf8")
    .digest("hex");
}

function assessWriteRequest({ state, onlyIds }) {
  if (!Array.isArray(onlyIds) || onlyIds.length === 0)
    throw baselineError("Baseline write requires --only.", "BASELINE_ONLY_REQUIRED");
  if (new Set(onlyIds).size !== onlyIds.length)
    throw baselineError("Baseline --only contains duplicate IDs.", "BASELINE_ONLY_DUPLICATE");

  const migrations = state.doctorReport.migrations;
  const byId = new Map(migrations.map((migration) => [migration.id, migration]));
  const unknownIds = onlyIds.filter((id) => !byId.has(id));
  if (unknownIds.length)
    throw baselineError(
      "Baseline --only contains migrations outside the catalog.",
      "BASELINE_ONLY_EXTRA",
      {
        migrationIds: unknownIds,
      },
    );

  const selectedSet = new Set(onlyIds);
  const canonicalSelected = state.canonicalPlan
    .map((item) => item.id)
    .filter((id) => selectedSet.has(id));
  if (!sameList(onlyIds, canonicalSelected))
    throw baselineError(
      "Baseline --only order differs from canonical order.",
      "BASELINE_ONLY_ORDER_MISMATCH",
      { expected: canonicalSelected, actual: onlyIds },
    );

  const policy = evaluateCatalogBaselineEligibility({
    doctorReport: state.doctorReport,
    canonicalPlan: state.canonicalPlan,
  });
  const evaluationById = new Map(
    policy.evaluations.map((evaluation) => [evaluation.migrationId, evaluation]),
  );
  const selected = onlyIds.map((id) => byId.get(id));
  const allAlreadyApplied = selected.every(
    (migration) =>
      migration.ledgerState === LEDGER_STATES.APPLIED &&
      migration.checksumMatches === true &&
      !evaluationById.get(migration.id).structuralDrift,
  );
  if (allAlreadyApplied) {
    return {
      mode: "IDEMPOTENT",
      migrations: selected,
      policy,
      token: computeBaselineToken(state.doctorReport.database.name, selected),
    };
  }

  if (selected.some((migration) => migration.ledgerState === LEDGER_STATES.APPLIED))
    throw baselineError(
      "Baseline selection mixes applied and pending migrations.",
      "BASELINE_PLAN_CHANGED",
    );

  const blockedSelected = onlyIds
    .map((id) => evaluationById.get(id))
    .filter((evaluation) => !evaluation.eligible);
  if (blockedSelected.length)
    throw baselineError(
      "Baseline --only contains blocked migrations.",
      "BASELINE_BLOCKED_SELECTION",
      {
        migrations: blockedSelected.map((evaluation) => ({
          id: evaluation.migrationId,
          reasons: evaluation.reasons,
        })),
      },
    );

  const readyIds = policy.ready.map((evaluation) => evaluation.migrationId);
  if (!sameList(onlyIds, readyIds))
    throw baselineError(
      "Baseline --only must match the complete current BASELINE_READY plan.",
      "BASELINE_ONLY_MISMATCH",
      { expected: readyIds, actual: onlyIds },
    );
  return {
    mode: "WRITE",
    migrations: selected,
    policy,
    token: computeBaselineToken(state.doctorReport.database.name, selected),
  };
}

function assertConfirmationToken(expected, supplied) {
  if (!supplied || supplied !== expected)
    throw baselineError(
      "Baseline confirmation token does not match the recalculated plan.",
      "BASELINE_CONFIRMATION_MISMATCH",
    );
}

function assertSameAssessment(initial, immediate) {
  const initialIds = initial.migrations.map((migration) => migration.id);
  const immediateIds = immediate.migrations.map((migration) => migration.id);
  if (
    initial.mode !== immediate.mode ||
    initial.token !== immediate.token ||
    !sameList(initialIds, immediateIds)
  )
    throw baselineError(
      "Baseline plan changed during immediate revalidation.",
      "BASELINE_PLAN_CHANGED",
    );
}

function validatePostWrite({ beforeState, afterState, migrations, writerResult }) {
  const afterById = new Map(
    afterState.doctorReport.migrations.map((migration) => [migration.id, migration]),
  );
  const requestedValid = migrations.every((migration) => {
    const current = afterById.get(migration.id);
    return (
      current?.ledgerState === LEDGER_STATES.APPLIED &&
      current?.checksumMatches === true &&
      current?.physicalState === migration.physicalState
    );
  });
  const beforeValidation = buildValidationReport({
    doctorReport: beforeState.doctorReport,
    canonicalPlan: beforeState.canonicalPlan,
  });
  const afterValidation = buildValidationReport({
    doctorReport: afterState.doctorReport,
    canonicalPlan: afterState.canonicalPlan,
  });
  const expectedApplied =
    beforeState.doctorReport.summary.ledgerApplied + writerResult.insertedIds.length;
  const checks = {
    requestedMigrationsApplied: requestedValid,
    ledgerAppliedMatches: afterState.doctorReport.summary.ledgerApplied === expectedApplied,
    ledgerPendingMatches:
      afterState.doctorReport.summary.ledgerPending ===
      afterState.doctorReport.migrations.length - expectedApplied,
    requestedFormalDriftCleared: migrations.every(
      (migration) => !afterValidation.physicalSchema.formalDrift.includes(migration.id),
    ),
    requestedNoLongerBaselineReady: migrations.every((migration) => {
      const eligibility = afterValidation.baselineEligibility.find(
        (item) => item.migrationId === migration.id,
      );
      return eligibility && !eligibility.eligible;
    }),
    structuralDriftUnchanged:
      afterValidation.summary.structuralDriftCount ===
      beforeValidation.summary.structuralDriftCount,
    domainSchemaUnchanged:
      domainSchemaFingerprint(beforeState.doctorReport) ===
      domainSchemaFingerprint(afterState.doctorReport),
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    before: beforeValidation.summary,
    after: afterValidation.summary,
  };
}

async function executeControlledBaseline({
  stateCollector,
  writeClientFactory,
  context,
  onlyIds,
  confirmationToken,
  clock = () => new Date(),
}) {
  const initialState = await stateCollector(context);
  const initialAssessment = assessWriteRequest({ state: initialState, onlyIds });
  assertConfirmationToken(initialAssessment.token, confirmationToken);

  const immediateState = await stateCollector(context);
  const immediateAssessment = assessWriteRequest({ state: immediateState, onlyIds });
  assertSameAssessment(initialAssessment, immediateAssessment);
  assertConfirmationToken(immediateAssessment.token, confirmationToken);

  if (immediateAssessment.mode === "IDEMPOTENT") {
    const postValidation = validatePostWrite({
      beforeState: immediateState,
      afterState: immediateState,
      migrations: immediateAssessment.migrations,
      writerResult: { insertedIds: [] },
    });
    if (!postValidation.passed)
      throw baselineError(
        "Idempotent baseline validation failed; manual intervention is required.",
        "BASELINE_POST_VALIDATION_FAILED",
        postValidation,
      );
    return buildAuditResult({
      state: immediateState,
      assessment: immediateAssessment,
      confirmationToken,
      writerResult: {
        ledgerCreated: false,
        recordsBefore: immediateState.doctorReport.summary.ledgerApplied,
        recordsAfter: immediateState.doctorReport.summary.ledgerApplied,
        insertedIds: [],
        alreadyAppliedIds: onlyIds,
        writesPerformed: false,
        ddlTransactionSeparated: false,
      },
      postValidation,
      timestamp: clock(),
    });
  }

  const writeClient = await writeClientFactory();
  let writerResult;
  try {
    writerResult = await writeClient.writer.execute(immediateAssessment.migrations);
  } finally {
    await writeClient.close();
  }
  const afterState = await stateCollector(context);
  const postValidation = validatePostWrite({
    beforeState: immediateState,
    afterState,
    migrations: immediateAssessment.migrations,
    writerResult,
  });
  if (!postValidation.passed)
    throw baselineError(
      "Post-baseline validation failed; do not remove ledger records automatically. Manual intervention is required.",
      "BASELINE_POST_VALIDATION_FAILED",
      postValidation,
    );
  return buildAuditResult({
    state: afterState,
    assessment: immediateAssessment,
    confirmationToken,
    writerResult,
    postValidation,
    timestamp: clock(),
  });
}

function buildAuditResult({
  state,
  assessment,
  confirmationToken,
  writerResult,
  postValidation,
  timestamp,
}) {
  return {
    command: "baseline",
    mode: "WRITE",
    database: state.doctorReport.database,
    registeredIds: writerResult.insertedIds,
    alreadyAppliedIds: writerResult.alreadyAppliedIds,
    checksums: assessment.migrations.map((migration) => ({
      id: migration.id,
      checksum: migration.checksum,
    })),
    ledgerCreated: writerResult.ledgerCreated,
    ddlTransactionSeparated: writerResult.ddlTransactionSeparated,
    recordsBefore: writerResult.recordsBefore,
    recordsAfter: writerResult.recordsAfter,
    tokenConfirmed: confirmationToken,
    writesPerformed: writerResult.writesPerformed,
    timestamp: timestamp.toISOString(),
    postValidation,
  };
}

module.exports = {
  assessWriteRequest,
  assertConfirmationToken,
  assertSameAssessment,
  buildAuditResult,
  domainSchemaFingerprint,
  executeControlledBaseline,
  validatePostWrite,
};
