const REVIEW_STATUSES = Object.freeze({
  APPROVED: "APPROVED",
  CORRECTION_REQUESTED: "CORRECTION_REQUESTED",
  PENDING_REVIEW: "PENDING_REVIEW",
  REJECTED: "REJECTED",
});

const CORRECTION_DECISION_CODES = Object.freeze([
  "RESPONSIBLE_DATA_CORRECTION",
  "STUDENT_DATA_CORRECTION",
  "ADDRESS_CORRECTION",
  "ADDITIONAL_INFORMATION_CORRECTION",
  "DOCUMENT_CORRECTION",
  "CONTRACT_CORRECTION",
]);
const REJECTION_DECISION_CODES = Object.freeze([
  "INVALID_INFORMATION",
  "INVALID_DOCUMENTATION",
  "DUPLICATE_ENROLLMENT",
  "INELIGIBLE_APPLICATION",
  "OTHER_REVIEW_REASON",
]);
const CORRECTION_ITEMS = Object.freeze([
  "RESPONSIBLE_DATA",
  "STUDENT_DATA",
  "ADDRESS",
  "ADDITIONAL_INFORMATION",
  "DOCUMENTS",
  "CONTRACT",
]);

class DigitalEnrollmentAdministrativeReview {
  constructor(input = {}) {
    this.id = required(input.id, "id");
    this.enrollmentId = required(input.enrollmentId, "enrollmentId");
    this.responsibleRelationshipId = required(
      input.responsibleRelationshipId,
      "responsibleRelationshipId",
    );
    this.status = allowed(
      input.status || REVIEW_STATUSES.PENDING_REVIEW,
      Object.values(REVIEW_STATUSES),
      "status",
    );
    this.revision = positive(input.revision || 1, "revision");
    this.reviewRound = positive(input.reviewRound || 1, "reviewRound");
    this.submittedAt = required(input.submittedAt, "submittedAt");
    this.decidedAt = nullable(input.decidedAt);
    this.reviewerAuthIdentityId = nullable(input.reviewerAuthIdentityId);
    this.decisionCode = nullable(input.decisionCode);
    this.decisionReason = normalizeReason(input.decisionReason);
    this.correctionItems = Object.freeze(normalizeItems(input.correctionItems || []));
    this.createdAt = required(input.createdAt, "createdAt");
    this.updatedAt = required(input.updatedAt, "updatedAt");
    Object.freeze(this);
  }

  decide({ decisionCode, decisionReason, reviewerAuthIdentityId, status, now }) {
    if (this.status !== REVIEW_STATUSES.PENDING_REVIEW) throw invalidTransition();
    const codeAllowlist =
      status === REVIEW_STATUSES.CORRECTION_REQUESTED
        ? CORRECTION_DECISION_CODES
        : status === REVIEW_STATUSES.REJECTED
          ? REJECTION_DECISION_CODES
          : status === REVIEW_STATUSES.APPROVED
            ? ["APPROVED"]
            : [];
    const normalizedCode = allowed(decisionCode, codeAllowlist, "decisionCode");
    const reason = normalizeReason(decisionReason);
    if (normalizedCode === "OTHER_REVIEW_REASON" && !reason) {
      throw invalid("decisionReason is required.");
    }
    return new DigitalEnrollmentAdministrativeReview({
      ...this,
      correctionItems: status === REVIEW_STATUSES.CORRECTION_REQUESTED
        ? this.correctionItems
        : [],
      decidedAt: now,
      decisionCode: normalizedCode,
      decisionReason: reason,
      reviewerAuthIdentityId: required(reviewerAuthIdentityId, "reviewerAuthIdentityId"),
      revision: this.revision + 1,
      status,
      updatedAt: now,
    });
  }

  requestCorrection(input) {
    const correctionItems = normalizeItems(input.correctionItems);
    if (correctionItems.length === 0) throw invalid("correctionItems are required.");
    return new DigitalEnrollmentAdministrativeReview({
      ...this.decide({ ...input, status: REVIEW_STATUSES.CORRECTION_REQUESTED }),
      correctionItems,
    });
  }

  resubmit({ correctionItems, now }) {
    if (this.status !== REVIEW_STATUSES.CORRECTION_REQUESTED) throw invalidTransition();
    const declared = normalizeItems(correctionItems);
    if (declared.length === 0) throw invalid("corrected items are required.");
    if (declared.some((item) => !this.correctionItems.includes(item))) {
      throw invalid("corrected items must match requested corrections.");
    }
    return new DigitalEnrollmentAdministrativeReview({
      ...this,
      correctionItems: [],
      decidedAt: null,
      decisionCode: null,
      decisionReason: null,
      reviewerAuthIdentityId: null,
      reviewRound: this.reviewRound + 1,
      revision: this.revision + 1,
      status: REVIEW_STATUSES.PENDING_REVIEW,
      submittedAt: now,
      updatedAt: now,
    });
  }
}

function normalizeItems(items) {
  if (!Array.isArray(items)) throw invalid("correctionItems must be an array.");
  const normalized = [...new Set(items.map((item) => String(item || "").trim().toUpperCase()))];
  if (normalized.some((item) => !CORRECTION_ITEMS.includes(item))) {
    throw invalid("correctionItems contains an unsupported item.");
  }
  return normalized;
}
function normalizeReason(value) {
  const reason = nullable(value);
  if (!reason) return null;
  if (reason.length > 500) throw invalid("decisionReason is too long.");
  if (/<[^>]*>|authorization|bearer\s|token/i.test(reason)) {
    throw invalid("decisionReason contains prohibited content.");
  }
  return reason.replace(/\s+/g, " ");
}
function required(value, field) {
  const result = nullable(value);
  if (!result) throw invalid(`${field} is required.`);
  return result;
}
function nullable(value) {
  const result = String(value ?? "").trim();
  return result || null;
}
function positive(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) throw invalid(`${field} is invalid.`);
  return value;
}
function allowed(value, values, field) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!values.includes(normalized)) throw invalid(`${field} is invalid.`);
  return normalized;
}
function invalid(message) {
  const error = new Error(message);
  error.code = "DIGITAL_ENROLLMENT_REVIEW_INVALID_COMMAND";
  error.statusCode = 400;
  return error;
}
function invalidTransition() {
  const error = new Error("Digital enrollment review transition is invalid.");
  error.code = "DIGITAL_ENROLLMENT_REVIEW_INVALID_TRANSITION";
  error.statusCode = 409;
  return error;
}

module.exports = {
  CORRECTION_DECISION_CODES,
  CORRECTION_ITEMS,
  DigitalEnrollmentAdministrativeReview,
  REJECTION_DECISION_CODES,
  REVIEW_STATUSES,
  invalid,
  invalidTransition,
};
