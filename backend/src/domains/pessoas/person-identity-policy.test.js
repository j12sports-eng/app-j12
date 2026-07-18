const assert = require("node:assert/strict");
const test = require("node:test");
const {
  PERSON_IDENTITY_DECISION_STATES,
  PersonIdentityPolicy,
  REQUIRED_PERSON_IDENTITY_DECISIONS,
  decisionStates,
  validatePersonIdentityPolicy,
} = require("./person-identity-policy.js");

test("official policy declares all twenty executive decisions as approved", () => {
  assert.equal(validatePersonIdentityPolicy(), true);
  assert.equal(REQUIRED_PERSON_IDENTITY_DECISIONS.length, 20);
  assert.deepEqual(
    Object.keys(PersonIdentityPolicy.decisions).sort(),
    [...REQUIRED_PERSON_IDENTITY_DECISIONS].sort(),
  );
  assert.deepEqual(new Set(Object.values(decisionStates())), new Set(["APPROVED"]));
  assert.equal(PersonIdentityPolicy.source.status, "OFFICIAL_J12_POLICY");
  assert.equal(Object.isFrozen(PersonIdentityPolicy), true);
});

test("official invariants preserve global identity, contextual access and shared contacts", () => {
  assert.equal(PersonIdentityPolicy.decisions.entityNatureDecision.value, "NATURAL_PERSON_ONLY");
  assert.equal(
    PersonIdentityPolicy.decisions.personScopeDecision.value,
    "GLOBAL_IDENTITY_CONTEXTUAL_PROFILES_AND_ACCESS",
  );
  assert.equal(
    PersonIdentityPolicy.decisions.privacyAuthorizationPolicy.value,
    "GLOBAL_RESOLUTION_CONTEXTUAL_AUTHORIZATION",
  );
  assert.equal(PersonIdentityPolicy.invariants.sharedEmail.value, "ALLOW");
  assert.equal(PersonIdentityPolicy.invariants.sharedPhone.value, "ALLOW");
  assert.equal(PersonIdentityPolicy.invariants.multipleProfilesPerPerson.value, true);
  assert.equal(PersonIdentityPolicy.invariants.cpfBelongsToPersonNotProfile.value, true);
});

test("CPF lifecycle policy matches the official executive decisions", () => {
  assert.equal(PersonIdentityPolicy.decisions.cpfRoleDecision.value, "OPTIONAL_STRONG_IDENTIFIER");
  assert.equal(
    PersonIdentityPolicy.decisions.invalidNewCpfPolicy.value,
    "REJECT_INVALID_CPF_ON_MODERN_WRITES",
  );
  assert.equal(
    PersonIdentityPolicy.decisions.invalidLegacyCpfPolicy.value,
    "PRESERVE_WITH_NULL_NORMALIZED_AND_ASSISTED_REVIEW",
  );
  assert.equal(
    PersonIdentityPolicy.decisions.duplicateCpfPolicy.value,
    "BLOCK_AND_REVIEW_WITHOUT_AUTOMATIC_MERGE",
  );
  assert.equal(
    PersonIdentityPolicy.decisions.inactivePersonPolicy.value,
    "IDENTITY_AND_CPF_REMAIN_RESERVED",
  );
});

test("specialist and implementation conditions do not downgrade business approval", () => {
  assert.deepEqual(PersonIdentityPolicy.decisions.cpfHistoryPolicy.conditions, ["LGPD_REVIEW"]);
  assert.deepEqual(PersonIdentityPolicy.decisions.cpfChangePolicy.conditions, [
    "IMPLEMENTATION_PENDING",
  ]);
  assert.deepEqual(PersonIdentityPolicy.decisions.personScopeDecision.conditions, [
    "TECHNICAL_GATES_REQUIRED",
  ]);
  assert.equal(PersonIdentityPolicy.decisions.cpfHistoryPolicy.status, "APPROVED");
});

test("validator rejects missing, invented states and malformed conditions", () => {
  assert.throws(() => validatePersonIdentityPolicy({ decisions: {} }), /entityNatureDecision/u);
  const invalidState = structuredClone(PersonIdentityPolicy);
  invalidState.decisions.cpfRoleDecision.status = "ASSUMED";
  assert.throws(() => validatePersonIdentityPolicy(invalidState), /cpfRoleDecision/u);
  const invalidConditions = structuredClone(PersonIdentityPolicy);
  invalidConditions.decisions.cpfRoleDecision.conditions = "NONE";
  assert.throws(() => validatePersonIdentityPolicy(invalidConditions), /cpfRoleDecision/u);
  assert.equal(new Set(Object.values(PERSON_IDENTITY_DECISION_STATES)).has("APPROVED"), true);
});
