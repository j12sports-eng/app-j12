const DIGITAL_ENROLLMENT_ACTIVATION_READINESS_BLOCKERS = Object.freeze({
  ADMINISTRATIVE_REVIEW_NOT_APPROVED: "ADMINISTRATIVE_REVIEW_NOT_APPROVED",
  CONTRACT_NOT_ACCEPTED: "CONTRACT_NOT_ACCEPTED",
  DOCUMENTS_INCOMPLETE: "DOCUMENTS_INCOMPLETE",
  ENROLLMENT_NOT_DRAFT: "ENROLLMENT_NOT_DRAFT",
  PROGRESS_NOT_READY_FOR_REVIEW: "PROGRESS_NOT_READY_FOR_REVIEW",
  WORKFLOW_NOT_APPROVED_PENDING_ACTIVATION: "WORKFLOW_NOT_APPROVED_PENDING_ACTIVATION",
});

const PRECONDITIONS = Object.freeze([
  Object.freeze({
    blocker: DIGITAL_ENROLLMENT_ACTIVATION_READINESS_BLOCKERS.ENROLLMENT_NOT_DRAFT,
    satisfied: (evidence) => normalizedStatus(evidence.enrollmentStatus) === "DRAFT",
  }),
  Object.freeze({
    blocker: DIGITAL_ENROLLMENT_ACTIVATION_READINESS_BLOCKERS.PROGRESS_NOT_READY_FOR_REVIEW,
    satisfied: (evidence) => normalizedStatus(evidence.progressStatus) === "READY_FOR_REVIEW",
  }),
  Object.freeze({
    blocker: DIGITAL_ENROLLMENT_ACTIVATION_READINESS_BLOCKERS.DOCUMENTS_INCOMPLETE,
    satisfied: (evidence) => evidence.documentsComplete === true,
  }),
  Object.freeze({
    blocker: DIGITAL_ENROLLMENT_ACTIVATION_READINESS_BLOCKERS.CONTRACT_NOT_ACCEPTED,
    satisfied: (evidence) => evidence.contractAccepted === true,
  }),
  Object.freeze({
    blocker: DIGITAL_ENROLLMENT_ACTIVATION_READINESS_BLOCKERS.ADMINISTRATIVE_REVIEW_NOT_APPROVED,
    satisfied: (evidence) => normalizedStatus(evidence.administrativeReviewStatus) === "APPROVED",
  }),
  Object.freeze({
    blocker:
      DIGITAL_ENROLLMENT_ACTIVATION_READINESS_BLOCKERS.WORKFLOW_NOT_APPROVED_PENDING_ACTIVATION,
    satisfied: (evidence) =>
      normalizedStatus(evidence.workflowStatus) === "APPROVED_PENDING_ACTIVATION",
  }),
]);

class DigitalEnrollmentActivationReadinessPolicy {
  evaluate(evidence = {}) {
    const safeEvidence =
      evidence && typeof evidence === "object" && !Array.isArray(evidence) ? evidence : {};
    const blockers = PRECONDITIONS.filter(
      (precondition) => !precondition.satisfied(safeEvidence),
    ).map((precondition) => precondition.blocker);

    return Object.freeze({
      blockers: Object.freeze(blockers),
      ready: blockers.length === 0,
    });
  }
}

function normalizedStatus(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

module.exports = {
  DIGITAL_ENROLLMENT_ACTIVATION_READINESS_BLOCKERS,
  DigitalEnrollmentActivationReadinessPolicy,
};
