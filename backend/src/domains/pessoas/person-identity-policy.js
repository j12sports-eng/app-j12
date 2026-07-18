const PERSON_IDENTITY_DECISION_STATES = Object.freeze({
  APPROVED: "APPROVED",
  BLOCKED: "BLOCKED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  PROPOSED: "PROPOSED",
});

const REQUIRED_PERSON_IDENTITY_DECISIONS = Object.freeze([
  "entityNatureDecision",
  "legalEntityDecision",
  "cpfRoleDecision",
  "cpfOptionalityPolicy",
  "minorStudentCpfPolicy",
  "adultStudentCpfPolicy",
  "responsibleCpfPolicy",
  "foreignPersonPolicy",
  "alternativeDocumentPolicy",
  "cpfValidationPolicy",
  "invalidNewCpfPolicy",
  "invalidLegacyCpfPolicy",
  "duplicateCpfPolicy",
  "cpfChangePolicy",
  "cpfHistoryPolicy",
  "inactivePersonPolicy",
  "physicalDeletionPolicy",
  "nullNormalizedPolicy",
  "personScopeDecision",
  "privacyAuthorizationPolicy",
]);

const PersonIdentityPolicy = deepFreeze({
  decisions: {
    adultStudentCpfPolicy: approved("BRAZILIAN_ADULT_REQUIRES_VALID_CPF_FOR_ACTIVE_ENROLLMENT", [
      "FOREIGN_PERSON_EXCEPTION",
    ]),
    alternativeDocumentPolicy: approved("TYPED_ALTERNATIVE_DOCUMENT_DOMAIN", [
      "FUTURE_IMPLEMENTATION",
    ]),
    cpfChangePolicy: approved("AUTHORIZED_AUDITED_CHANGE_ONLY", ["IMPLEMENTATION_PENDING"]),
    cpfHistoryPolicy: approved("RESTRICTED_CPF_HISTORY_REQUIRED", ["LGPD_REVIEW"]),
    cpfOptionalityPolicy: approved("CONDITIONALLY_REQUIRED_BY_LIFECYCLE", ["SPECIALIST_REVIEW"]),
    cpfRoleDecision: approved("OPTIONAL_STRONG_IDENTIFIER"),
    cpfValidationPolicy: approved("NORMALIZED_SEMANTICALLY_VALID_AND_VERIFIED_LEVELS"),
    duplicateCpfPolicy: approved("BLOCK_AND_REVIEW_WITHOUT_AUTOMATIC_MERGE"),
    entityNatureDecision: approved("NATURAL_PERSON_ONLY"),
    foreignPersonPolicy: approved("ALLOW_WITHOUT_CPF_USING_INTERNAL_ID"),
    inactivePersonPolicy: approved("IDENTITY_AND_CPF_REMAIN_RESERVED"),
    invalidLegacyCpfPolicy: approved("PRESERVE_WITH_NULL_NORMALIZED_AND_ASSISTED_REVIEW"),
    invalidNewCpfPolicy: approved("REJECT_INVALID_CPF_ON_MODERN_WRITES"),
    legalEntityDecision: approved("SEPARATE_LEGAL_ENTITY_DOMAIN", ["FUTURE_IMPLEMENTATION"]),
    minorStudentCpfPolicy: approved("ALLOW_WITHOUT_CPF_WHEN_RESPONSIBLE_IS_VALID"),
    nullNormalizedPolicy: approved("NULL_ONLY_WHEN_CPF_ABSENT_OR_LEGACY_INVALID"),
    personScopeDecision: approved("GLOBAL_IDENTITY_CONTEXTUAL_PROFILES_AND_ACCESS", [
      "TECHNICAL_GATES_REQUIRED",
    ]),
    physicalDeletionPolicy: approved("CONTROLLED_ONLY_WITHOUT_LINKS_OR_OBLIGATIONS", [
      "LGPD_REVIEW",
    ]),
    privacyAuthorizationPolicy: approved("GLOBAL_RESOLUTION_CONTEXTUAL_AUTHORIZATION"),
    responsibleCpfPolicy: approved("REQUIRED_BEFORE_ACTIVE_WHEN_CONTRACTUAL_OR_FINANCIAL", [
      "SPECIALIST_REVIEW",
    ]),
  },
  invariants: {
    authorizationSeparatedFromIdentity: approved(true),
    cpfBelongsToPersonNotProfile: approved(true),
    duplicateCpfWrite: approved("BLOCK_AND_REVIEW"),
    multipleProfilesPerPerson: approved(true),
    sharedEmail: approved("ALLOW"),
    sharedPhone: approved("ALLOW"),
  },
  source: {
    document: "docs/PESSOAS/PERSON_IDENTITY_AND_CPF_EXECUTIVE_DECISION.md",
    status: "OFFICIAL_J12_POLICY",
    version: "SPRINT_27_17A_4_1D_2",
  },
});

function approved(value, conditions = []) {
  return { conditions, status: "APPROVED", value };
}

function validatePersonIdentityPolicy(policy = PersonIdentityPolicy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    throw new TypeError("Person identity policy must be an object.");
  }
  const allowed = new Set(Object.values(PERSON_IDENTITY_DECISION_STATES));
  for (const field of REQUIRED_PERSON_IDENTITY_DECISIONS) {
    const decision = policy.decisions?.[field];
    if (
      !decision ||
      !allowed.has(decision.status) ||
      (typeof decision.value !== "string" && typeof decision.value !== "boolean") ||
      !Array.isArray(decision.conditions)
    ) {
      throw new TypeError(`Invalid person identity policy decision: ${field}.`);
    }
  }
  return true;
}

function decisionStates(policy = PersonIdentityPolicy) {
  validatePersonIdentityPolicy(policy);
  return Object.freeze(
    Object.fromEntries(
      REQUIRED_PERSON_IDENTITY_DECISIONS.map((field) => [field, policy.decisions[field].status]),
    ),
  );
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

module.exports = Object.freeze({
  PERSON_IDENTITY_DECISION_STATES,
  PersonIdentityPolicy,
  REQUIRED_PERSON_IDENTITY_DECISIONS,
  decisionStates,
  validatePersonIdentityPolicy,
});
