const { randomUUID } = require("node:crypto");
const { DigitalEnrollmentDocument } = require("../../domain/entities/digital-enrollment-document.entity.js");

class MemoryDigitalEnrollmentDocumentRepository {
  constructor(seed = []) { this.items = new Map(seed.map((item) => [item.id, new DigitalEnrollmentDocument(item)])); }
  async create(input) {
    if ([...this.items.values()].some((item) => item.enrollmentId === input.enrollmentId && item.sha256 === input.sha256)) {
      const error = new Error("Document already exists.");
      error.code = "DIGITAL_ENROLLMENT_DOCUMENT_DUPLICATE";
      error.statusCode = 409;
      throw error;
    }
    const document = new DigitalEnrollmentDocument({ ...input, id: input.id || randomUUID() });
    this.items.set(document.id, document);
    return document;
  }
  async listByEnrollment(enrollmentId, relationshipId) { return [...this.items.values()].filter((item) => item.enrollmentId === enrollmentId && item.responsibleRelationshipId === relationshipId); }
  async findOwnedById(id, enrollmentId, relationshipId) { const item = this.items.get(id); return item?.enrollmentId === enrollmentId && item?.responsibleRelationshipId === relationshipId ? item : null; }
  async deleteOwnedById(id, enrollmentId, relationshipId) {
    const item = await this.findOwnedById(id, enrollmentId, relationshipId);
    return item && item.status !== "APPROVED" ? this.items.delete(id) : false;
  }
  async approve(id) { return this.changeStatus(id, "APPROVED"); }
  async reject(id, reason) { return this.changeStatus(id, "REJECTED", reason); }
  async changeStatus(id, status, rejectionReason = null) {
    const current = this.items.get(id);
    if (!current || current.status !== "PENDING") return false;
    this.items.set(id, new DigitalEnrollmentDocument({ ...current, status, rejectionReason }));
    return true;
  }
  async listPending() { return [...this.items.values()].filter((item) => item.status === "PENDING"); }
}
module.exports = { MemoryDigitalEnrollmentDocumentRepository };
