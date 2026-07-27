const {
  DigitalEnrollmentReviewEligibilityPolicy,
} = require("../../domain/policies/digital-enrollment-review-eligibility.policy.js");

const DIGITAL_ENROLLMENT_WORKFLOW_NOT_CONFIGURED = "DIGITAL_ENROLLMENT_WORKFLOW_NOT_CONFIGURED";
const DIGITAL_ENROLLMENT_WORKFLOW_NOT_FOUND = "DIGITAL_ENROLLMENT_WORKFLOW_NOT_FOUND";
const DIGITAL_ENROLLMENT_WORKFLOW_FORBIDDEN = "DIGITAL_ENROLLMENT_WORKFLOW_FORBIDDEN";
const DIGITAL_ENROLLMENT_WORKFLOW_OWNERSHIP_CONFLICT =
  "DIGITAL_ENROLLMENT_WORKFLOW_OWNERSHIP_CONFLICT";
const DIGITAL_ENROLLMENT_WORKFLOW_ACTIVATION_BLOCKED =
  "DIGITAL_ENROLLMENT_WORKFLOW_ACTIVATION_BLOCKED";

const DIGITAL_ENROLLMENT_WORKFLOW_STATUSES = Object.freeze({
  APPROVED_PENDING_ACTIVATION: "APPROVED_PENDING_ACTIVATION",
  CORRECTION_REQUESTED: "CORRECTION_REQUESTED",
  NOT_READY_FOR_REVIEW: "NOT_READY_FOR_REVIEW",
  PENDING_REVIEW: "PENDING_REVIEW",
  READY_FOR_REVIEW: "READY_FOR_REVIEW",
  REJECTED: "REJECTED",
});

/**
 * Coordinates the administrative review without changing the canonical
 * Enrollment status or triggering activation side effects.
 */
class DigitalEnrollmentAdministrativeWorkflowService {
  constructor({
    administrativeReviewService = null,
    authorizationPolicy = null,
    contractAcceptanceReader = null,
    documentCompletionService = null,
    enrollmentReader = null,
    eligibilityPolicy = new DigitalEnrollmentReviewEligibilityPolicy(),
    progressReader = null,
    requiredDocumentTypes = null,
  } = {}) {
    Object.assign(this, {
      administrativeReviewService,
      authorizationPolicy,
      contractAcceptanceReader,
      documentCompletionService,
      enrollmentReader,
      eligibilityPolicy,
      progressReader,
      requiredDocumentTypes: Array.isArray(requiredDocumentTypes)
        ? Object.freeze([...requiredDocumentTypes])
        : null,
    });
  }

  async getCurrentSituation(command = {}) {
    const input = baseCommand(command);
    await this.authorize("GET_ADMINISTRATIVE_WORKFLOW_STATUS", input.actorAuthIdentityId);

    const [enrollment, progress, review] = await Promise.all([
      this.loadEnrollment(input.enrollmentId),
      this.loadProgress(input.enrollmentId),
      this.loadOptionalReview(input),
    ]);

    assertOwnership(progress, command.responsibleRelationshipId);

    return toSituationDto({ enrollment, progress, review });
  }

  async evaluateReviewEligibility(command = {}) {
    const input = baseCommand(command);
    await this.authorize("EVALUATE_ADMINISTRATIVE_REVIEW_ELIGIBILITY", input.actorAuthIdentityId);

    return this.evaluateEligibilityEvidence(input, command);
  }

  async startReview(command = {}) {
    const input = baseCommand(command);
    await this.authorize("START_ADMINISTRATIVE_REVIEW_WORKFLOW", input.actorAuthIdentityId);

    const assessment = await this.evaluateEligibilityEvidence(input, command);
    const service = this.getAdministrativeReviewService("startReview");
    const review = await service.startReview({
      actorAuthIdentityId: input.actorAuthIdentityId,
      commandId: required(command.commandId, "commandId"),
      eligibility: assessment.evidence,
      enrollmentId: input.enrollmentId,
      responsibleRelationshipId: assessment.responsibleRelationshipId,
    });

    return this.toOperationDto(review, assessment.enrollment);
  }

  async approveReview(command = {}) {
    return this.forwardDecision("APPROVE_ADMINISTRATIVE_REVIEW_WORKFLOW", "approveReview", command);
  }

  async requestCorrection(command = {}) {
    return this.forwardDecision(
      "REQUEST_ADMINISTRATIVE_REVIEW_CORRECTION_WORKFLOW",
      "requestCorrection",
      command,
    );
  }

  async rejectReview(command = {}) {
    return this.forwardDecision("REJECT_ADMINISTRATIVE_REVIEW_WORKFLOW", "rejectReview", command);
  }

  async resubmitForReview(command = {}) {
    const input = baseCommand(command);
    await this.authorize("RESUBMIT_ADMINISTRATIVE_REVIEW_WORKFLOW", input.actorAuthIdentityId);

    const enrollment = await this.loadEnrollment(input.enrollmentId);
    const service = this.getAdministrativeReviewService("resubmitForReview");
    const review = await service.resubmitForReview({ ...command, ...input });

    return this.toOperationDto(review, enrollment);
  }

  async activateEnrollment(command = {}) {
    const input = baseCommand(command);
    await this.authorize(
      "ACTIVATE_ENROLLMENT_FROM_ADMINISTRATIVE_REVIEW",
      input.actorAuthIdentityId,
    );

    const error = controlledError(
      "Administrative approval does not activate Enrollment.",
      DIGITAL_ENROLLMENT_WORKFLOW_ACTIVATION_BLOCKED,
      409,
    );
    error.enrollmentId = input.enrollmentId;
    error.requiredWorkflowStatus = DIGITAL_ENROLLMENT_WORKFLOW_STATUSES.APPROVED_PENDING_ACTIVATION;
    throw error;
  }

  async forwardDecision(action, method, command = {}) {
    const input = baseCommand(command);
    await this.authorize(action, input.actorAuthIdentityId);

    const enrollment = await this.loadEnrollment(input.enrollmentId);
    const service = this.getAdministrativeReviewService(method);
    const review = await service[method]({ ...command, ...input });

    return this.toOperationDto(review, enrollment);
  }

  async evaluateEligibilityEvidence(input, command) {
    const [enrollment, progress] = await Promise.all([
      this.loadEnrollment(input.enrollmentId),
      this.loadProgress(input.enrollmentId),
    ]);
    const responsibleRelationshipId = assertOwnership(progress, command.responsibleRelationshipId);

    if (!this.requiredDocumentTypes) {
      throw notConfigured();
    }
    if (typeof this.documentCompletionService?.execute !== "function") {
      throw notConfigured();
    }
    if (typeof this.contractAcceptanceReader?.getAcceptanceStatus !== "function") {
      throw notConfigured();
    }
    if (typeof this.eligibilityPolicy?.evaluate !== "function") {
      throw notConfigured();
    }

    const [documentCompletion, contractAcceptance] = await Promise.all([
      this.documentCompletionService.execute({
        enrollmentId: input.enrollmentId,
        requiredDocumentTypes: [...this.requiredDocumentTypes],
        responsibleRelationshipId,
      }),
      this.contractAcceptanceReader.getAcceptanceStatus({
        enrollmentId: input.enrollmentId,
        responsibleRelationshipId,
      }),
    ]);
    const evidence = Object.freeze({
      contractAccepted: contractAcceptance?.accepted === true,
      documentsComplete: documentCompletion?.complete === true,
      enrollmentStatus: readText(enrollment, "status"),
      progressEligible: readText(progress, "status") === "READY_FOR_REVIEW",
    });

    this.eligibilityPolicy.evaluate(evidence);

    return Object.freeze({
      eligible: true,
      enrollment,
      evidence,
      responsibleRelationshipId,
    });
  }

  async loadEnrollment(enrollmentId) {
    const reader = this.enrollmentReader;
    let enrollment = null;

    if (typeof reader?.findById === "function") {
      enrollment = await reader.findById(enrollmentId);
    } else if (typeof reader?.findEnrollmentById === "function") {
      enrollment = await reader.findEnrollmentById(enrollmentId);
    } else {
      throw notConfigured();
    }

    if (!enrollment) {
      throw notFound();
    }
    return enrollment;
  }

  async loadProgress(enrollmentId) {
    if (typeof this.progressReader?.findByEnrollmentId !== "function") {
      throw notConfigured();
    }

    const progress = await this.progressReader.findByEnrollmentId(enrollmentId);
    if (!progress) {
      throw notFound();
    }
    return progress;
  }

  async loadOptionalReview(input) {
    const service = this.getAdministrativeReviewService("getReviewStatus");

    try {
      return await service.getReviewStatus(input);
    } catch (error) {
      if (error?.code === "DIGITAL_ENROLLMENT_REVIEW_NOT_FOUND") {
        return null;
      }
      throw error;
    }
  }

  getAdministrativeReviewService(method) {
    if (typeof this.administrativeReviewService?.[method] !== "function") {
      throw notConfigured();
    }
    return this.administrativeReviewService;
  }

  async authorize(action, actorAuthIdentityId) {
    if (typeof this.authorizationPolicy?.authorize !== "function") {
      throw notConfigured();
    }

    let result = null;
    try {
      result = await this.authorizationPolicy.authorize({
        action,
        actorAuthIdentityId,
      });
    } catch {
      throw forbidden();
    }

    if (result !== true && result?.authorized !== true) {
      throw forbidden();
    }
  }

  toOperationDto(review, enrollment) {
    return Object.freeze({
      activationAllowed: false,
      enrollmentId: readText(review, "enrollmentId"),
      enrollmentStatus: readText(enrollment, "status"),
      review: Object.freeze({ ...review }),
      reviewStatus: readText(review, "status"),
      workflowStatus: toWorkflowStatus(readText(review, "status"), null),
    });
  }
}

function baseCommand(command = {}) {
  return Object.freeze({
    actorAuthIdentityId: required(command.actorAuthIdentityId, "actorAuthIdentityId"),
    enrollmentId: required(command.enrollmentId, "enrollmentId"),
  });
}

function assertOwnership(progress, expectedRelationshipId) {
  const actual = required(progress?.responsibleRelationshipId, "responsibleRelationshipId");
  const expected = String(expectedRelationshipId ?? "").trim();

  if (expected && expected !== actual) {
    throw controlledError(
      "Digital enrollment relationship does not own this workflow.",
      DIGITAL_ENROLLMENT_WORKFLOW_OWNERSHIP_CONFLICT,
      409,
    );
  }
  return actual;
}

function toSituationDto({ enrollment, progress, review }) {
  const reviewStatus = readText(review, "status");
  return Object.freeze({
    activationAllowed: false,
    enrollmentId: readText(enrollment, "id"),
    enrollmentStatus: readText(enrollment, "status"),
    progressStatus: readText(progress, "status"),
    review: review ? Object.freeze({ ...review }) : null,
    reviewStatus,
    workflowStatus: toWorkflowStatus(reviewStatus, readText(progress, "status")),
  });
}

function toWorkflowStatus(reviewStatus, progressStatus) {
  if (reviewStatus === "APPROVED") {
    return DIGITAL_ENROLLMENT_WORKFLOW_STATUSES.APPROVED_PENDING_ACTIVATION;
  }
  if (Object.prototype.hasOwnProperty.call(DIGITAL_ENROLLMENT_WORKFLOW_STATUSES, reviewStatus)) {
    return DIGITAL_ENROLLMENT_WORKFLOW_STATUSES[reviewStatus];
  }
  return progressStatus === "READY_FOR_REVIEW"
    ? DIGITAL_ENROLLMENT_WORKFLOW_STATUSES.READY_FOR_REVIEW
    : DIGITAL_ENROLLMENT_WORKFLOW_STATUSES.NOT_READY_FOR_REVIEW;
}

function required(value, field) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    const error = new TypeError(`${field} is required.`);
    error.code = "DIGITAL_ENROLLMENT_WORKFLOW_INVALID_COMMAND";
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function readText(value, property) {
  const normalized = String(value?.[property] ?? "").trim();
  return normalized || null;
}

function notConfigured() {
  return controlledError(
    "Digital enrollment administrative workflow is not configured.",
    DIGITAL_ENROLLMENT_WORKFLOW_NOT_CONFIGURED,
    503,
    false,
  );
}

function notFound() {
  return controlledError(
    "Digital enrollment administrative workflow was not found.",
    DIGITAL_ENROLLMENT_WORKFLOW_NOT_FOUND,
    404,
  );
}

function forbidden() {
  return controlledError(
    "Digital enrollment administrative workflow is forbidden.",
    DIGITAL_ENROLLMENT_WORKFLOW_FORBIDDEN,
    403,
  );
}

function controlledError(message, code, statusCode, expose = true) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.expose = expose;
  return error;
}

module.exports = {
  DIGITAL_ENROLLMENT_WORKFLOW_ACTIVATION_BLOCKED,
  DIGITAL_ENROLLMENT_WORKFLOW_FORBIDDEN,
  DIGITAL_ENROLLMENT_WORKFLOW_NOT_CONFIGURED,
  DIGITAL_ENROLLMENT_WORKFLOW_NOT_FOUND,
  DIGITAL_ENROLLMENT_WORKFLOW_OWNERSHIP_CONFLICT,
  DIGITAL_ENROLLMENT_WORKFLOW_STATUSES,
  DigitalEnrollmentAdministrativeWorkflowService,
  toWorkflowStatus,
};
