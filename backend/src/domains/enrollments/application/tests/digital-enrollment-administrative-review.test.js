const assert = require("node:assert/strict");
const test = require("node:test");
const {
  DigitalEnrollmentAdministrativeReviewService,
} = require("../services/digital-enrollment-administrative-review.service.js");
const {
  DigitalEnrollmentReviewEligibilityPolicy,
} = require("../../domain/policies/digital-enrollment-review-eligibility.policy.js");
const {
  MemoryDigitalEnrollmentAdministrativeReviewRepository,
} = require("../../infrastructure/repositories/memory-digital-enrollment-administrative-review.repository.js");

const ELIGIBLE = Object.freeze({
  contractAccepted: true,
  documentsComplete: true,
  enrollmentStatus: "DRAFT",
  progressEligible: true,
});

test("review eligibility is fail-closed and validates every explicit evidence", async (t) => {
  await t.test("policy dependency is required", async () => {
    const { service } = fixture({ eligibilityPolicy: null });
    await assert.rejects(() => service.startReview(start()), {
      code: "DIGITAL_ENROLLMENT_REVIEW_NOT_CONFIGURED",
    });
  });
  for (const field of ["documentsComplete", "contractAccepted", "progressEligible"]) {
    await t.test(`${field} false blocks`, async () => {
      const { service } = fixture();
      await assert.rejects(
        () => service.startReview(start({ eligibility: { ...ELIGIBLE, [field]: false } })),
        { code: "DIGITAL_ENROLLMENT_REVIEW_NOT_ELIGIBLE" },
      );
    });
  }
});

test("start creates a minimal pending review and identical retry is idempotent", async () => {
  const { service } = fixture();
  const first = await service.startReview(start());
  const retry = await service.startReview(start());
  assert.deepEqual(retry, first);
  assert.equal(first.status, "PENDING_REVIEW");
  assert.equal(first.revision, 1);
  assert.deepEqual(Object.keys(first).sort(), [
    "canResubmit", "correctionItems", "decidedAt", "decisionCode", "enrollmentId",
    "reviewId", "reviewRound", "revision", "status", "submittedAt",
  ]);
  assert.equal("reviewerAuthIdentityId" in first, false);
});

test("same command id with different content conflicts", async () => {
  const { service } = fixture();
  await service.startReview(start());
  await assert.rejects(
    () => service.startReview(start({ responsibleRelationshipId: "relationship-2" })),
    { code: "DIGITAL_ENROLLMENT_REVIEW_IDEMPOTENCY_CONFLICT" },
  );
});

test("approval requires reviewer, validates revision, is idempotent and terminal", async () => {
  const { service } = fixture();
  await service.startReview(start());
  await assert.rejects(() => service.approveReview(decision({ reviewerAuthIdentityId: "" })), {
    code: "DIGITAL_ENROLLMENT_REVIEW_INVALID_COMMAND",
  });
  await assert.rejects(() => service.approveReview(decision({ revision: 2 })), {
    code: "DIGITAL_ENROLLMENT_REVIEW_CONFLICT",
  });
  const approved = await service.approveReview(decision());
  assert.equal(approved.status, "APPROVED");
  assert.deepEqual(await service.approveReview(decision()), approved);
  await assert.rejects(
    () => service.rejectReview(decision({ commandId: "reject-after", decisionCode: "INVALID_INFORMATION", revision: 2 })),
    { code: "DIGITAL_ENROLLMENT_REVIEW_INVALID_TRANSITION" },
  );
});

test("correction validates code and items, resubmits a new round and preserves history", async () => {
  const { repository, service } = fixture();
  await service.startReview(start());
  await assert.rejects(() => service.requestCorrection(decision()), {
    code: "DIGITAL_ENROLLMENT_REVIEW_INVALID_COMMAND",
  });
  await assert.rejects(
    () => service.requestCorrection(decision({ decisionCode: "DOCUMENT_CORRECTION" })),
    { code: "DIGITAL_ENROLLMENT_REVIEW_INVALID_COMMAND" },
  );
  await assert.rejects(
    () => service.requestCorrection(decision({
      correctionItems: ["UNKNOWN"],
      decisionCode: "DOCUMENT_CORRECTION",
    })),
    { code: "DIGITAL_ENROLLMENT_REVIEW_INVALID_COMMAND" },
  );
  const correction = await service.requestCorrection(decision({
    correctionItems: ["DOCUMENTS"],
    decisionCode: "DOCUMENT_CORRECTION",
  }));
  assert.equal(correction.canResubmit, true);
  await assert.rejects(
    () => service.approveReview(decision({ commandId: "direct-approve", revision: 2 })),
    { code: "DIGITAL_ENROLLMENT_REVIEW_INVALID_TRANSITION" },
  );
  await assert.rejects(
    () => service.resubmitForReview(resubmit({ correctionItems: [] })),
    { code: "DIGITAL_ENROLLMENT_REVIEW_INVALID_COMMAND" },
  );
  const resubmitted = await service.resubmitForReview(resubmit());
  assert.equal(resubmitted.reviewRound, 2);
  assert.equal(resubmitted.status, "PENDING_REVIEW");
  const history = await repository.listDecisionsByReviewId(resubmitted.reviewId);
  assert.equal(history.length, 1);
  assert.equal(history[0].decisionCode, "DOCUMENT_CORRECTION");
  assert.equal(Object.isFrozen(history[0]), true);
});

test("rejection requires allowlisted code, preserves history and is terminal", async () => {
  const { repository, service } = fixture();
  await service.startReview(start());
  await assert.rejects(() => service.rejectReview(decision()), {
    code: "DIGITAL_ENROLLMENT_REVIEW_INVALID_COMMAND",
  });
  const rejected = await service.rejectReview(decision({ decisionCode: "INVALID_INFORMATION" }));
  assert.equal(rejected.status, "REJECTED");
  assert.equal((await repository.listDecisionsByReviewId(rejected.reviewId)).length, 1);
  await assert.rejects(
    () => service.approveReview(decision({ commandId: "approve-rejected", revision: 2 })),
    { code: "DIGITAL_ENROLLMENT_REVIEW_INVALID_TRANSITION" },
  );
});

test("two concurrent reviewers produce exactly one immutable decision", async () => {
  const { repository, service } = fixture();
  await service.startReview(start());
  const results = await Promise.allSettled([
    service.approveReview(decision({ commandId: "concurrent-a", reviewerAuthIdentityId: "reviewer-a" })),
    service.rejectReview(decision({
      commandId: "concurrent-b",
      decisionCode: "INVALID_DOCUMENTATION",
      reviewerAuthIdentityId: "reviewer-b",
    })),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal((await repository.listDecisionsByReviewId("review-1")).length, 1);
});

test("repository failure does not append a partial decision", async () => {
  const { repository, service } = fixture();
  await service.startReview(start());
  const original = repository.updateIfRevisionMatches.bind(repository);
  repository.updateIfRevisionMatches = async () => {
    throw new Error("synthetic persistence failure");
  };
  await assert.rejects(() => service.approveReview(decision()), /synthetic persistence failure/);
  assert.equal((await repository.listDecisionsByReviewId("review-1")).length, 0);
  repository.updateIfRevisionMatches = original;
});

test("logs contain only safe identifiers and never the command body", async () => {
  const entries = [];
  const { service } = fixture({ logger: { info: (...args) => entries.push(args) } });
  await service.startReview(start({ ignoredSensitiveField: "123.456.789-00" }));
  const serialized = JSON.stringify(entries);
  assert.equal(serialized.includes("ignoredSensitiveField"), false);
  assert.equal(serialized.includes("123.456.789-00"), false);
});

test("review flow has no activation, financial or notification collaborator", async () => {
  const { service } = fixture();
  await service.startReview(start());
  await service.approveReview(decision());
  assert.equal("enrollmentService" in service, false);
  assert.equal("financialService" in service, false);
  assert.equal("notificationService" in service, false);
});

function fixture(overrides = {}) {
  const repository = overrides.repository || new MemoryDigitalEnrollmentAdministrativeReviewRepository();
  const service = new DigitalEnrollmentAdministrativeReviewService({
    authorizationPolicy: { async authorize() { return true; } },
    clock: () => "2026-07-26T12:00:00.000Z",
    eligibilityPolicy: new DigitalEnrollmentReviewEligibilityPolicy(),
    idGenerator: () => "review-1",
    repository,
    ...overrides,
  });
  return { repository, service };
}
function start(overrides = {}) {
  return {
    actorAuthIdentityId: "secretary-1",
    commandId: "start-1",
    eligibility: ELIGIBLE,
    enrollmentId: "enrollment-1",
    responsibleRelationshipId: "relationship-1",
    ...overrides,
  };
}
function decision(overrides = {}) {
  return {
    actorAuthIdentityId: "secretary-1",
    commandId: "decision-1",
    enrollmentId: "enrollment-1",
    reviewerAuthIdentityId: "reviewer-1",
    revision: 1,
    ...overrides,
  };
}
function resubmit(overrides = {}) {
  return {
    actorAuthIdentityId: "responsible-1",
    commandId: "resubmit-1",
    correctionItems: ["DOCUMENTS"],
    enrollmentId: "enrollment-1",
    revision: 2,
    ...overrides,
  };
}
