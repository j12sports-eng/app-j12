const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DIGITAL_ENROLLMENT_ACTIVATION_READINESS_BLOCKERS,
  DigitalEnrollmentActivationReadinessPolicy,
} = require("../../domain/policies/digital-enrollment-activation-readiness.policy.js");
const {
  DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE,
  EvaluateDigitalEnrollmentActivationReadinessService,
} = require("../services/evaluate-digital-enrollment-activation-readiness.service.js");

const READY_EVIDENCE = Object.freeze({
  administrativeReviewStatus: "APPROVED",
  contractAccepted: true,
  documentsComplete: true,
  enrollmentStatus: "DRAFT",
  progressStatus: "READY_FOR_REVIEW",
  workflowStatus: "APPROVED_PENDING_ACTIVATION",
});

test("canonical policy accepts every explicit activation prerequisite", () => {
  const result = new DigitalEnrollmentActivationReadinessPolicy().evaluate(READY_EVIDENCE);

  assert.deepEqual(result, {
    blockers: [],
    ready: true,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.blockers), true);
});

test("blockers are complete and deterministic when evidence is absent", () => {
  const result = new DigitalEnrollmentActivationReadinessPolicy().evaluate({});

  assert.deepEqual(result.blockers, [
    "ENROLLMENT_NOT_DRAFT",
    "PROGRESS_NOT_READY_FOR_REVIEW",
    "DOCUMENTS_INCOMPLETE",
    "CONTRACT_NOT_ACCEPTED",
    "ADMINISTRATIVE_REVIEW_NOT_APPROVED",
    "WORKFLOW_NOT_APPROVED_PENDING_ACTIVATION",
  ]);
  assert.equal(result.ready, false);
});

test("each failed prerequisite exposes its canonical blocker", () => {
  const cases = [
    [
      { enrollmentStatus: "ACTIVE" },
      DIGITAL_ENROLLMENT_ACTIVATION_READINESS_BLOCKERS.ENROLLMENT_NOT_DRAFT,
    ],
    [
      { progressStatus: "IN_PROGRESS" },
      DIGITAL_ENROLLMENT_ACTIVATION_READINESS_BLOCKERS.PROGRESS_NOT_READY_FOR_REVIEW,
    ],
    [
      { documentsComplete: false },
      DIGITAL_ENROLLMENT_ACTIVATION_READINESS_BLOCKERS.DOCUMENTS_INCOMPLETE,
    ],
    [
      { contractAccepted: false },
      DIGITAL_ENROLLMENT_ACTIVATION_READINESS_BLOCKERS.CONTRACT_NOT_ACCEPTED,
    ],
    [
      { administrativeReviewStatus: "PENDING_REVIEW" },
      DIGITAL_ENROLLMENT_ACTIVATION_READINESS_BLOCKERS.ADMINISTRATIVE_REVIEW_NOT_APPROVED,
    ],
    [
      { workflowStatus: "PENDING_REVIEW" },
      DIGITAL_ENROLLMENT_ACTIVATION_READINESS_BLOCKERS.WORKFLOW_NOT_APPROVED_PENDING_ACTIVATION,
    ],
  ];
  const policy = new DigitalEnrollmentActivationReadinessPolicy();

  for (const [override, expectedBlocker] of cases) {
    const result = policy.evaluate({
      ...READY_EVIDENCE,
      ...override,
    });
    assert.deepEqual(result.blockers, [expectedBlocker]);
    assert.equal(result.ready, false);
  }
});

test("boolean evidence is strict and never accepts truthy substitutes", () => {
  const result = new DigitalEnrollmentActivationReadinessPolicy().evaluate({
    ...READY_EVIDENCE,
    contractAccepted: 1,
    documentsComplete: "true",
  });

  assert.deepEqual(result.blockers, ["DOCUMENTS_INCOMPLETE", "CONTRACT_NOT_ACCEPTED"]);
});

test("application DTO remains blocked operationally even when ready", () => {
  const enrollment = Object.freeze({
    id: "enrollment-1",
    status: "DRAFT",
  });
  const service = new EvaluateDigitalEnrollmentActivationReadinessService();
  const readiness = service.execute({
    ...READY_EVIDENCE,
    enrollmentStatus: enrollment.status,
  });

  assert.deepEqual(readiness, {
    activationAllowed: false,
    blockers: [],
    operationalBlocker: DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE,
    ready: true,
  });
  assert.equal(enrollment.status, "DRAFT");
  assert.equal(Object.isFrozen(readiness), true);
  assert.equal(Object.isFrozen(readiness.blockers), true);
});

test("service has no activation or downstream side-effect collaborators", () => {
  const service = new EvaluateDigitalEnrollmentActivationReadinessService();

  service.execute(READY_EVIDENCE);

  assert.equal("enrollmentRepository" in service, false);
  assert.equal("enrollmentService" in service, false);
  assert.equal("financialService" in service, false);
  assert.equal("classService" in service, false);
  assert.equal("notificationService" in service, false);
  assert.equal("activateEnrollment" in service, false);
});

test("service fails closed when its canonical policy is unavailable", () => {
  const service = new EvaluateDigitalEnrollmentActivationReadinessService({
    policy: null,
  });

  assert.throws(() => service.execute(READY_EVIDENCE), {
    code: "DIGITAL_ENROLLMENT_ACTIVATION_READINESS_NOT_CONFIGURED",
    statusCode: 503,
  });
});
