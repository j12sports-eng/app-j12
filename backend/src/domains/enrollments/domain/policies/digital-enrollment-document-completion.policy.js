const {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
} = require("../entities/digital-enrollment-document.entity.js");

const DIGITAL_ENROLLMENT_DOCUMENT_POLICY_NOT_CONFIGURED =
  "DIGITAL_ENROLLMENT_DOCUMENT_POLICY_NOT_CONFIGURED";
const DIGITAL_ENROLLMENT_DOCUMENT_TYPE_UNSUPPORTED = "DIGITAL_ENROLLMENT_DOCUMENT_TYPE_UNSUPPORTED";

class DigitalEnrollmentDocumentCompletionPolicy {
  evaluate({ requiredDocumentTypes, documents = [] } = {}) {
    if (!Array.isArray(requiredDocumentTypes)) {
      return result({
        blocker: DIGITAL_ENROLLMENT_DOCUMENT_POLICY_NOT_CONFIGURED,
        complete: false,
      });
    }

    const requiredTypes = normalizeRequiredTypes(requiredDocumentTypes);
    const documentStates = collectDocumentStates(documents);
    const submittedTypes = requiredTypes.filter((type) => documentStates.get(type)?.valid);
    const missingTypes = requiredTypes.filter((type) => !documentStates.get(type)?.valid);
    const rejectedTypes = requiredTypes.filter((type) => documentStates.get(type)?.rejected);

    return result({
      blocker: null,
      complete: missingTypes.length === 0,
      missingTypes,
      rejectedTypes,
      requiredTypes,
      submittedTypes,
    });
  }
}

function normalizeRequiredTypes(requiredDocumentTypes) {
  const normalized = new Set();
  for (const value of requiredDocumentTypes) {
    const type = String(value || "").trim();
    if (!DOCUMENT_TYPES.includes(type)) throw unsupportedType();
    normalized.add(type);
  }
  return DOCUMENT_TYPES.filter((type) => normalized.has(type));
}

function collectDocumentStates(documents) {
  if (!Array.isArray(documents)) throw new TypeError("documents must be an array.");
  const states = new Map();
  for (const document of documents) {
    if (!document || !DOCUMENT_TYPES.includes(document.type)) continue;
    if (!DOCUMENT_STATUSES.includes(document.status)) continue;
    const current = states.get(document.type) || { rejected: false, valid: false };
    states.set(document.type, {
      rejected: current.rejected || document.status === "REJECTED",
      valid: current.valid || document.status !== "REJECTED",
    });
  }
  return states;
}

function result({
  blocker,
  complete,
  missingTypes = [],
  rejectedTypes = [],
  requiredTypes = [],
  submittedTypes = [],
}) {
  return Object.freeze({
    blocker,
    complete,
    missingTypes: Object.freeze([...missingTypes]),
    rejectedTypes: Object.freeze([...rejectedTypes]),
    requiredTypes: Object.freeze([...requiredTypes]),
    submittedTypes: Object.freeze([...submittedTypes]),
  });
}

function unsupportedType() {
  return Object.assign(new TypeError("Digital enrollment document type is unsupported."), {
    code: DIGITAL_ENROLLMENT_DOCUMENT_TYPE_UNSUPPORTED,
  });
}

module.exports = Object.freeze({
  DIGITAL_ENROLLMENT_DOCUMENT_POLICY_NOT_CONFIGURED,
  DIGITAL_ENROLLMENT_DOCUMENT_TYPE_UNSUPPORTED,
  DigitalEnrollmentDocumentCompletionPolicy,
});
