const CPF_UNIQUENESS_GATE_STATES = Object.freeze({
  APPROVED: "APPROVED",
  BLOCKED: "BLOCKED",
  NOT_EXECUTED: "NOT_EXECUTED",
});

const CPF_UNIQUENESS_GATE_BLOCKERS = Object.freeze({
  BACKFILL_INCOMPLETE: "BACKFILL_INCOMPLETE",
  CPF_DUPLICATES_FOUND: "CPF_DUPLICATES_FOUND",
  CPF_CHANGE_POLICY_NOT_CONFIRMED: "CPF_CHANGE_POLICY_NOT_CONFIRMED",
  CPF_OPTIONALITY_NOT_CONFIRMED: "CPF_OPTIONALITY_NOT_CONFIRMED",
  CPF_ROLE_NOT_CONFIRMED: "CPF_ROLE_NOT_CONFIRMED",
  FOREIGN_PERSON_POLICY_NOT_CONFIRMED: "FOREIGN_PERSON_POLICY_NOT_CONFIRMED",
  IDENTITY_SCOPE_NOT_CONFIRMED: "IDENTITY_SCOPE_NOT_CONFIRMED",
  INACTIVE_PERSON_POLICY_NOT_CONFIRMED: "INACTIVE_PERSON_POLICY_NOT_CONFIRMED",
  LEGAL_ENTITY_MODEL_NOT_CONFIRMED: "LEGAL_ENTITY_MODEL_NOT_CONFIRMED",
  LEGACY_WRITERS_UNSYNCHRONIZED: "LEGACY_WRITERS_UNSYNCHRONIZED",
  LEGITIMATE_DUPLICATE_USE_NOT_EXCLUDED: "LEGITIMATE_DUPLICATE_USE_NOT_EXCLUDED",
  MIGRATION_NOT_APPLIED: "MIGRATION_NOT_APPLIED",
  MIGRATION_NOT_IDEMPOTENT: "MIGRATION_NOT_IDEMPOTENT",
  MULTIPLE_NULLS_NOT_VALIDATED: "MULTIPLE_NULLS_NOT_VALIDATED",
  MYSQL_ENVIRONMENT_UNAVAILABLE: "MYSQL_ENVIRONMENT_UNAVAILABLE",
  MYSQL_VALIDATION_FAILED: "MYSQL_VALIDATION_FAILED",
  NULL_NORMALIZED_POLICY_NOT_CONFIRMED: "NULL_NORMALIZED_POLICY_NOT_CONFIRMED",
  OPERATIONAL_DATA_UNAVAILABLE: "OPERATIONAL_DATA_UNAVAILABLE",
  OPERATIONAL_IMPACT_NOT_ACCEPTED: "OPERATIONAL_IMPACT_NOT_ACCEPTED",
  ROLLBACK_NOT_VALIDATED: "ROLLBACK_NOT_VALIDATED",
  SCHEMA_MISMATCH: "SCHEMA_MISMATCH",
  STATUS_NOT_VALIDATED: "STATUS_NOT_VALIDATED",
  UNIQUE_ROLLOUT_NOT_DEFINED: "UNIQUE_ROLLOUT_NOT_DEFINED",
});

const BOOLEAN_EVIDENCE = Object.freeze([
  "environmentAvailable",
  "mysqlValidated",
  "migrationApplied",
  "migrationIdempotent",
  "statusValidated",
  "rollbackValidated",
  "multipleNullsValidated",
  "backfillCompleted",
  "operationalDataAvailable",
  "scopeConfirmed",
  "physicalPersonOnlyConfirmed",
  "legitimateDuplicateUseExcluded",
  "writersSynchronized",
  "normalizedCpfRequiredForCpfWrites",
  "uniqueRolloutDefined",
  "operationalImpactAccepted",
  "schemaMatches",
]);

const BUSINESS_DECISION_BLOCKERS = Object.freeze({
  cpfChangePolicy: CPF_UNIQUENESS_GATE_BLOCKERS.CPF_CHANGE_POLICY_NOT_CONFIRMED,
  cpfOptionalityPolicy: CPF_UNIQUENESS_GATE_BLOCKERS.CPF_OPTIONALITY_NOT_CONFIRMED,
  cpfRoleDecision: CPF_UNIQUENESS_GATE_BLOCKERS.CPF_ROLE_NOT_CONFIRMED,
  foreignPersonPolicy: CPF_UNIQUENESS_GATE_BLOCKERS.FOREIGN_PERSON_POLICY_NOT_CONFIRMED,
  inactivePersonPolicy: CPF_UNIQUENESS_GATE_BLOCKERS.INACTIVE_PERSON_POLICY_NOT_CONFIRMED,
  legalEntityDecision: CPF_UNIQUENESS_GATE_BLOCKERS.LEGAL_ENTITY_MODEL_NOT_CONFIRMED,
  nullNormalizedPolicy: CPF_UNIQUENESS_GATE_BLOCKERS.NULL_NORMALIZED_POLICY_NOT_CONFIRMED,
  personScopeDecision: CPF_UNIQUENESS_GATE_BLOCKERS.IDENTITY_SCOPE_NOT_CONFIRMED,
});

/** Consolidates evidence only. It never creates an index or returns identity values. */
function evaluateCpfUniquenessGate(evidence) {
  validateEvidence(evidence);
  const blockers = [];

  if (!evidence.environmentAvailable) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.MYSQL_ENVIRONMENT_UNAVAILABLE);
  }
  if (!evidence.mysqlValidated) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.MYSQL_VALIDATION_FAILED);
  }
  if (!evidence.migrationApplied) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.MIGRATION_NOT_APPLIED);
  }
  if (!evidence.migrationIdempotent) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.MIGRATION_NOT_IDEMPOTENT);
  }
  if (!evidence.statusValidated) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.STATUS_NOT_VALIDATED);
  }
  if (!evidence.rollbackValidated) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.ROLLBACK_NOT_VALIDATED);
  }
  if (!evidence.multipleNullsValidated) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.MULTIPLE_NULLS_NOT_VALIDATED);
  }
  if (!evidence.backfillCompleted) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.BACKFILL_INCOMPLETE);
  }
  if (!evidence.operationalDataAvailable) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.OPERATIONAL_DATA_UNAVAILABLE);
  }
  if (evidence.duplicateGroups > 0) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.CPF_DUPLICATES_FOUND);
  }
  if (!evidence.scopeConfirmed) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.IDENTITY_SCOPE_NOT_CONFIRMED);
  }
  if (!evidence.physicalPersonOnlyConfirmed) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.LEGAL_ENTITY_MODEL_NOT_CONFIRMED);
  }
  if (!evidence.legitimateDuplicateUseExcluded) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.LEGITIMATE_DUPLICATE_USE_NOT_EXCLUDED);
  }
  if (!evidence.writersSynchronized || !evidence.normalizedCpfRequiredForCpfWrites) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.LEGACY_WRITERS_UNSYNCHRONIZED);
  }
  if (!evidence.schemaMatches) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.SCHEMA_MISMATCH);
  }
  if (!evidence.uniqueRolloutDefined) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.UNIQUE_ROLLOUT_NOT_DEFINED);
  }
  if (!evidence.operationalImpactAccepted) {
    blockers.push(CPF_UNIQUENESS_GATE_BLOCKERS.OPERATIONAL_IMPACT_NOT_ACCEPTED);
  }
  for (const [decision, blocker] of Object.entries(BUSINESS_DECISION_BLOCKERS)) {
    if (evidence.businessDecisions[decision] !== "APPROVED") blockers.push(blocker);
  }

  const uniqueBlockers = Object.freeze([...new Set(blockers)]);
  return Object.freeze({
    blockers: uniqueBlockers,
    decision:
      uniqueBlockers.length === 0
        ? CPF_UNIQUENESS_GATE_STATES.APPROVED
        : CPF_UNIQUENESS_GATE_STATES.BLOCKED,
    state: evidence.environmentAvailable
      ? uniqueBlockers.length === 0
        ? CPF_UNIQUENESS_GATE_STATES.APPROVED
        : CPF_UNIQUENESS_GATE_STATES.BLOCKED
      : CPF_UNIQUENESS_GATE_STATES.NOT_EXECUTED,
  });
}

function validateEvidence(evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new TypeError("CPF uniqueness gate requires an evidence object.");
  }
  for (const field of BOOLEAN_EVIDENCE) {
    if (typeof evidence[field] !== "boolean") {
      throw new TypeError(`CPF uniqueness gate evidence ${field} must be boolean.`);
    }
  }
  if (!Number.isInteger(evidence.duplicateGroups) || evidence.duplicateGroups < 0) {
    throw new TypeError("CPF uniqueness gate duplicateGroups must be a non-negative integer.");
  }
  if (
    !evidence.businessDecisions ||
    typeof evidence.businessDecisions !== "object" ||
    Array.isArray(evidence.businessDecisions)
  ) {
    throw new TypeError("CPF uniqueness gate businessDecisions must be an object.");
  }
  const allowedStates = new Set(["APPROVED", "PROPOSED", "BLOCKED", "NOT_APPLICABLE"]);
  for (const decision of Object.keys(BUSINESS_DECISION_BLOCKERS)) {
    if (!allowedStates.has(evidence.businessDecisions[decision])) {
      throw new TypeError(`CPF uniqueness gate business decision ${decision} is invalid.`);
    }
  }
}

module.exports = Object.freeze({
  CPF_UNIQUENESS_GATE_BLOCKERS,
  CPF_UNIQUENESS_GATE_STATES,
  BUSINESS_DECISION_BLOCKERS,
  evaluateCpfUniquenessGate,
});
