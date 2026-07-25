const { randomUUID } = require("node:crypto");
const { DigitalEnrollmentDocument } = require("../../domain/entities/digital-enrollment-document.entity.js");

class MySqlDigitalEnrollmentDocumentRepository {
  constructor({ queryRunner = null } = {}) {
    this.query = queryRunner || require("../../../../config/db.js").query;
  }
  async create(input, queryRunner = this.query) {
    const document = new DigitalEnrollmentDocument({ ...input, id: input.id || randomUUID() });
    try {
      await queryRunner(
        `INSERT INTO digital_enrollment_documents
          (id,enrollment_id,responsible_relationship_id,type,status,original_name,mime_type,extension,size_bytes,sha256,storage_key)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [document.id, document.enrollmentId, document.responsibleRelationshipId, document.type, document.status, document.originalName, document.mimeType, document.extension, document.sizeBytes, document.sha256, document.storageKey],
      );
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") throw duplicate();
      throw persistence();
    }
    return document;
  }
  async listByEnrollment(enrollmentId, relationshipId, queryRunner = this.query) {
    const rows = await queryRunner(
      "SELECT * FROM digital_enrollment_documents WHERE enrollment_id=? AND responsible_relationship_id=? ORDER BY created_at DESC",
      [required(enrollmentId), required(relationshipId)],
    );
    return rows.map(map);
  }
  async findOwnedById(id, enrollmentId, relationshipId, queryRunner = this.query) {
    const rows = await queryRunner(
      "SELECT * FROM digital_enrollment_documents WHERE id=? AND enrollment_id=? AND responsible_relationship_id=? LIMIT 1",
      [required(id), required(enrollmentId), required(relationshipId)],
    );
    return map(rows[0]);
  }
  async deleteOwnedById(id, enrollmentId, relationshipId, queryRunner = this.query) {
    const result = await queryRunner(
      "DELETE FROM digital_enrollment_documents WHERE id=? AND enrollment_id=? AND responsible_relationship_id=? AND status IN ('PENDING','REJECTED') LIMIT 1",
      [required(id), required(enrollmentId), required(relationshipId)],
    );
    return Number(result?.affectedRows) === 1;
  }
  async approve(id, { reviewedBy = null } = {}, queryRunner = this.query) {
    return this.review(id, "APPROVED", null, reviewedBy, queryRunner);
  }
  async reject(id, reason, { reviewedBy = null } = {}, queryRunner = this.query) {
    if (!String(reason || "").trim()) throw new TypeError("rejection reason is required.");
    return this.review(id, "REJECTED", String(reason).trim().slice(0, 500), reviewedBy, queryRunner);
  }
  async review(id, status, reason, reviewedBy, queryRunner) {
    const result = await queryRunner(
      "UPDATE digital_enrollment_documents SET status=?,rejection_reason=?,reviewed_at=CURRENT_TIMESTAMP,reviewed_by=? WHERE id=? AND status='PENDING' LIMIT 1",
      [status, reason, reviewedBy, required(id)],
    );
    return Number(result?.affectedRows) === 1;
  }
  async listPending(queryRunner = this.query) {
    const rows = await queryRunner("SELECT * FROM digital_enrollment_documents WHERE status='PENDING' ORDER BY created_at ASC");
    return rows.map(map);
  }
}
function map(row) {
  if (!row) return null;
  return new DigitalEnrollmentDocument({
    id: row.id, enrollmentId: row.enrollment_id, responsibleRelationshipId: row.responsible_relationship_id,
    type: row.type, status: row.status, originalName: row.original_name, mimeType: row.mime_type,
    extension: row.extension, sizeBytes: Number(row.size_bytes), sha256: row.sha256,
    storageKey: row.storage_key, rejectionReason: row.rejection_reason,
  });
}
function required(value) {
  const result = String(value || "").trim();
  if (!result) throw new TypeError("identifier is required.");
  return result;
}
function duplicate() {
  const error = new Error("Document already exists.");
  error.code = "DIGITAL_ENROLLMENT_DOCUMENT_DUPLICATE";
  error.statusCode = 409;
  return error;
}
function persistence() {
  const error = new Error("Document persistence failed.");
  error.code = "DIGITAL_ENROLLMENT_DOCUMENT_PERSISTENCE_FAILED";
  return error;
}
module.exports = { MySqlDigitalEnrollmentDocumentRepository };
