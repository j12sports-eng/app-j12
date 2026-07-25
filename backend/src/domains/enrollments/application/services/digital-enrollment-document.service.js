const { createHash, randomUUID } = require("node:crypto");
const path = require("node:path");
const { DOCUMENT_TYPES } = require("../../domain/entities/digital-enrollment-document.entity.js");

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MIME_EXTENSIONS = Object.freeze({
  "application/pdf": Object.freeze([".pdf"]),
  "image/jpeg": Object.freeze([".jpg", ".jpeg"]),
  "image/png": Object.freeze([".png"]),
  "image/webp": Object.freeze([".webp"]),
});

class DigitalEnrollmentDocumentService {
  constructor({ accessGateway, invitationResolver, repository, storageProvider } = {}) {
    this.accessGateway = accessGateway;
    this.invitationResolver = invitationResolver;
    this.repository = repository;
    this.storageProvider = storageProvider;
  }
  async upload(rawToken, input = {}) {
    const access = await this.resolveAccess(rawToken);
    const file = validateFile(input.file);
    if (!DOCUMENT_TYPES.includes(input.type)) throw invalid("Document type is invalid.");
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    const storageKey = randomUUID();
    await this.storageProvider.put({ buffer: file.buffer, key: storageKey });
    try {
      return toDto(await this.repository.create({
        enrollmentId: access.enrollmentId, responsibleRelationshipId: access.responsibleRelationshipId,
        type: input.type, originalName: path.basename(file.originalname).slice(0, 255),
        mimeType: file.mimetype, extension: path.extname(file.originalname).toLowerCase(),
        sizeBytes: file.size, sha256, storageKey,
      }));
    } catch (error) {
      await this.storageProvider.delete(storageKey);
      throw error;
    }
  }
  async list(rawToken) {
    const access = await this.resolveAccess(rawToken);
    return Promise.all((await this.repository.listByEnrollment(access.enrollmentId, access.responsibleRelationshipId)).map(toDto));
  }
  async download(rawToken, id) {
    const access = await this.resolveAccess(rawToken);
    const document = await this.repository.findOwnedById(id, access.enrollmentId, access.responsibleRelationshipId);
    if (!document) throw notFound();
    const buffer = await this.storageProvider.get(document.storageKey);
    if (!buffer) throw notFound();
    return { buffer, document: toDto(document) };
  }
  async delete(rawToken, id) {
    const access = await this.resolveAccess(rawToken);
    const document = await this.repository.findOwnedById(id, access.enrollmentId, access.responsibleRelationshipId);
    if (!document) throw notFound();
    if (document.status === "APPROVED") throw conflict("Approved documents cannot be deleted.");
    const deleted = await this.repository.deleteOwnedById(id, access.enrollmentId, access.responsibleRelationshipId);
    if (!deleted) throw conflict("Document changed before deletion.");
    await this.storageProvider.delete(document.storageKey);
    return { deleted: true, id: document.id };
  }
  async approve(id, options) { return this.repository.approve(id, options); }
  async reject(id, reason, options) { return this.repository.reject(id, reason, options); }
  async listPending() { return this.repository.listPending(); }
  async resolveAccess(rawToken) {
    if (!this.invitationResolver?.resolveInvitationByRawToken || !this.accessGateway?.resolveDocumentAccess) throw unavailable();
    const invitation = await this.invitationResolver.resolveInvitationByRawToken({ rawToken });
    return this.accessGateway.resolveDocumentAccess(invitation);
  }
}
function validateFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || !file.originalname) throw invalid("A multipart file is required.");
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_DOCUMENT_SIZE_BYTES) throw tooLarge();
  const extension = path.extname(file.originalname).toLowerCase();
  if (!MIME_EXTENSIONS[file.mimetype]?.includes(extension)) throw invalid("MIME type and extension do not match.");
  if (!matchesSignature(file.mimetype, file.buffer)) throw invalid("File content does not match its MIME type.");
  return file;
}
function matchesSignature(mimeType, buffer) {
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}
function toDto(document) {
  return Object.freeze({
    id: document.id, type: document.type, status: document.status, originalName: document.originalName,
    mimeType: document.mimeType, extension: document.extension, sizeBytes: document.sizeBytes,
    sha256: document.sha256, rejectionReason: document.rejectionReason,
  });
}
function invalid(message) { const e = new Error(message); e.code = "DIGITAL_ENROLLMENT_DOCUMENT_INVALID"; e.statusCode = 400; return e; }
function tooLarge() { const e = invalid("Document exceeds the size limit."); e.code = "DIGITAL_ENROLLMENT_DOCUMENT_TOO_LARGE"; e.statusCode = 413; return e; }
function conflict(message) { const e = new Error(message); e.code = "DIGITAL_ENROLLMENT_DOCUMENT_CONFLICT"; e.statusCode = 409; return e; }
function notFound() { const e = new Error("Document not found."); e.code = "DIGITAL_ENROLLMENT_DOCUMENT_NOT_FOUND"; e.statusCode = 404; return e; }
function unavailable() { const e = new Error("Digital enrollment documents unavailable."); e.code = "DIGITAL_ENROLLMENT_DOCUMENTS_UNAVAILABLE"; e.statusCode = 404; return e; }
module.exports = { DigitalEnrollmentDocumentService, MAX_DOCUMENT_SIZE_BYTES, MIME_EXTENSIONS, validateFile };
