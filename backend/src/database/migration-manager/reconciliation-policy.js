"use strict";

const { createHash } = require("node:crypto");
const { PHYSICAL_STATES } = require("../j12-doctor/constants");

const LEDGER_ONLY_FINDING_CODES = new Set([
  "MIGRATION_CHECKSUM_MISMATCH",
  "MIGRATION_LEDGER_STATUS",
]);
const NON_PHYSICAL_FINDING_CODES = new Set([...LEDGER_ONLY_FINDING_CODES, "FORMAL_PHYSICAL_DRIFT"]);

function assessReviewedReconciliationState({
  doctorReport,
  migration,
  allowPartial = true,
  allowTableOptionDrift = true,
}) {
  const reasons = [];
  const policy = migration?.applyPolicy;
  const findings = reviewableFindings(doctorReport, migration?.id);

  if (policy?.reconciliation !== true) reasons.push("RECONCILIATION_POLICY_REQUIRED");
  if (!(policy?.allowedPhysicalStates || []).includes(migration?.physicalState))
    reasons.push("RECONCILIATION_STATE_NOT_REVIEWED");
  if (!allowPartial && migration?.physicalState === PHYSICAL_STATES.PARTIAL)
    reasons.push("RECONCILIATION_PARTIAL_STATE_UNSAFE");
  if (findings.some((finding) => !isReviewedReconciliationFinding(policy, finding)))
    reasons.push("UNREVIEWED_STRUCTURAL_DRIFT");
  if (
    (migration?.artifactMismatches || []).some(
      (mismatch) => !isReviewedReconciliationArtifact(policy, mismatch),
    )
  )
    reasons.push("UNREVIEWED_ARTIFACT_MISMATCH");
  if (
    !allowTableOptionDrift &&
    (migration?.tableOptionDrift === true || (migration?.tableOptionDifferences || []).length > 0)
  )
    reasons.push("RECONCILIATION_TABLE_OPTION_DRIFT_UNSAFE");

  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    findings,
    fingerprints: recoveryFingerprints({ doctorReport, migration }),
  };
}

function recoveryFingerprints({ doctorReport, migration }) {
  const findings = reviewableFindings(doctorReport, migration?.id);
  const physicalFindings = findings.filter(
    (finding) => !NON_PHYSICAL_FINDING_CODES.has(finding.code),
  );
  const expectedSchema = (doctorReport?.expectedSchema || []).find(
    (entry) => entry.migrationId === migration?.id,
  );
  const tables = new Set(expectedSchema?.requiredTables || []);
  for (const action of migration?.applyPolicy?.plannedActions || [])
    if (action.table) tables.add(action.table);
  for (const finding of physicalFindings)
    if (finding.details?.table) tables.add(finding.details.table);
  const schemaTables = doctorReport?.schemaSnapshot?.tables || {};
  const selectedSchema = Object.fromEntries(
    [...tables].sort().map((table) => [table, schemaTables[table] || null]),
  );

  return Object.freeze({
    policy: fingerprint(migration?.applyPolicy || null),
    findings: fingerprint(findings),
    physical: fingerprint({
      physicalState: migration?.physicalState || null,
      structuralDrift: migration?.structuralDrift === true,
      tableOptionDrift: migration?.tableOptionDrift === true,
      requiredArtifactsMissing: migration?.requiredArtifactsMissing || [],
      artifactMismatches: migration?.artifactMismatches || [],
      tableOptionDifferences: migration?.tableOptionDifferences || [],
      findings: physicalFindings,
      schema: selectedSchema,
    }),
  });
}

function dependencyFingerprint(dependencies = []) {
  return fingerprint(
    [...dependencies]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((dependency) => ({
        id: dependency.id,
        checksum: dependency.checksum,
        ledgerChecksum: dependency.ledgerChecksum || null,
        ledgerState: dependency.ledgerState,
        ledgerStatus: dependency.ledgerStatus,
        checksumMatches: dependency.checksumMatches,
        appliedAt: dependency.appliedAt || null,
        physicalState: dependency.physicalState,
        structuralDrift: dependency.structuralDrift === true,
        tableOptionDrift: dependency.tableOptionDrift === true,
      })),
  );
}

function databaseIdentity(database = {}) {
  return Object.freeze({
    host: database.host || null,
    name: database.name || null,
    remote: database.remote === true,
  });
}

function reviewableFindings(doctorReport, migrationId) {
  return (doctorReport?.findings || [])
    .filter(
      (finding) =>
        finding.details?.migrationId === migrationId &&
        !LEDGER_ONLY_FINDING_CODES.has(finding.code),
    )
    .map((finding) => canonicalize(finding))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function isReviewedReconciliationArtifact(policy, artifact) {
  const { code, ...details } = artifact || {};
  return isReviewedReconciliationFinding(policy, { code, details });
}

function isReviewedReconciliationFinding(policy, finding) {
  if (!(policy?.reviewedFindingCodes || []).includes(finding.code)) return false;
  if (finding.code === "INDEX_MISMATCH" && policy.reviewedIndexMismatches) {
    const actualColumns = (finding.details?.actual?.columns || []).map((column) =>
      typeof column === "string" ? column : column.name,
    );
    return policy.reviewedIndexMismatches.some(
      (reviewed) =>
        reviewed.table === finding.details?.table &&
        reviewed.name === finding.details?.index &&
        reviewed.unique === finding.details?.actual?.unique &&
        reviewed.columns.join(",") === actualColumns.join(","),
    );
  }
  if (finding.code === "COLUMN_MISMATCH" && policy.reviewedColumnMismatches) {
    const actual = finding.details?.actual || {};
    return policy.reviewedColumnMismatches.some(
      (reviewed) =>
        reviewed.table === finding.details?.table &&
        reviewed.name === finding.details?.column &&
        normalizeType(reviewed.columnType) === normalizeType(actual.columnType) &&
        reviewed.nullable === actual.nullable,
    );
  }
  return true;
}

function normalizeType(value) {
  return String(value || "")
    .replace(/\s+/gu, "")
    .toLowerCase();
}

function fingerprint(value) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)), "utf8")
    .digest("hex");
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
  assessReviewedReconciliationState,
  canonicalize,
  databaseIdentity,
  dependencyFingerprint,
  fingerprint,
  isReviewedReconciliationFinding,
  recoveryFingerprints,
  reviewableFindings,
};
