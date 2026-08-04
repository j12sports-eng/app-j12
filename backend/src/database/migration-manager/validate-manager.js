"use strict";

const { PHYSICAL_STATES, SEVERITIES } = require("../j12-doctor/constants");
const { evaluateCatalogBaselineEligibility } = require("./baseline-eligibility-policy");

function buildValidationReport({ doctorReport, canonicalPlan = [] }) {
  const policy = evaluateCatalogBaselineEligibility({ doctorReport, canonicalPlan });
  const checksumMismatches = doctorReport.migrations.filter(
    (migration) => migration.checksumMatches === false,
  );
  const structuralDrift = policy.evaluations.filter((evaluation) => evaluation.structuralDrift);
  const formalDrift = policy.evaluations.filter((evaluation) => evaluation.formalDrift);
  const tableOptionDrift = policy.evaluations.filter((evaluation) => evaluation.tableOptionDrift);
  const unknown = doctorReport.migrations.filter(
    (migration) => migration.physicalState === PHYSICAL_STATES.NOT_ASSESSED,
  );
  const criticalFindings = doctorReport.findings.filter(
    (finding) => finding.severity === SEVERITIES.CRITICAL,
  );
  const highFindings = doctorReport.findings.filter(
    (finding) => finding.severity === SEVERITIES.HIGH,
  );

  return {
    command: "validate",
    readOnly: true,
    valid:
      checksumMismatches.length === 0 &&
      structuralDrift.length === 0 &&
      tableOptionDrift.length === 0 &&
      criticalFindings.length === 0,
    database: doctorReport.database,
    summary: {
      formalDriftCount: formalDrift.length,
      structuralDriftCount: structuralDrift.length,
      tableOptionDriftCount: tableOptionDrift.length,
      baselineReadyCount: policy.ready.length,
      baselineBlockedCount: policy.blocked.length,
      checksumMismatchCount: checksumMismatches.length,
      ambiguousOwnershipCount: policy.duplicateDiagnostics.filter(
        (diagnostic) => diagnostic.ambiguousOwnership,
      ).length,
    },
    catalog: {
      total: doctorReport.migrations.length,
      canonicalOrderEntries: canonicalPlan.length,
      ordered: canonicalPlan.length === doctorReport.migrations.length,
    },
    ledger: {
      applied: doctorReport.summary.ledgerApplied,
      pending: doctorReport.summary.ledgerPending,
      exists: Boolean(doctorReport.schemaSnapshot.tables.j12_schema_migrations),
      checksumMismatches: checksumMismatches.map((migration) => migration.id),
    },
    physicalSchema: {
      present: doctorReport.summary.physicallyPresent,
      partial: doctorReport.summary.partiallyPresent,
      absent: doctorReport.summary.physicallyAbsent,
      unknown: doctorReport.summary.unknown,
      structuralDrift: structuralDrift.map((evaluation) => evaluation.migrationId),
      tableOptionDrift: tableOptionDrift.map((evaluation) => evaluation.migrationId),
      formalDrift: formalDrift.map((evaluation) => evaluation.migrationId),
    },
    baselineEligibility: policy.evaluations,
    duplicateDiagnostics: policy.duplicateDiagnostics,
    findings: doctorReport.findings,
    criticalFindings,
    highFindings,
    limitations: unknown.length
      ? [`${unknown.length} migration(s) sem manifest físico permanecem UNKNOWN.`]
      : [],
  };
}

module.exports = { buildValidationReport };
