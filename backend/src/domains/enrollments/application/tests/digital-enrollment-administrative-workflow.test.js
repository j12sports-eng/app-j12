const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DigitalEnrollmentAdministrativeReviewService,
} = require("../services/digital-enrollment-administrative-review.service.js");
const {
  DIGITAL_ENROLLMENT_WORKFLOW_ACTIVATION_BLOCKED,
  DigitalEnrollmentAdministrativeWorkflowService,
} = require("../services/digital-enrollment-administrative-workflow.service.js");
const {
  DigitalEnrollmentReviewEligibilityPolicy,
} = require("../../domain/policies/digital-enrollment-review-eligibility.policy.js");
const {
  MemoryDigitalEnrollmentAdministrativeReviewRepository,
} = require("../../infrastructure/repositories/memory-digital-enrollment-administrative-review.repository.js");

test("current situation distinguishes a review-ready DRAFT from an active enrollment", async () => {
  const { enrollment, service } = fixture();

  const situation = await service.getCurrentSituation(base());

  assert.deepEqual(situation, {
    activationAllowed: false,
    enrollmentId: "enrollment-1",
    enrollmentStatus: "DRAFT",
    progressStatus: "READY_FOR_REVIEW",
    review: null,
    reviewStatus: null,
    workflowStatus: "READY_FOR_REVIEW",
  });
  assert.equal(enrollment.status, "DRAFT");
});

test("eligibility is derived from canonical readers and ignores caller-provided evidence", async () => {
  const { calls, service } = fixture();

  const assessment = await service.evaluateReviewEligibility({
    ...base(),
    eligibility: {
      contractAccepted: false,
      documentsComplete: false,
      enrollmentStatus: "ACTIVE",
      progressEligible: false,
    },
  });

  assert.deepEqual(assessment.evidence, {
    contractAccepted: true,
    documentsComplete: true,
    enrollmentStatus: "DRAFT",
    progressEligible: true,
  });
  assert.deepEqual(calls.documents, [
    {
      enrollmentId: "enrollment-1",
      requiredDocumentTypes: ["CPF", "RG"],
      responsibleRelationshipId: "relationship-1",
    },
  ]);
  assert.deepEqual(calls.contracts, [
    {
      enrollmentId: "enrollment-1",
      responsibleRelationshipId: "relationship-1",
    },
  ]);
});

test("start coordinates eligibility and creates one pending administrative review", async () => {
  const { enrollment, reviewRepository, service } = fixture();

  const result = await service.startReview(start());

  assert.equal(result.workflowStatus, "PENDING_REVIEW");
  assert.equal(result.reviewStatus, "PENDING_REVIEW");
  assert.equal(result.activationAllowed, false);
  assert.equal(result.enrollmentStatus, "DRAFT");
  assert.equal(enrollment.status, "DRAFT");
  assert.equal(
    (await reviewRepository.findByEnrollmentId("enrollment-1")).status,
    "PENDING_REVIEW",
  );
});

test("correction and resubmission remain in the administrative workflow", async () => {
  const { enrollment, reviewRepository, service } = fixture();
  await service.startReview(start());

  const correction = await service.requestCorrection({
    ...decision(),
    correctionItems: ["DOCUMENTS"],
    decisionCode: "DOCUMENT_CORRECTION",
  });
  const resubmitted = await service.resubmitForReview({
    ...base(),
    commandId: "resubmit-1",
    correctionItems: ["DOCUMENTS"],
    revision: correction.review.revision,
  });

  assert.equal(correction.workflowStatus, "CORRECTION_REQUESTED");
  assert.equal(resubmitted.workflowStatus, "PENDING_REVIEW");
  assert.equal(resubmitted.review.reviewRound, 2);
  assert.equal(enrollment.status, "DRAFT");
  assert.equal((await reviewRepository.listDecisionsByReviewId("review-1")).length, 1);
});

test("rejection is terminal inside the review and does not change Enrollment", async () => {
  const { enrollment, service } = fixture();
  await service.startReview(start());

  const rejected = await service.rejectReview({
    ...decision(),
    decisionCode: "INVALID_INFORMATION",
  });

  assert.equal(rejected.workflowStatus, "REJECTED");
  assert.equal(rejected.enrollmentStatus, "DRAFT");
  assert.equal(enrollment.status, "DRAFT");
});

test("approval becomes APPROVED_PENDING_ACTIVATION without activating Enrollment", async () => {
  const { enrollment, service } = fixture();
  await service.startReview(start());

  const approved = await service.approveReview(decision());
  const situation = await service.getCurrentSituation(base());

  assert.equal(approved.reviewStatus, "APPROVED");
  assert.equal(approved.workflowStatus, "APPROVED_PENDING_ACTIVATION");
  assert.equal(situation.workflowStatus, "APPROVED_PENDING_ACTIVATION");
  assert.equal(approved.activationAllowed, false);
  assert.equal(enrollment.status, "DRAFT");
});

test("activation is explicitly blocked even after administrative approval", async () => {
  const { enrollment, service } = fixture();
  await service.startReview(start());
  await service.approveReview(decision());

  await assert.rejects(() => service.activateEnrollment(base()), {
    code: DIGITAL_ENROLLMENT_WORKFLOW_ACTIVATION_BLOCKED,
    statusCode: 409,
  });
  assert.equal(enrollment.status, "DRAFT");
  assert.equal("enrollmentService" in service, false);
  assert.equal("financialService" in service, false);
  assert.equal("notificationService" in service, false);
});

test("workflow fails closed for missing evidence dependencies and negative evidence", async (t) => {
  await t.test("contract reader is required", async () => {
    const { service } = fixture({ contractAcceptanceReader: null });
    await assert.rejects(() => service.startReview(start()), {
      code: "DIGITAL_ENROLLMENT_WORKFLOW_NOT_CONFIGURED",
    });
  });

  await t.test("documents must be complete", async () => {
    const { service } = fixture({ documentsComplete: false });
    await assert.rejects(() => service.startReview(start()), {
      code: "DIGITAL_ENROLLMENT_REVIEW_NOT_ELIGIBLE",
    });
  });

  await t.test("contract must be accepted", async () => {
    const { service } = fixture({ contractAccepted: false });
    await assert.rejects(() => service.startReview(start()), {
      code: "DIGITAL_ENROLLMENT_REVIEW_NOT_ELIGIBLE",
    });
  });
});

test("relationship ownership and authorization are fail-closed", async (t) => {
  await t.test("relationship mismatch blocks evidence reads", async () => {
    const { calls, service } = fixture();
    await assert.rejects(
      () => service.startReview(start({ responsibleRelationshipId: "relationship-other" })),
      {
        code: "DIGITAL_ENROLLMENT_WORKFLOW_OWNERSHIP_CONFLICT",
      },
    );
    assert.equal(calls.documents.length, 0);
    assert.equal(calls.contracts.length, 0);
  });

  await t.test("authorization denial blocks all readers", async () => {
    const { calls, service } = fixture({ authorized: false });
    await assert.rejects(() => service.getCurrentSituation(base()), {
      code: "DIGITAL_ENROLLMENT_WORKFLOW_FORBIDDEN",
    });
    assert.equal(calls.enrollments, 0);
    assert.equal(calls.progress, 0);
  });
});

function fixture(overrides = {}) {
  const calls = {
    contracts: [],
    documents: [],
    enrollments: 0,
    progress: 0,
  };
  const enrollment = {
    id: "enrollment-1",
    status: overrides.enrollmentStatus || "DRAFT",
  };
  const progress = {
    enrollmentId: "enrollment-1",
    responsibleRelationshipId: "relationship-1",
    status: overrides.progressStatus || "READY_FOR_REVIEW",
  };
  const reviewRepository = new MemoryDigitalEnrollmentAdministrativeReviewRepository();
  const reviewService = new DigitalEnrollmentAdministrativeReviewService({
    authorizationPolicy: {
      async authorize() {
        return true;
      },
    },
    clock: () => "2026-07-26T12:00:00.000Z",
    eligibilityPolicy: new DigitalEnrollmentReviewEligibilityPolicy(),
    idGenerator: () => "review-1",
    repository: reviewRepository,
  });
  const contractAcceptanceReader = Object.prototype.hasOwnProperty.call(
    overrides,
    "contractAcceptanceReader",
  )
    ? overrides.contractAcceptanceReader
    : {
        async getAcceptanceStatus(input) {
          calls.contracts.push(input);
          return {
            accepted: overrides.contractAccepted !== false,
          };
        },
      };
  const service = new DigitalEnrollmentAdministrativeWorkflowService({
    administrativeReviewService: reviewService,
    authorizationPolicy: {
      async authorize() {
        return overrides.authorized !== false;
      },
    },
    contractAcceptanceReader,
    documentCompletionService: {
      async execute(input) {
        calls.documents.push(input);
        return {
          complete: overrides.documentsComplete !== false,
        };
      },
    },
    enrollmentReader: {
      async findById() {
        calls.enrollments += 1;
        return enrollment;
      },
    },
    progressReader: {
      async findByEnrollmentId() {
        calls.progress += 1;
        return progress;
      },
    },
    requiredDocumentTypes: ["CPF", "RG"],
  });

  return {
    calls,
    enrollment,
    progress,
    reviewRepository,
    reviewService,
    service,
  };
}

function base(overrides = {}) {
  return {
    actorAuthIdentityId: "secretary-1",
    enrollmentId: "enrollment-1",
    responsibleRelationshipId: "relationship-1",
    ...overrides,
  };
}

function start(overrides = {}) {
  return {
    ...base(),
    commandId: "start-1",
    ...overrides,
  };
}

function decision(overrides = {}) {
  return {
    ...base(),
    commandId: "decision-1",
    reviewerAuthIdentityId: "reviewer-1",
    revision: 1,
    ...overrides,
  };
}
