"use strict";

const { LEDGER_STATES, PHYSICAL_STATES } = require("../j12-doctor/constants");
const { isReviewedReconciliationFinding } = require("./reconciliation-policy");

const EXPLICIT_REPLACEMENT_ACTIONS = new Set(["REPLACE_LEGACY_IF_EXACT"]);
const SUPPORTED_ARTIFACT_FINDINGS = Object.freeze({
  INDEX_MISMATCH: Object.freeze({ kind: "INDEX", nameProperty: "index" }),
});

function assessHistoricalArtifactSupersession({
  doctorReport,
  historicalMigration,
  historicalEvaluation,
  catalogMigrations = [],
}) {
  if (
    historicalMigration?.ledgerState !== LEDGER_STATES.APPLIED ||
    historicalMigration?.checksumMatches !== true ||
    historicalEvaluation?.structuralDrift !== true ||
    historicalEvaluation?.checksumMismatch === true ||
    historicalEvaluation?.ambiguousOwnership === true
  )
    return noSupersession();

  const historicalArtifacts = [
    ...(historicalEvaluation.requiredArtifactsMissing || []),
    ...(historicalEvaluation.artifactMismatches || []),
  ];
  if (historicalArtifacts.length === 0) return noSupersession();

  for (const corrective of catalogMigrations) {
    const declarations = (corrective.applyPolicy?.supersedesHistoricalArtifacts || []).filter(
      (entry) => entry.historicalMigrationId === historicalMigration.id,
    );
    if (!isSafeAppliedCorrective(corrective, historicalMigration.id, declarations)) continue;
    if (
      !historicalArtifacts.every((artifact) =>
        declarations.some((declaration) =>
          declarationCoversArtifact({
            artifact,
            corrective,
            declaration,
            doctorReport,
          }),
        ),
      )
    )
      continue;

    return {
      satisfied: true,
      correctiveMigrationId: corrective.id,
      artifacts: declarations.map(describeDeclaration),
    };
  }

  return noSupersession();
}

function isSafeAppliedCorrective(corrective, historicalMigrationId, declarations) {
  const policy = corrective?.applyPolicy;
  if (
    corrective?.ledgerState !== LEDGER_STATES.APPLIED ||
    corrective?.checksumMatches !== true ||
    corrective?.manifestAvailable !== true ||
    !(corrective.dependencies || []).includes(historicalMigrationId) ||
    policy?.reconciliation !== true ||
    corrective.physicalState !== PHYSICAL_STATES.PRESENT ||
    corrective.structuralDrift === true ||
    corrective.tableOptionDrift === true ||
    (corrective.tableOptionDifferences || []).length > 0 ||
    (corrective.requiredArtifactsMissing || []).length > 0 ||
    declarations.length === 0
  )
    return false;

  if (
    (corrective.artifactMismatches || []).some((mismatch) => {
      const { code, ...details } = mismatch;
      return !isReviewedReconciliationFinding(policy, { code, details });
    })
  )
    return false;

  return declarations.every(
    (declaration) =>
      validDeclaration(declaration) &&
      (policy.plannedActions || []).some(
        (action) =>
          action.kind === declaration.kind &&
          action.table === declaration.table &&
          action.name === declaration.name &&
          action.action === declaration.replacementAction,
      ),
  );
}

function validDeclaration(declaration) {
  const finding = SUPPORTED_ARTIFACT_FINDINGS[declaration?.findingCode];
  return Boolean(
    finding &&
    finding.kind === declaration.kind &&
    declaration.table &&
    declaration.name &&
    EXPLICIT_REPLACEMENT_ACTIONS.has(declaration.replacementAction),
  );
}

function declarationCoversArtifact({ artifact, corrective, declaration, doctorReport }) {
  const finding = SUPPORTED_ARTIFACT_FINDINGS[artifact?.code];
  if (
    !finding ||
    declaration.findingCode !== artifact.code ||
    declaration.kind !== finding.kind ||
    declaration.table !== artifact.table ||
    declaration.name !== artifact[finding.nameProperty]
  )
    return false;

  if (finding.kind !== "INDEX") return false;
  const reviewedLegacy = (corrective.applyPolicy.reviewedIndexMismatches || []).find(
    (entry) => entry.table === declaration.table && entry.name === declaration.name,
  );
  const correctiveSchema = (doctorReport?.expectedSchema || []).find(
    (entry) => entry.migrationId === corrective.id,
  );
  const expectedReplacement = (correctiveSchema?.requiredIndexes || []).find(
    (entry) => entry.table === declaration.table && entry.name === declaration.name,
  );

  return (
    sameIndexDefinition(artifact.expected, reviewedLegacy) &&
    sameIndexDefinition(artifact.actual, expectedReplacement)
  );
}

function sameIndexDefinition(left, right) {
  if (!left || !right || left.unique !== right.unique) return false;
  return indexColumns(left).join(",") === indexColumns(right).join(",");
}

function indexColumns(index) {
  return (index?.columns || []).map((column) =>
    typeof column === "string" ? column : column?.name,
  );
}

function describeDeclaration(declaration) {
  return {
    findingCode: declaration.findingCode,
    kind: declaration.kind,
    table: declaration.table,
    name: declaration.name,
    replacementAction: declaration.replacementAction,
  };
}

function noSupersession() {
  return { satisfied: false, correctiveMigrationId: null, artifacts: [] };
}

module.exports = {
  EXPLICIT_REPLACEMENT_ACTIONS,
  assessHistoricalArtifactSupersession,
  declarationCoversArtifact,
  isSafeAppliedCorrective,
  sameIndexDefinition,
};
