const DOCUMENT_STATUSES = Object.freeze(["PENDING", "APPROVED", "REJECTED"]);
const DOCUMENT_TYPES = Object.freeze([
  "CPF",
  "RG",
  "CERTIDAO_NASCIMENTO",
  "COMPROVANTE_RESIDENCIA",
  "FOTO",
  "OUTRO",
]);

class DigitalEnrollmentDocument {
  constructor(input = {}) {
    this.id = required(input.id, "id");
    this.enrollmentId = required(input.enrollmentId, "enrollmentId");
    this.responsibleRelationshipId = required(
      input.responsibleRelationshipId,
      "responsibleRelationshipId",
    );
    this.type = allowed(input.type, DOCUMENT_TYPES, "type");
    this.status = allowed(input.status || "PENDING", DOCUMENT_STATUSES, "status");
    this.originalName = required(input.originalName, "originalName");
    this.mimeType = required(input.mimeType, "mimeType");
    this.extension = required(input.extension, "extension");
    this.sizeBytes = positive(input.sizeBytes, "sizeBytes");
    this.sha256 = /^[a-f0-9]{64}$/.test(String(input.sha256 || "")) ? input.sha256 : invalid("sha256");
    this.storageKey = required(input.storageKey, "storageKey");
    this.rejectionReason = input.rejectionReason || null;
    Object.freeze(this);
  }
}
function required(value, field) {
  const result = String(value || "").trim();
  if (!result) throw new TypeError(`${field} is required.`);
  return result;
}
function allowed(value, values, field) {
  if (!values.includes(value)) throw new TypeError(`${field} is invalid.`);
  return value;
}
function positive(value, field) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1) throw new TypeError(`${field} is invalid.`);
  return result;
}
function invalid(field) {
  throw new TypeError(`${field} is invalid.`);
}
module.exports = { DOCUMENT_STATUSES, DOCUMENT_TYPES, DigitalEnrollmentDocument };
