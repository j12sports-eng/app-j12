const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");
const { DigitalEnrollmentDocumentService, MAX_DOCUMENT_SIZE_BYTES } = require("../services/digital-enrollment-document.service.js");
const { MemoryDigitalEnrollmentDocumentRepository } = require("../../infrastructure/repositories/memory-digital-enrollment-document.repository.js");
const { MemoryDocumentStorageProvider } = require("../../infrastructure/storage/memory-document-storage.provider.js");

function setup(overrides = {}) {
  const repository = new MemoryDigitalEnrollmentDocumentRepository();
  const storageProvider = new MemoryDocumentStorageProvider();
  const invitationResolver = overrides.invitationResolver || { async resolveInvitationByRawToken() { return { enrollmentId: "enrollment-1", invitationId: "invitation-1" }; } };
  const accessGateway = overrides.accessGateway || { async resolveDocumentAccess() { return { enrollmentId: "enrollment-1", responsibleRelationshipId: "relationship-1" }; } };
  return { repository, storageProvider, service: new DigitalEnrollmentDocumentService({ accessGateway, invitationResolver, repository, storageProvider }) };
}
const pdf = (buffer = Buffer.from("%PDF-1.7 test")) => ({ buffer, mimetype: "application/pdf", originalname: "documento.pdf", size: buffer.length });

test("uploads multipart metadata, calculates SHA-256, lists and downloads", async () => {
  const { service } = setup();
  const file = pdf();
  const created = await service.upload("token", { file, type: "CPF" });
  assert.equal(created.status, "PENDING");
  assert.equal(created.sha256, createHash("sha256").update(file.buffer).digest("hex"));
  assert.equal((await service.list("token")).length, 1);
  assert.deepEqual((await service.download("token", created.id)).buffer, file.buffer);
});
test("rejects invalid MIME/extension and oversized files", async () => {
  const { service } = setup();
  await assert.rejects(() => service.upload("token", { file: { ...pdf(), mimetype: "text/plain" }, type: "RG" }), { code: "DIGITAL_ENROLLMENT_DOCUMENT_INVALID" });
  await assert.rejects(() => service.upload("token", { file: { buffer: Buffer.alloc(1), mimetype: "application/pdf", originalname: "x.pdf", size: MAX_DOCUMENT_SIZE_BYTES + 1 }, type: "RG" }), { code: "DIGITAL_ENROLLMENT_DOCUMENT_TOO_LARGE" });
});
test("blocks duplicate content hash and deletes pending document plus binary", async () => {
  const { service, storageProvider } = setup();
  const created = await service.upload("token", { file: pdf(), type: "CPF" });
  await assert.rejects(() => service.upload("token", { file: pdf(), type: "RG" }), { code: "DIGITAL_ENROLLMENT_DOCUMENT_DUPLICATE" });
  assert.equal(storageProvider.files.size, 1);
  assert.deepEqual(await service.delete("token", created.id), { deleted: true, id: created.id });
  assert.equal(storageProvider.files.size, 0);
});
test("supports internal secretary approve, reject and listPending without routes", async () => {
  const { service } = setup();
  const first = await service.upload("token", { file: pdf(Buffer.from("%PDF- first")), type: "CPF" });
  const second = await service.upload("token", { file: pdf(Buffer.from("%PDF- second")), type: "RG" });
  assert.equal((await service.listPending()).length, 2);
  assert.equal(await service.approve(first.id), true);
  assert.equal(await service.reject(second.id, "ilegivel"), true);
  await assert.rejects(() => service.delete("token", first.id), { code: "DIGITAL_ENROLLMENT_DOCUMENT_CONFLICT" });
});
test("propagates fail-closed invitation, ownership and enrollment status failures", async (t) => {
  for (const code of ["INVITATION_EXPIRED", "OWNERSHIP_INVALID", "ENROLLMENT_ACTIVE", "ENROLLMENT_CANCELLED", "ENROLLMENT_FINISHED"]) {
    await t.test(code, async () => {
      const failure = Object.assign(new Error(code), { code, statusCode: 404 });
      const options = code === "INVITATION_EXPIRED"
        ? { invitationResolver: { async resolveInvitationByRawToken() { throw failure; } } }
        : { accessGateway: { async resolveDocumentAccess() { throw failure; } } };
      await assert.rejects(() => setup(options).service.list("token"), { code });
    });
  }
});
