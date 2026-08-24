"use strict";

const { LEDGER_STATES, PHYSICAL_STATES } = require("../j12-doctor/constants");
const { analyzeDuplicateMigrations } = require("./duplicate-manager");
const { evaluateTableOptionAdoption } = require("./baseline-adoption-policy");
const { assessHistoricalArtifactSupersession } = require("./historical-supersession-policy");

const MISSING_ARTIFACT_CODES = new Set([
  "TABLE_MISSING",
  "COLUMN_MISSING",
  "INDEX_MISSING",
  "FOREIGN_KEY_MISSING",
]);
const MISMATCH_ARTIFACT_CODES = new Set([
  "COLUMN_MISMATCH",
  "INDEX_MISMATCH",
  "FOREIGN_KEY_MISMATCH",
]);

function findingsForMigration(doctorReport, migrationId) {
  return (doctorReport.findings || []).filter(
    (finding) => finding.details?.migrationId === migrationId,
  );
}

function evaluateBaselineEligibility({
  migration,
  findings = [],
  dependenciesSatisfied = true,
  unresolvedDependencies = [],
  dependencySupersessions = [],
  ambiguousOwnership = false,
  catalogMigrations = [],
  schemaSnapshot = null,
}) {
  const requiredArtifactMissing = findings.some((finding) =>
    MISSING_ARTIFACT_CODES.has(finding.code),
  );
  const artifactMismatch = findings.some((finding) => MISMATCH_ARTIFACT_CODES.has(finding.code));
  const requiredArtifactsMissing = findings
    .filter((finding) => MISSING_ARTIFACT_CODES.has(finding.code))
    .map((finding) => ({ code: finding.code, ...(finding.details || {}) }));
  const artifactMismatches = findings
    .filter((finding) => MISMATCH_ARTIFACT_CODES.has(finding.code))
    .map((finding) => ({ code: finding.code, ...(finding.details || {}) }));
  const tableOptionDifferences = findings
    .filter((finding) => finding.code === "TABLE_OPTION_MISMATCH")
    .map((finding) => ({ ...(finding.details || {}) }));
  const tableOptionDrift =
    migration.tableOptionDrift === true ||
    migration.physicalState === PHYSICAL_STATES.TABLE_OPTION_DRIFT ||
    findings.some((finding) => finding.code === "TABLE_OPTION_MISMATCH");
  const tableOptionAdoption = evaluateTableOptionAdoption({
    migration,
    findings,
    catalogMigrations,
    schemaSnapshot,
  });
  const observedStructuralDrift =
    migration.structuralDrift === true ||
    [PHYSICAL_STATES.PARTIAL, PHYSICAL_STATES.INCOMPATIBLE].includes(migration.physicalState) ||
    (migration.physicalState === PHYSICAL_STATES.PRESENT &&
      (requiredArtifactMissing || artifactMismatch));
  const legacyAdoptionAccepted =
    tableOptionAdoption.accepted && tableOptionAdoption.legacyStructure?.accepted === true;
  const structuralDrift = observedStructuralDrift && !legacyAdoptionAccepted;
  const formalDrift =
    [PHYSICAL_STATES.PRESENT, PHYSICAL_STATES.TABLE_OPTION_DRIFT].includes(
      migration.physicalState,
    ) && migration.ledgerState === LEDGER_STATES.PENDING;
  const checksumMismatch = migration.checksumMatches === false;
  const manifestCoverage = migration.manifestAvailable === true;
  const reasons = [];

  if (structuralDrift) reasons.push("STRUCTURAL_DRIFT");
  if (tableOptionDrift && !tableOptionAdoption.accepted)
    reasons.push(...tableOptionAdoption.reasons);
  if (checksumMismatch) reasons.push("CHECKSUM_MISMATCH");
  if (!dependenciesSatisfied) reasons.push("DEPENDENCY_NOT_SATISFIED");
  if (!manifestCoverage) reasons.push("MANIFEST_MISSING");
  if (requiredArtifactMissing && !legacyAdoptionAccepted) reasons.push("REQUIRED_ARTIFACT_MISSING");
  if (artifactMismatch && !legacyAdoptionAccepted) reasons.push("ARTIFACT_MISMATCH");
  if (migration.physicalState === PHYSICAL_STATES.NOT_ASSESSED)
    reasons.push("UNKNOWN_PHYSICAL_STATE");
  else if (
    migration.physicalState !== PHYSICAL_STATES.PRESENT &&
    !legacyAdoptionAccepted &&
    !(
      migration.physicalState === PHYSICAL_STATES.TABLE_OPTION_DRIFT && tableOptionAdoption.accepted
    )
  )
    reasons.push("PHYSICAL_STATE_NOT_PRESENT");
  if (ambiguousOwnership) reasons.push("AMBIGUOUS_MIGRATION_OWNERSHIP");
  if (migration.ledgerState !== LEDGER_STATES.PENDING) reasons.push("LEDGER_STATE_NOT_PENDING");

  const uniqueReasons = [...new Set(reasons)];
  const eligible = uniqueReasons.length === 0;
  const readyWithAdoption = eligible && tableOptionAdoption.accepted;
  return {
    id: migration.id,
    migrationId: migration.id,
    eligible,
    state: readyWithAdoption
      ? "BASELINE_READY_WITH_ADOPTION"
      : eligible
        ? "BASELINE_READY"
        : "BASELINE_BLOCKED",
    reasons: uniqueReasons,
    informationalReasons: readyWithAdoption
      ? ["AUDITED_LEGACY_AUTH_ADOPTION", "AUDITED_TABLE_OPTION_ADOPTION"]
      : [],
    physicalState: migration.physicalState,
    ledgerState: migration.ledgerState,
    structuralDrift,
    observedStructuralDrift,
    legacyAdoptionAccepted,
    legacyClassification: tableOptionAdoption.legacyClassification,
    legacyStructureDifferences: tableOptionAdoption.legacyStructure?.differences || [],
    tableOptionDrift,
    tableOptionDecision: tableOptionAdoption.state,
    tableOptionAdoption: tableOptionAdoption.adoption,
    formalDrift,
    checksumMismatch,
    dependenciesSatisfied,
    unresolvedDependencies: [...unresolvedDependencies],
    dependencySupersessions: [...dependencySupersessions],
    manifestCoverage,
    requiredArtifactMissing,
    requiredArtifactsMissing,
    artifactMismatch,
    artifactMismatches,
    tableOptionDifferences,
    ambiguousOwnership,
  };
}

function orderMigrations(migrations, canonicalPlan = []) {
  const byId = new Map(migrations.map((migration) => [migration.id, migration]));
  const ordered = canonicalPlan.map((item) => byId.get(item.id)).filter(Boolean);
  const orderedIds = new Set(ordered.map((migration) => migration.id));
  for (const migration of migrations) if (!orderedIds.has(migration.id)) ordered.push(migration);
  return ordered;
}

function evaluateCatalogBaselineEligibility({ doctorReport, canonicalPlan = [] }) {
  const ordered = orderMigrations(doctorReport.migrations, canonicalPlan);
  const byId = new Map(ordered.map((migration) => [migration.id, migration]));
  const duplicateAnalysis = analyzeDuplicateMigrations(doctorReport);
  const readyIds = new Set();
  const evaluations = [];
  const evaluationById = new Map();

  for (const migration of ordered) {
    const dependencySupersessions = [];
    const unresolvedDependencies = (migration.dependencies || []).filter((dependencyId) => {
      if (readyIds.has(dependencyId)) return false;
      const dependency = byId.get(dependencyId);
      if (!dependency || dependency.ledgerState !== LEDGER_STATES.APPLIED) return true;
      const dependencyEvaluation = evaluationById.get(dependencyId);
      if (!dependencyEvaluation) return true;
      if (dependencyEvaluation.checksumMismatch || dependencyEvaluation.ambiguousOwnership)
        return true;
      if (!dependencyEvaluation.structuralDrift) return false;
      const supersession = assessHistoricalArtifactSupersession({
        doctorReport,
        historicalMigration: dependency,
        historicalEvaluation: dependencyEvaluation,
        catalogMigrations: ordered,
      });
      if (!supersession.satisfied) return true;
      dependencySupersessions.push({ dependencyId, ...supersession });
      return false;
    });
    const evaluation = evaluateBaselineEligibility({
      migration,
      findings: findingsForMigration(doctorReport, migration.id),
      dependenciesSatisfied: unresolvedDependencies.length === 0,
      unresolvedDependencies,
      dependencySupersessions,
      ambiguousOwnership: duplicateAnalysis.ambiguousMigrationIds.has(migration.id),
      catalogMigrations: ordered,
      schemaSnapshot: doctorReport.schemaSnapshot,
    });
    evaluations.push(evaluation);
    evaluationById.set(migration.id, evaluation);
    if (evaluation.eligible) readyIds.add(migration.id);
  }

  return {
    ordered,
    evaluations,
    ready: evaluations.filter((evaluation) => evaluation.eligible),
    blocked: evaluations.filter((evaluation) => !evaluation.eligible),
    duplicateDiagnostics: duplicateAnalysis.diagnostics,
  };
}

module.exports = {
  MISMATCH_ARTIFACT_CODES,
  MISSING_ARTIFACT_CODES,
  evaluateBaselineEligibility,
  evaluateCatalogBaselineEligibility,
  findingsForMigration,
  orderMigrations,
};
