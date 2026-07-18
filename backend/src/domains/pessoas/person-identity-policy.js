const PERSON_IDENTITY_DECISION_STATES = Object.freeze({
  APPROVED: "APPROVED",
  BLOCKED: "BLOCKED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  PROPOSED: "PROPOSED",
});

const REQUIRED_PERSON_IDENTITY_DECISIONS = Object.freeze([
  "personScopeDecision",
  "cpfRoleDecision",
  "legalEntityDecision",
  "foreignPersonPolicy",
  "cpfOptionalityPolicy",
  "cpfChangePolicy",
  "inactivePersonPolicy",
  "nullNormalizedPolicy",
]);

const PersonIdentityPolicy = deepFreeze({
  decisions: {
    cpfChangePolicy: {
      status: "BLOCKED",
      value: "AUTHORIZED_AUDITED_CHANGE_REQUIRED",
    },
    cpfOptionalityPolicy: {
      status: "PROPOSED",
      value: "CPF_CONDITIONALLY_REQUIRED",
    },
    cpfRoleDecision: {
      status: "PROPOSED",
      value: "OPTIONAL_STRONG_IDENTIFIER",
    },
    foreignPersonPolicy: {
      status: "BLOCKED",
      value: "ALTERNATIVE_DOCUMENT_MODEL_REQUIRED",
    },
    inactivePersonPolicy: {
      status: "PROPOSED",
      value: "IDENTITY_REMAINS_RESERVED",
    },
    legalEntityDecision: {
      status: "BLOCKED",
      value: "LEGAL_ENTITY_BOUNDARY_UNDEFINED",
    },
    nullNormalizedPolicy: {
      status: "PROPOSED",
      value: "NULL_ONLY_WHEN_CPF_ABSENT_OR_LEGACY_INVALID",
    },
    personScopeDecision: {
      status: "APPROVED",
      value: "GLOBAL_IDENTITY_CONTEXTUAL_PROFILES_AND_ACCESS",
    },
  },
  invariants: {
    authorizationSeparatedFromIdentity: { status: "APPROVED", value: true },
    cpfBelongsToPersonNotProfile: { status: "APPROVED", value: true },
    duplicateCpfWrite: { status: "PROPOSED", value: "BLOCK_AND_REVIEW" },
    multipleProfilesPerPerson: { status: "APPROVED", value: true },
    sharedEmail: { status: "APPROVED", value: "ALLOW" },
    sharedPhone: { status: "APPROVED", value: "ALLOW" },
  },
});

function validatePersonIdentityPolicy(policy = PersonIdentityPolicy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    throw new TypeError("Person identity policy must be an object.");
  }
  const allowed = new Set(Object.values(PERSON_IDENTITY_DECISION_STATES));
  for (const field of REQUIRED_PERSON_IDENTITY_DECISIONS) {
    const decision = policy.decisions?.[field];
    if (!decision || !allowed.has(decision.status) || typeof decision.value !== "string") {
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
