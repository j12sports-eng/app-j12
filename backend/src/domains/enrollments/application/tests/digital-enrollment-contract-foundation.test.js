const assert = require("node:assert/strict");
const test = require("node:test");
const { DigitalEnrollmentContract, DigitalEnrollmentContractAcceptance, DigitalEnrollmentContractTemplate, stableContentHash } = require("../../domain/entities/digital-enrollment-contract.entity.js");
const { DigitalEnrollmentContractService, FOUNDATION_BLOCKER } = require("../services/digital-enrollment-contract.service.js");

test("template is versioned, hashes normalized safe content and rejects unsafe HTML", () => {
  const template = new DigitalEnrollmentContractTemplate({ id: "t1", unitId: "u1", name: "Contrato", version: "1", content: "<h1>Contrato</h1>\r\n<p>Termos</p>" });
  assert.equal(template.status, "DRAFT");
  assert.equal(template.contentHash, stableContentHash("<h1>Contrato</h1>\n<p>Termos</p>"));
  assert.throws(() => new DigitalEnrollmentContractTemplate({ id: "t2", unitId: "u1", name: "X", version: "1", content: "<script>alert(1)</script>" }), /content/);
});
test("contract freezes a relationship-bound snapshot independent from later template data", () => {
  const contract = new DigitalEnrollmentContract({ id: "c1", enrollmentId: "e1", templateId: "t1", templateVersion: "1", responsibleRelationshipId: "r1", contentSnapshot: "<p>Snapshot v1</p>", generatedAt: "2026-07-25T12:00:00Z" });
  assert.equal(contract.contentHash, stableContentHash("<p>Snapshot v1</p>"));
  assert.equal(contract.responsibleRelationshipId, "r1");
});
test("acceptance requires versioned allowlisted consent and electronic confirmation", () => {
  const contentHash = stableContentHash("<p>Snapshot</p>");
  const acceptance = new DigitalEnrollmentContractAcceptance({ id: "a1", enrollmentContractId: "c1", enrollmentId: "e1", responsibleRelationshipId: "r1", invitationId: "i1", contentHash, acceptedAt: "2026-07-25T12:00:00Z", termsVersion: "1", consents: [{ code: "CONTRACT_TERMS", version: "1", accepted: true }] });
  assert.equal(acceptance.acceptanceMethod, "ELECTRONIC_CONFIRMATION");
  assert.throws(() => new DigitalEnrollmentContractAcceptance({ ...acceptance, id: "a2", consents: [] }), /consents/);
  assert.throws(() => new DigitalEnrollmentContractAcceptance({ ...acceptance, id: "a3", consents: [{ code: "IMAGE_USE", version: "1", accepted: true }] }), /consents/);
});
test("public operations fail closed while template selection is not canonical", async () => {
  const service = new DigitalEnrollmentContractService();
  for (const operation of ["getContract", "getAcceptanceStatus", "acceptContract"]) {
    await assert.rejects(() => service[operation]("raw-token"), (error) => error.statusCode === 503 && error.blocker === FOUNDATION_BLOCKER);
  }
});
