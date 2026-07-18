const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CPF_UNIQUENESS_GATE_BLOCKERS,
  CPF_UNIQUENESS_GATE_STATES,
  evaluateCpfUniquenessGate,
} = require("./person-cpf-uniqueness-gate.js");
const { decisionStates } = require("./person-identity-policy.js");

test("gate approves only complete operational and business evidence", () => {
  const result = evaluateCpfUniquenessGate(approvedEvidence());
  assert.deepEqual(result, { blockers: [], decision: "APPROVED", state: "APPROVED" });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.blockers), true);
});

test("unavailable MySQL makes execution not executed and uniqueness blocked", () => {
  const evidence = approvedEvidence();
  evidence.environmentAvailable = false;
  evidence.mysqlValidated = false;
  evidence.operationalDataAvailable = false;
  const result = evaluateCpfUniquenessGate(evidence);
  assert.equal(result.state, CPF_UNIQUENESS_GATE_STATES.NOT_EXECUTED);
  assert.equal(result.decision, CPF_UNIQUENESS_GATE_STATES.BLOCKED);
  assert.deepEqual(result.blockers, [
    CPF_UNIQUENESS_GATE_BLOCKERS.MYSQL_ENVIRONMENT_UNAVAILABLE,
    CPF_UNIQUENESS_GATE_BLOCKERS.MYSQL_VALIDATION_FAILED,
    CPF_UNIQUENESS_GATE_BLOCKERS.OPERATIONAL_DATA_UNAVAILABLE,
  ]);
});

test("duplicates block an otherwise approved gate without returning CPF", () => {
  const evidence = approvedEvidence();
  evidence.duplicateGroups = 2;
  const result = evaluateCpfUniquenessGate(evidence);
  assert.equal(result.state, "BLOCKED");
  assert.deepEqual(result.blockers, ["CPF_DUPLICATES_FOUND"]);
  assert.doesNotMatch(JSON.stringify(result), /[0-9]{11}|@|\+55/u);
});

test("unsynchronized writer or nullable normalized CPF blocks physical guarantee", () => {
  const evidence = approvedEvidence();
  evidence.writersSynchronized = false;
  evidence.normalizedCpfRequiredForCpfWrites = false;
  const result = evaluateCpfUniquenessGate(evidence);
  assert.deepEqual(result.blockers, ["LEGACY_WRITERS_UNSYNCHRONIZED"]);
});

test("missing business scope and legal entity evidence remain explicit blockers", () => {
  const evidence = approvedEvidence();
  evidence.scopeConfirmed = false;
  evidence.physicalPersonOnlyConfirmed = false;
  evidence.legitimateDuplicateUseExcluded = false;
  const result = evaluateCpfUniquenessGate(evidence);
  assert.deepEqual(result.blockers, [
    "IDENTITY_SCOPE_NOT_CONFIRMED",
    "LEGAL_ENTITY_MODEL_NOT_CONFIRMED",
    "LEGITIMATE_DUPLICATE_USE_NOT_EXCLUDED",
  ]);
});

test("proposed or blocked policy decisions keep the uniqueness gate blocked", () => {
  const evidence = approvedEvidence();
  evidence.businessDecisions = decisionStates();
  const result = evaluateCpfUniquenessGate(evidence);
  assert.equal(result.decision, "BLOCKED");
  assert.deepEqual(result.blockers, [
    "CPF_CHANGE_POLICY_NOT_CONFIRMED",
    "CPF_OPTIONALITY_NOT_CONFIRMED",
    "CPF_ROLE_NOT_CONFIRMED",
    "FOREIGN_PERSON_POLICY_NOT_CONFIRMED",
    "INACTIVE_PERSON_POLICY_NOT_CONFIRMED",
    "LEGAL_ENTITY_MODEL_NOT_CONFIRMED",
    "NULL_NORMALIZED_POLICY_NOT_CONFIRMED",
  ]);
  assert.doesNotMatch(JSON.stringify(result), /[0-9]{11}|@|\+55/u);
});

test("gate rejects missing, truthy or invalid evidence instead of approving partially", () => {
  assert.throws(() => evaluateCpfUniquenessGate(), /evidence object/u);
  assert.throws(
    () => evaluateCpfUniquenessGate({ ...approvedEvidence(), mysqlValidated: 1 }),
    /mysqlValidated must be boolean/u,
  );
  assert.throws(
    () => evaluateCpfUniquenessGate({ ...approvedEvidence(), duplicateGroups: -1 }),
    /non-negative integer/u,
  );
});

function approvedEvidence() {
  return {
    backfillCompleted: true,
    businessDecisions: Object.fromEntries(
      Object.keys(decisionStates()).map((field) => [field, "APPROVED"]),
    ),
    duplicateGroups: 0,
    environmentAvailable: true,
    legitimateDuplicateUseExcluded: true,
    migrationApplied: true,
    migrationIdempotent: true,
    multipleNullsValidated: true,
    mysqlValidated: true,
    normalizedCpfRequiredForCpfWrites: true,
    operationalDataAvailable: true,
    operationalImpactAccepted: true,
    physicalPersonOnlyConfirmed: true,
    rollbackValidated: true,
    schemaMatches: true,
    scopeConfirmed: true,
    statusValidated: true,
    uniqueRolloutDefined: true,
    writersSynchronized: true,
  };
}
