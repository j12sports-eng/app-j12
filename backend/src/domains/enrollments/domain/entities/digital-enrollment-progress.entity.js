const DIGITAL_ENROLLMENT_PROGRESS_STATUSES = Object.freeze([
  "NOT_STARTED",
  "IN_PROGRESS",
  "READY_FOR_REVIEW",
]);
const DIGITAL_ENROLLMENT_STEPS = Object.freeze([
  "RESPONSIBLE_DATA",
  "STUDENT_DATA",
  "ADDRESS",
  "ADDITIONAL_INFORMATION",
  "DOCUMENTS",
  "REVIEW",
]);
const REQUIRED_REVIEW_STEPS = DIGITAL_ENROLLMENT_STEPS.slice(0, 5);

class DigitalEnrollmentProgress {
  constructor(input = {}) {
    this.enrollmentId = required(input.enrollmentId, "enrollmentId");
    this.responsibleRelationshipId = required(
      input.responsibleRelationshipId,
      "responsibleRelationshipId",
    );
    this.currentStep = allowed(
      input.currentStep || "RESPONSIBLE_DATA",
      DIGITAL_ENROLLMENT_STEPS,
      "currentStep",
    );
    this.completedSteps = Object.freeze(
      [...new Set(input.completedSteps || [])].map((step) =>
        allowed(step, DIGITAL_ENROLLMENT_STEPS, "completedSteps"),
      ),
    );
    this.status = allowed(
      input.status || "NOT_STARTED",
      DIGITAL_ENROLLMENT_PROGRESS_STATUSES,
      "status",
    );
    this.revision = positive(input.revision || 1, "revision");
    this.schemaVersion = positive(input.schemaVersion || 1, "schemaVersion");
    this.startedAt = input.startedAt || null;
    this.lastSavedAt = input.lastSavedAt || null;
    this.readyForReviewAt = input.readyForReviewAt || null;
    this.updatedByInvitationId = input.updatedByInvitationId || null;

    if (
      this.status === "READY_FOR_REVIEW" &&
      !REQUIRED_REVIEW_STEPS.every((step) => this.completedSteps.includes(step))
    ) {
      throw new TypeError("READY_FOR_REVIEW requires every editable step.");
    }
    Object.freeze(this);
  }
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}
function allowed(value, values, field) {
  if (!values.includes(value)) throw new TypeError(`${field} is invalid.`);
  return value;
}
function positive(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new TypeError(`${field} is invalid.`);
  return number;
}

module.exports = {
  DIGITAL_ENROLLMENT_PROGRESS_STATUSES,
  DIGITAL_ENROLLMENT_STEPS,
  DigitalEnrollmentProgress,
  REQUIRED_REVIEW_STEPS,
};
