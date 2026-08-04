"use strict";

const { LEDGER_STATES } = require("../j12-doctor/constants");
const { evaluateCatalogBaselineEligibility } = require("./baseline-eligibility-policy");
const { buildLedgerPrerequisites, createBaselineLedgerRecord } = require("./ledger-manager");
const { computeBaselineToken } = require("./baseline-token");

function buildBaselinePlan({ doctorReport, canonicalPlan = [] }) {
  const policy = evaluateCatalogBaselineEligibility({ doctorReport, canonicalPlan });
  const byId = new Map(doctorReport.migrations.map((migration) => [migration.id, migration]));
  const ready = policy.ready.map((evaluation) => ({
    ...createBaselineLedgerRecord(byId.get(evaluation.migrationId)),
    eligibilityState: evaluation.state,
    informationalReasons: evaluation.informationalReasons,
  }));
  const blocked = policy.blocked;
  const confirmationToken = computeBaselineToken(
    doctorReport.database.name,
    policy.ready.map((evaluation) => byId.get(evaluation.migrationId)),
  );

  const ledger = buildLedgerPrerequisites(doctorReport);
  const executionBlockers = [];
  if (!ledger.exists) executionBlockers.push("LEDGER_CREATION_REQUIRES_EXPLICIT_AUTHORIZATION");
  if (blocked.length) executionBlockers.push("BLOCKED_BASELINE_CANDIDATES");
  if (policy.evaluations.some((evaluation) => evaluation.checksumMismatch))
    executionBlockers.push("CHECKSUM_MISMATCH");

  return {
    command: "baseline",
    mode: "DRY_RUN",
    dryRun: true,
    executable: false,
    writesPerformed: false,
    database: doctorReport.database,
    ledger,
    summary: {
      ready: ready.length,
      blocked: blocked.length,
      alreadyApplied: doctorReport.migrations.filter(
        (migration) => migration.ledgerState === LEDGER_STATES.APPLIED,
      ).length,
    },
    registrations: ready,
    confirmation: {
      algorithm: "SHA-256",
      tokenVersion: "J12_BASELINE_V1",
      expectedToken: confirmationToken,
      only: ready.map((record) => record.id),
    },
    blocked,
    eligibility: policy.evaluations,
    duplicateDiagnostics: policy.duplicateDiagnostics,
    executionBlockers,
  };
}

module.exports = { buildBaselinePlan };
