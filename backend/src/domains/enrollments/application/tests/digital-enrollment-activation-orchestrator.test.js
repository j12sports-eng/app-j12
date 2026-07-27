const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DigitalEnrollmentActivationOrchestratorService,
} = require("../services/digital-enrollment-activation-orchestrator.service.js");
const {
  EvaluateDigitalEnrollmentActivationReadinessService,
} = require("../services/evaluate-digital-enrollment-activation-readiness.service.js");

const READY_EVIDENCE = Object.freeze({
  administrativeReviewStatus: "APPROVED",
  contractAccepted: true,
  documentsComplete: true,
  progressStatus: "READY_FOR_REVIEW",
  workflowStatus: "APPROVED_PENDING_ACTIVATION",
});

test("authorized ready attempt returns canonical blocker without activating Enrollment", async () => {
  const { enrollment, logs, service } = fixture();

  const result = await service.activate(command());

  assert.deepEqual(result, {
    activationAllowed: false,
    attemptRecorded: true,
    blocker: "DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE",
    enrollmentId: "enrollment-1",
    enrollmentStatus: "DRAFT",
    functionalBlockers: [],
    functionalReady: true,
    result: "BLOCKED",
  });
  assert.equal(enrollment.status, "DRAFT");
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.functionalBlockers), true);
  assert.deepEqual(logs, [
    [
      "[enrollments] digital activation attempt blocked",
      {
        blocker: "DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE",
        enrollmentId: "enrollment-1",
        functionalReady: true,
        result: "BLOCKED",
      },
    ],
  ]);
});

test("functional blockers are preserved while operational blocker remains canonical", async () => {
  const { service } = fixture();

  const result = await service.activate(
    command({
      evidence: {
        ...READY_EVIDENCE,
        contractAccepted: false,
        documentsComplete: false,
      },
    }),
  );

  assert.equal(result.functionalReady, false);
  assert.deepEqual(result.functionalBlockers, ["DOCUMENTS_INCOMPLETE", "CONTRACT_NOT_ACCEPTED"]);
  assert.equal(result.blocker, "DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE");
});

test("canonical Enrollment status overrides forged readiness evidence", async () => {
  const { readinessCalls, service } = fixture({
    enrollmentStatus: "ACTIVE",
  });

  const result = await service.activate(command());

  assert.equal(result.enrollmentStatus, "ACTIVE");
  assert.equal(result.functionalReady, false);
  assert.deepEqual(result.functionalBlockers, ["ENROLLMENT_NOT_DRAFT"]);
  assert.equal(readinessCalls[0].enrollmentStatus, "ACTIVE");
});

test("command validation rejects forged fields before authorization or reads", async () => {
  const { calls, service } = fixture();

  await assert.rejects(
    () =>
      service.activate({
        ...command(),
        status: "ACTIVE",
      }),
    {
      code: "DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_INVALID_COMMAND",
    },
  );
  await assert.rejects(
    () =>
      service.activate(
        command({
          evidence: {
            ...READY_EVIDENCE,
            enrollmentStatus: "DRAFT",
          },
        }),
      ),
    {
      code: "DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_INVALID_COMMAND",
    },
  );
  assert.deepEqual(calls, {
    authorization: 0,
    enrollmentReads: 0,
  });
});

test("authorization is fail-closed and happens before Enrollment read", async (t) => {
  for (const authorizationPolicy of [
    null,
    {
      async authorize() {
        return false;
      },
    },
    {
      async authorize() {
        throw new Error("unavailable");
      },
    },
  ]) {
    await t.test(authorizationPolicy ? "denial or failure" : "missing policy", async () => {
      const { calls, service } = fixture({
        authorizationPolicy,
      });
      await assert.rejects(() => service.activate(command()), {
        code: authorizationPolicy
          ? "DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_FORBIDDEN"
          : "DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_NOT_CONFIGURED",
      });
      assert.equal(calls.enrollmentReads, 0);
    });
  }
});

test("missing Enrollment and readiness dependencies fail closed", async (t) => {
  await t.test("Enrollment is required", async () => {
    const { service } = fixture({ enrollment: null });
    await assert.rejects(() => service.activate(command()), {
      code: "DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_NOT_FOUND",
    });
  });

  await t.test("readiness service is required", async () => {
    const { service } = fixture({ readinessService: null });
    await assert.rejects(() => service.activate(command()), {
      code: "DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_NOT_CONFIGURED",
    });
  });

  await t.test("readiness cannot authorize activation", async () => {
    const { service } = fixture({
      readinessService: {
        execute() {
          return {
            activationAllowed: true,
            blockers: [],
            operationalBlocker: null,
            ready: true,
          };
        },
      },
    });
    await assert.rejects(() => service.activate(command()), {
      code: "DIGITAL_ENROLLMENT_ACTIVATION_ORCHESTRATOR_NOT_CONFIGURED",
    });
  });
});

test("orchestrator exposes no executor, downstream collaborator or event dispatcher", async () => {
  const sideEffects = [];
  const options = {
    classService: { create: () => sideEffects.push("class") },
    eventDispatcher: {
      dispatch: () => sideEffects.push("event"),
      publish: () => sideEffects.push("event"),
    },
    financialService: {
      create: () => sideEffects.push("financial"),
    },
    notificationService: {
      send: () => sideEffects.push("notification"),
    },
    scheduleService: {
      create: () => sideEffects.push("schedule"),
    },
  };
  const { service } = fixture(options);

  await service.activate(command());

  assert.deepEqual(sideEffects, []);
  assert.equal("classService" in service, false);
  assert.equal("eventDispatcher" in service, false);
  assert.equal("financialService" in service, false);
  assert.equal("notificationService" in service, false);
  assert.equal("scheduleService" in service, false);
  assert.equal("enrollmentWriter" in service, false);
});

function fixture(overrides = {}) {
  const calls = {
    authorization: 0,
    enrollmentReads: 0,
  };
  const logs = [];
  const readinessCalls = [];
  const enrollment = Object.prototype.hasOwnProperty.call(overrides, "enrollment")
    ? overrides.enrollment
    : {
        id: "enrollment-1",
        status: overrides.enrollmentStatus || "DRAFT",
      };
  const canonicalReadiness = new EvaluateDigitalEnrollmentActivationReadinessService();
  const readinessService = Object.prototype.hasOwnProperty.call(overrides, "readinessService")
    ? overrides.readinessService
    : {
        execute(evidence) {
          readinessCalls.push(evidence);
          return canonicalReadiness.execute(evidence);
        },
      };
  const authorizationPolicy = Object.prototype.hasOwnProperty.call(overrides, "authorizationPolicy")
    ? overrides.authorizationPolicy
    : {
        async authorize() {
          calls.authorization += 1;
          return true;
        },
      };
  const service = new DigitalEnrollmentActivationOrchestratorService({
    authorizationPolicy,
    enrollmentReader: {
      async findById() {
        calls.enrollmentReads += 1;
        return enrollment;
      },
    },
    logger: {
      info(...args) {
        logs.push(args);
      },
    },
    readinessService,
    ...overrides,
  });

  return {
    calls,
    enrollment,
    logs,
    readinessCalls,
    service,
  };
}

function command(overrides = {}) {
  return {
    actorAuthIdentityId: "administrator-1",
    enrollmentId: "enrollment-1",
    evidence: READY_EVIDENCE,
    ...overrides,
  };
}
