const {
  DigitalEnrollmentDocumentCompletionPolicy,
} = require("../../domain/policies/digital-enrollment-document-completion.policy.js");

const DIGITAL_ENROLLMENT_DOCUMENT_REPOSITORY_UNAVAILABLE =
  "DIGITAL_ENROLLMENT_DOCUMENT_REPOSITORY_UNAVAILABLE";

class EvaluateDigitalEnrollmentDocumentCompletionService {
  constructor({ policy = new DigitalEnrollmentDocumentCompletionPolicy(), repository } = {}) {
    this.policy = policy;
    this.repository = repository;
  }

  async execute({ enrollmentId, requiredDocumentTypes, responsibleRelationshipId } = {}) {
    const ownedEnrollmentId = required(enrollmentId, "enrollmentId");
    const ownedRelationshipId = required(responsibleRelationshipId, "responsibleRelationshipId");
    if (typeof this.repository?.listByEnrollment !== "function") throw repositoryUnavailable();

    const documents = await this.repository.listByEnrollment(
      ownedEnrollmentId,
      ownedRelationshipId,
    );
    return this.policy.evaluate({ documents, requiredDocumentTypes });
  }
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}
function repositoryUnavailable() {
  const error = new Error("Digital enrollment document repository is unavailable.");
  error.code = DIGITAL_ENROLLMENT_DOCUMENT_REPOSITORY_UNAVAILABLE;
  error.statusCode = 503;
  error.expose = false;
  return error;
}

module.exports = {
  DIGITAL_ENROLLMENT_DOCUMENT_REPOSITORY_UNAVAILABLE,
  EvaluateDigitalEnrollmentDocumentCompletionService,
};