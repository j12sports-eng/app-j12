"use strict";

const { PHYSICAL_STATES } = require("../j12-doctor/constants");
const {
  evaluateCatalogBaselineEligibility,
  orderMigrations,
} = require("./baseline-eligibility-policy");

function migrationView(migration) {
  return {
    id: migration.id,
    fileName: migration.fileName,
    dependencies: migration.dependencies || [],
    ledgerState: migration.ledgerState,
    physicalState: migration.physicalState,
    driftDetected: migration.driftDetected,
    structuralDrift: migration.structuralDrift,
    tableOptionDrift: migration.tableOptionDrift,
    formalDrift: migration.formalDrift,
    driftClassification: migration.driftClassification,
    manifestAvailable: migration.manifestAvailable,
  };
}

function buildMigrationPlan({ doctorReport, canonicalPlan = [] }) {
  const ordered = orderMigrations(doctorReport.migrations, canonicalPlan);
  const policy = evaluateCatalogBaselineEligibility({ doctorReport, canonicalPlan });
  const physicallyPresent = ordered
    .filter((migration) => migration.physicalState === PHYSICAL_STATES.PRESENT)
    .map(migrationView);
  const physicallyAbsent = ordered
    .filter((migration) => migration.physicalState === PHYSICAL_STATES.ABSENT)
    .map(migrationView);
  const structuralDrift = policy.evaluations.filter((item) => item.structuralDrift);
  const formalDrift = policy.evaluations.filter((item) => item.formalDrift);
  const tableOptionDrift = policy.evaluations.filter((item) => item.tableOptionDrift);
  const unknown = ordered
    .filter((migration) => migration.physicalState === PHYSICAL_STATES.NOT_ASSESSED)
    .map(migrationView);

  return {
    command: "plan",
    readOnly: true,
    database: doctorReport.database,
    summary: {
      total: ordered.length,
      physicallyPresent: physicallyPresent.length,
      physicallyAbsent: physicallyAbsent.length,
      structuralDrift: structuralDrift.length,
      formalDrift: formalDrift.length,
      tableOptionDrift: tableOptionDrift.length,
      baselineReady: policy.ready.length,
      baselineBlocked: policy.blocked.length,
      unknown: unknown.length,
    },
    physicallyPresent,
    physicallyAbsent,
    structuralDrift,
    formalDrift,
    tableOptionDrift,
    baselineReady: policy.ready,
    baselineBlocked: policy.blocked,
    unknown,
    duplicateDiagnostics: policy.duplicateDiagnostics,
    canonicalOrder: canonicalPlan.map((item) => item.id),
  };
}

module.exports = { buildMigrationPlan, migrationView };
