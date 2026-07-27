const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DigitalEnrollmentActivationExecutorService,
} = require("../services/digital-enrollment-activation-executor.service.js");

const CANONICAL_ORCHESTRATOR_RESULT = Object.freeze({
  activationAllowed: false,
  activationExecuted: false,
  blocker: "DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE",
});

test("invalid command and unexpected fields are rejected before authorization and reads", async (t) => {
  for (const invalidCommand of [
    null,
    {},
    command({ token: "secret" }),
    command({ enrollmentId: "invalid id" }),
  ]) {
    await t.test(String(invalidCommand), async () => {
      const { calls, service } = fixture();
      await assert.rejects(() => service.execute(invalidCommand), {
        code: "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_INVALID_COMMAND",
      });
      assert.equal(calls.authorization, 0);
      assert.equal(calls.enrollmentReads, 0);
    });
  }
});

test("authorization is fail-closed and precedes Enrollment reads", async (t) => {
  for (const authorizationPolicy of [
    null,
    { authorize: async () => false },
    {
      authorize: async () => {
        throw new Error("unavailable");
      },
    },
  ]) {
    await t.test(authorizationPolicy ? "denied or failed" : "missing", async () => {
      const { calls, service } = fixture({ authorizationPolicy });
      await assert.rejects(() => service.execute(command()), {
        code: authorizationPolicy
          ? "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_FORBIDDEN"
          : "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_NOT_CONFIGURED",
      });
      assert.equal(calls.enrollmentReads, 0);
    });
  }
});

test("missing reader and missing Enrollment fail closed", async (t) => {
  await t.test("reader", async () => {
    const { service } = fixture({ enrollmentReader: null });
    await assert.rejects(() => service.execute(command()), {
      code: "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_NOT_CONFIGURED",
    });
  });
  await t.test("Enrollment", async () => {
    const { service } = fixture({ enrollment: null });
    await assert.rejects(() => service.execute(command()), {
      code: "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_NOT_FOUND",
    });
  });
});

test("ownership and DRAFT state are enforced before orchestration", async (t) => {
  await t.test("ownership conflict", async () => {
    const { calls, service } = fixture({
      enrollment: enrollment({ responsibleRelationshipId: "relationship-2" }),
    });
    await assert.rejects(() => service.execute(command()), {
      code: "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_OWNERSHIP_CONFLICT",
    });
    assert.equal(calls.orchestrator, 0);
  });
  await t.test("state conflict", async () => {
    const { calls, service } = fixture({
      enrollment: enrollment({ status: "ACTIVE" }),
    });
    await assert.rejects(() => service.execute(command()), {
      code: "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_STATE_CONFLICT",
    });
    assert.equal(calls.orchestrator, 0);
  });
});

test("missing orchestrator fails closed", async () => {
  const { service } = fixture({ activationOrchestrator: null });
  await assert.rejects(() => service.execute(command()), {
    code: "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_NOT_CONFIGURED",
  });
});

test("orchestrator is called with canonical Enrollment evidence and result stays blocked", async () => {
  const { enrollment: source, logs, orchestratorCommands, service } = fixture();
  const snapshot = structuredClone(source);

  const result = await service.execute(command());

  assert.deepEqual(orchestratorCommands, [
    {
      actorAuthIdentityId: "actor-1",
      enrollmentId: "enrollment-1",
      evidence: {
        administrativeReviewStatus: "APPROVED",
        contractAccepted: true,
        documentsComplete: true,
        progressStatus: "READY_FOR_REVIEW",
        workflowStatus: "APPROVED_PENDING_ACTIVATION",
      },
    },
  ]);
  assert.deepEqual(result, {
    activationAllowed: false,
    activationAttempted: true,
    activationExecuted: false,
    blocker: "DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE",
    enrollmentId: "enrollment-1",
    enrollmentStatus: "DRAFT",
    result: "BLOCKED",
  });
  assert.deepEqual(source, snapshot);
  assert.equal(source.status, "DRAFT");
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(logs, [
    [
      "[enrollments] digital activation execution blocked",
      {
        blocker: "DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE",
        enrollmentId: "enrollment-1",
        result: "BLOCKED",
      },
    ],
  ]);
  assert.equal(JSON.stringify(logs).includes("actor-1"), false);
  assert.equal(JSON.stringify(logs).includes("relationship-1"), false);
});

test("unsafe orchestrator results are rejected", async (t) => {
  for (const result of [
    { ...CANONICAL_ORCHESTRATOR_RESULT, activationAllowed: true },
    { ...CANONICAL_ORCHESTRATOR_RESULT, activationExecuted: true },
    { ...CANONICAL_ORCHESTRATOR_RESULT, blocker: "OTHER" },
    null,
  ]) {
    await t.test(JSON.stringify(result), async () => {
      const { service } = fixture({ orchestratorResult: result });
      await assert.rejects(() => service.execute(command()), {
        code: "DIGITAL_ENROLLMENT_ACTIVATION_EXECUTOR_UNSAFE_RESULT",
      });
    });
  }
});

test("executor exposes no side-effect collaborator and result is deterministic", async () => {
  const sideEffects = [];
  const { service } = fixture({
    activateEnrollment: () => sideEffects.push("activate"),
    confirmDraftEnrollment: () => sideEffects.push("confirm"),
    financialService: { create: () => sideEffects.push("financial") },
    mysql: { query: () => sideEffects.push("mysql") },
    notificationService: { send: () => sideEffects.push("notification") },
  });

  const first = await service.execute(command());
  const second = await service.execute(command());

  assert.deepEqual(first, second);
  assert.deepEqual(sideEffects, []);
  assert.equal("activateEnrollment" in service, false);
  assert.equal("confirmDraftEnrollment" in service, false);
  assert.equal("financialService" in service, false);
  assert.equal("mysql" in service, false);
  assert.equal("notificationService" in service, false);
});

function fixture(overrides = {}) {
  const calls = { authorization: 0, enrollmentReads: 0, orchestrator: 0 };
  const logs = [];
  const orchestratorCommands = [];
  const sourceEnrollment = Object.prototype.hasOwnProperty.call(overrides, "enrollment")
    ? overrides.enrollment
    : enrollment();
  const authorizationPolicy = Object.prototype.hasOwnProperty.call(overrides, "authorizationPolicy")
    ? overrides.authorizationPolicy
    : {
        async authorize() {
          calls.authorization += 1;
          return true;
        },
      };
  const enrollmentReader = Object.prototype.hasOwnProperty.call(overrides, "enrollmentReader")
    ? overrides.enrollmentReader
    : {
        async findById() {
          calls.enrollmentReads += 1;
          return sourceEnrollment;
        },
      };
  const activationOrchestrator = Object.prototype.hasOwnProperty.call(
    overrides,
    "activationOrchestrator",
  )
    ? overrides.activationOrchestrator
    : {
        async activate(orchestratorCommand) {
          calls.orchestrator += 1;
          orchestratorCommands.push(orchestratorCommand);
          return Object.prototype.hasOwnProperty.call(overrides, "orchestratorResult")
            ? overrides.orchestratorResult
            : CANONICAL_ORCHESTRATOR_RESULT;
        },
      };
  const service = new DigitalEnrollmentActivationExecutorService({
    activationOrchestrator,
    authorizationPolicy,
    enrollmentReader,
    logger: { info: (...args) => logs.push(args) },
    ...overrides,
  });

  return {
    calls,
    enrollment: sourceEnrollment,
    logs,
    orchestratorCommands,
    service,
  };
}

function enrollment(overrides = {}) {
  return {
    administrativeReviewStatus: "APPROVED",
    contractAccepted: true,
    documentsComplete: true,
    id: "enrollment-1",
    progressStatus: "READY_FOR_REVIEW",
    responsibleRelationshipId: "relationship-1",
    status: "DRAFT",
    workflowStatus: "APPROVED_PENDING_ACTIVATION",
    ...overrides,
  };
}

function command(overrides = {}) {
  return {
    actorAuthIdentityId: "actor-1",
    commandId: "command-1",
    correlationId: "correlation-1",
    enrollmentId: "enrollment-1",
    responsibleRelationshipId: "relationship-1",
    ...overrides,
  };
}
