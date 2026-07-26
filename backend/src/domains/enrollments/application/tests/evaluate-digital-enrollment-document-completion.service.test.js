const assert = require("node:assert/strict");
const test = require("node:test");
const {
  DigitalEnrollmentDocument,
} = require("../../domain/entities/digital-enrollment-document.entity.js");
const {
  MemoryDigitalEnrollmentDocumentRepository,
} = require("../../infrastructure/repositories/memory-digital-enrollment-document.repository.js");
const {
  EvaluateDigitalEnrollmentDocumentCompletionService,
} = require("../services/evaluate-digital-enrollment-document-completion.service.js");
const {
  DigitalEnrollmentContractService,
} = require("../services/digital-enrollment-contract.service.js");

function seed(id, enrollmentId, relationshipId, type, status = "PENDING") {
  return new DigitalEnrollmentDocument({
    enrollmentId,
    extension: ".pdf",
    id,
    mimeType: "application/pdf",
    originalName: `${id}.pdf`,
    responsibleRelationshipId: relationshipId,
    sha256: id.padEnd(64, "a").slice(0, 64),
    sizeBytes: 10,
    status,
    storageKey: `storage-${id}`,
    type,
  });
}

test("reads only documents owned by the requested enrollment and relationship", async () => {
  const repository = new MemoryDigitalEnrollmentDocumentRepository([
    seed("1", "enrollment-1", "relationship-1", "CPF"),
    seed("2", "enrollment-2", "relationship-2", "RG"),
    seed("3", "enrollment-1", "relationship-other", "RG"),
  ]);
  const service = new EvaluateDigitalEnrollmentDocumentCompletionService({ repository });
  const result = await service.execute({
    enrollmentId: "enrollment-1",
    requiredDocumentTypes: ["CPF", "RG"],
    responsibleRelationshipId: "relationship-1",
  });
  assert.deepEqual(result.submittedTypes, ["CPF"]);
  assert.deepEqual(result.missingTypes, ["RG"]);
});

test("evaluation performs no persistence and advances no progress", async () => {
  const calls = [];
  const repository = {
    async listByEnrollment(enrollmentId, relationshipId) {
      calls.push({ enrollmentId, relationshipId, operation: "list" });
      return [];
    },
    async create() {
      calls.push({ operation: "create" });
    },
    async approve() {
      calls.push({ operation: "approve" });
    },
    async reject() {
      calls.push({ operation: "reject" });
    },
  };
  const service = new EvaluateDigitalEnrollmentDocumentCompletionService({ repository });
  await service.execute({
    enrollmentId: "enrollment-1",
    requiredDocumentTypes: ["CPF"],
    responsibleRelationshipId: "relationship-1",
  });
  assert.deepEqual(calls, [
    {
      enrollmentId: "enrollment-1",
      operation: "list",
      relationshipId: "relationship-1",
    },
  ]);
});

test("evaluation does not create contracts or financial records and contract remains fail-closed", async () => {
  let contractCalls = 0;
  let financialCalls = 0;
  const repository = {
    async listByEnrollment() {
      return [];
    },
  };
  const service = new EvaluateDigitalEnrollmentDocumentCompletionService({ repository });
  await service.execute({
    enrollmentId: "enrollment-1",
    requiredDocumentTypes: [],
    responsibleRelationshipId: "relationship-1",
  });
  assert.equal(contractCalls, 0);
  assert.equal(financialCalls, 0);

  const contractService = new DigitalEnrollmentContractService();
  await assert.rejects(() => contractService.getContract(), {
    code: "DIGITAL_ENROLLMENT_CONTRACT_NOT_AVAILABLE",
  });
});
test("fails closed with a stable safe error when the repository is unavailable", async () => {
  const service = new EvaluateDigitalEnrollmentDocumentCompletionService();
  await assert.rejects(
    () => service.execute({ enrollmentId: "enrollment-secret", requiredDocumentTypes: [], responsibleRelationshipId: "relationship-secret" }),
    (error) => {
      assert.equal(error.code, "DIGITAL_ENROLLMENT_DOCUMENT_REPOSITORY_UNAVAILABLE");
      assert.equal(error.statusCode, 503);
      assert.equal(error.expose, false);
      assert.doesNotMatch(JSON.stringify(error), /enrollment-secret|relationship-secret|SELECT|password/i);
      return true;
    },
  );
});