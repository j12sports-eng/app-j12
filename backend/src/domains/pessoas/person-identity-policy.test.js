const assert = require("node:assert/strict");
const test = require("node:test");
const {
  PERSON_IDENTITY_DECISION_STATES,
  PersonIdentityPolicy,
  REQUIRED_PERSON_IDENTITY_DECISIONS,
  decisionStates,
  validatePersonIdentityPolicy,
} = require("./person-identity-policy.js");

test("policy declares every required decision with a closed state", () => {
  assert.equal(validatePersonIdentityPolicy(), true);
  assert.deepEqual(
    Object.keys(PersonIdentityPolicy.decisions).sort(),
    [...REQUIRED_PERSON_IDENTITY_DECISIONS].sort(),
  );
  const allowed = new Set(Object.values(PERSON_IDENTITY_DECISION_STATES));
  for (const state of Object.values(decisionStates())) assert.equal(allowed.has(state), true);
  assert.equal(Object.isFrozen(PersonIdentityPolicy), true);
});

test("approved invariants preserve shared contacts, profiles and access separation", () => {
  assert.deepEqual(PersonIdentityPolicy.invariants.sharedEmail, {
    status: "APPROVED",
    value: "ALLOW",
  });
  assert.deepEqual(PersonIdentityPolicy.invariants.sharedPhone, {
    status: "APPROVED",
    value: "ALLOW",
  });
  assert.equal(PersonIdentityPolicy.invariants.multipleProfilesPerPerson.value, true);
  assert.equal(PersonIdentityPolicy.invariants.authorizationSeparatedFromIdentity.value, true);
  assert.equal(PersonIdentityPolicy.invariants.cpfBelongsToPersonNotProfile.value, true);
});

test("unresolved business rules remain proposed or blocked", () => {
  const states = decisionStates();
  assert.equal(states.personScopeDecision, "APPROVED");
  assert.equal(states.legalEntityDecision, "BLOCKED");
  assert.equal(states.foreignPersonPolicy, "BLOCKED");
  assert.equal(states.cpfChangePolicy, "BLOCKED");
  assert.equal(states.cpfRoleDecision, "PROPOSED");
  assert.equal(states.nullNormalizedPolicy, "PROPOSED");
});

test("validator rejects missing and invented states", () => {
  assert.throws(() => validatePersonIdentityPolicy({ decisions: {} }), /personScopeDecision/u);
  const invalid = structuredClone(PersonIdentityPolicy);
  invalid.decisions.cpfRoleDecision.status = "ASSUMED";
  assert.throws(() => validatePersonIdentityPolicy(invalid), /cpfRoleDecision/u);
});
