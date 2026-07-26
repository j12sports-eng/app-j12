const assert = require("node:assert/strict");
const test = require("node:test");
const {
  DIGITAL_ENROLLMENT_DOCUMENT_POLICY_NOT_CONFIGURED,
  DIGITAL_ENROLLMENT_DOCUMENT_TYPE_UNSUPPORTED,
  DigitalEnrollmentDocumentCompletionPolicy,
} = require("../../domain/policies/digital-enrollment-document-completion.policy.js");

const policy = new DigitalEnrollmentDocumentCompletionPolicy();
const document = (type, status = "PENDING", extra = {}) => ({
  enrollmentId: "enrollment-1",
  originalName: "sensitive.pdf",
  responsibleRelationshipId: "relationship-1",
  status,
  storageKey: "internal-key",
  token: "secret-token",
  type,
  ...extra,
});

test("fails closed when explicit document configuration is absent", () => {
  assert.deepEqual(policy.evaluate({ documents: [] }), {
    blocker: DIGITAL_ENROLLMENT_DOCUMENT_POLICY_NOT_CONFIGURED,
    complete: false,
    missingTypes: [],
    rejectedTypes: [],
    requiredTypes: [],
    submittedTypes: [],
  });
});

test("accepts an explicitly empty configuration as complete", () => {
  assert.deepEqual(policy.evaluate({ documents: [], requiredDocumentTypes: [] }), {
    blocker: null,
    complete: true,
    missingTypes: [],
    rejectedTypes: [],
    requiredTypes: [],
    submittedTypes: [],
  });
});

test("rejects an unsupported required type with a canonical code", () => {
  assert.throws(() => policy.evaluate({ documents: [], requiredDocumentTypes: ["PASSPORT"] }), {
    code: DIGITAL_ENROLLMENT_DOCUMENT_TYPE_UNSUPPORTED,
  });
});

test("reports all required documents as missing when none were submitted", () => {
  const result = policy.evaluate({
    documents: [],
    requiredDocumentTypes: ["RG", "CPF"],
  });
  assert.deepEqual(result.requiredTypes, ["CPF", "RG"]);
  assert.deepEqual(result.missingTypes, ["CPF", "RG"]);
  assert.equal(result.complete, false);
});

test("reports one missing required document", () => {
  const result = policy.evaluate({
    documents: [document("CPF")],
    requiredDocumentTypes: ["CPF", "RG"],
  });
  assert.deepEqual(result.submittedTypes, ["CPF"]);
  assert.deepEqual(result.missingTypes, ["RG"]);
});

test("PENDING and APPROVED documents both satisfy submission", () => {
  const result = policy.evaluate({
    documents: [document("CPF", "PENDING"), document("RG", "APPROVED")],
    requiredDocumentTypes: ["CPF", "RG"],
  });
  assert.equal(result.complete, true);
  assert.deepEqual(result.submittedTypes, ["CPF", "RG"]);
  assert.deepEqual(result.missingTypes, []);
});

test("REJECTED alone does not satisfy a required type", () => {
  const result = policy.evaluate({
    documents: [document("CPF", "REJECTED")],
    requiredDocumentTypes: ["CPF"],
  });
  assert.equal(result.complete, false);
  assert.deepEqual(result.missingTypes, ["CPF"]);
  assert.deepEqual(result.rejectedTypes, ["CPF"]);
});

test("a valid document satisfies a type even when another document of that type was rejected", () => {
  const result = policy.evaluate({
    documents: [document("CPF", "REJECTED"), document("CPF", "PENDING")],
    requiredDocumentTypes: ["CPF"],
  });
  assert.equal(result.complete, true);
  assert.deepEqual(result.submittedTypes, ["CPF"]);
  assert.deepEqual(result.rejectedTypes, ["CPF"]);
});

test("optional documents and duplicate configuration do not influence completion", () => {
  const result = policy.evaluate({
    documents: [document("FOTO", "REJECTED"), document("CPF")],
    requiredDocumentTypes: ["CPF", "CPF"],
  });
  assert.deepEqual(result, {
    blocker: null,
    complete: true,
    missingTypes: [],
    rejectedTypes: [],
    requiredTypes: ["CPF"],
    submittedTypes: ["CPF"],
  });
});

test("result is deterministic regardless of document order", () => {
  const input = [document("RG", "APPROVED"), document("CPF", "REJECTED"), document("CPF")];
  const first = policy.evaluate({ documents: input, requiredDocumentTypes: ["RG", "CPF"] });
  const second = policy.evaluate({
    documents: [...input].reverse(),
    requiredDocumentTypes: ["CPF", "RG"],
  });
  assert.deepEqual(first, second);
});

test("does not mutate inputs and returns a deeply immutable safe projection", () => {
  const requiredDocumentTypes = ["RG", "CPF", "CPF"];
  const documents = [document("CPF", "PENDING", { buffer: Buffer.from("private") })];
  const requiredSnapshot = [...requiredDocumentTypes];
  const documentSnapshot = { ...documents[0] };
  const result = policy.evaluate({ documents, requiredDocumentTypes });

  assert.deepEqual(requiredDocumentTypes, requiredSnapshot);
  assert.deepEqual(documents[0], documentSnapshot);
  assert.equal(Object.isFrozen(result), true);
  for (const value of Object.values(result)) {
    if (Array.isArray(value)) assert.equal(Object.isFrozen(value), true);
  }
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /storageKey|token|originalName|buffer|private|sensitive/);
});
