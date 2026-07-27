const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DigitalEnrollmentActivationTransactionBoundaryService,
} = require("../services/digital-enrollment-activation-transaction-boundary.service.js");

const BLOCKED_RESULT = Object.freeze({
  activationAllowed: false,
  activationAttempted: true,
  activationExecuted: false,
  blocker: "DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE",
  enrollmentId: "enrollment-1",
  enrollmentStatus: "DRAFT",
  result: "BLOCKED",
});

test("invalid commands are rejected before authorization and executor calls", async (t) => {
  for (const invalidCommand of [
    null,
    {},
    command({ token: "secret" }),
    command({ enrollmentId: "x y" }),
  ]) {
    await t.test(String(invalidCommand), async () => {
      const { calls, service } = fixture();

      await assert.rejects(() => service.execute(invalidCommand), {
        code: "DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_INVALID_COMMAND",
      });
      assert.deepEqual(calls, { authorization: 0, executor: 0 });
    });
  }
});

test("authorization is fail-closed and happens before executor calls", async (t) => {
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
          ? "DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_FORBIDDEN"
          : "DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_NOT_CONFIGURED",
      });
      assert.equal(calls.executor, 0);
    });
  }
});

test("missing executor fails closed", async () => {
  const { service } = fixture({ activationExecutor: null });

  await assert.rejects(() => service.execute(command()), {
    code: "DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_NOT_CONFIGURED",
  });
});

test("blocked executor result returns an immutable canonical DTO and safe log", async () => {
  const { executorCommands, logs, service } = fixture();

  const result = await service.execute(command());

  assert.deepEqual(executorCommands, [command()]);
  assert.deepEqual(result, BLOCKED_RESULT);
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(logs, [
    [
      "[enrollments] digital activation transaction boundary blocked",
      {
        blocker: "DIGITAL_ENROLLMENT_ACTIVATION_NOT_AVAILABLE",
        enrollmentId: "enrollment-1",
        result: "BLOCKED",
      },
    ],
  ]);
  const serializedLogs = JSON.stringify(logs);
  assert.equal(serializedLogs.includes("actor-1"), false);
  assert.equal(serializedLogs.includes("relationship-1"), false);
  assert.equal(serializedLogs.includes("command-1"), false);
});

test("executor attempts to activate or changes canonical state are rejected", async (t) => {
  for (const executorResult of [
    { ...BLOCKED_RESULT, activationAllowed: true },
    { ...BLOCKED_RESULT, activationExecuted: true },
    { ...BLOCKED_RESULT, result: "ACTIVATED" },
    { ...BLOCKED_RESULT, blocker: "OTHER" },
    { ...BLOCKED_RESULT, enrollmentId: "enrollment-2" },
    { ...BLOCKED_RESULT, enrollmentStatus: "ACTIVE" },
  ]) {
    await t.test(JSON.stringify(executorResult), async () => {
      const { service } = fixture({ executorResult });

      await assert.rejects(() => service.execute(command()), {
        code: "DIGITAL_ENROLLMENT_ACTIVATION_TRANSACTION_BOUNDARY_UNSAFE_RESULT",
      });
    });
  }
});

test("boundary opens no transaction, performs no write and has no downstream collaborator", async () => {
  const sideEffects = [];
  const { service } = fixture({
    classLinkService: { create: () => sideEffects.push("class-link") },
    enrollmentWriter: { update: () => sideEffects.push("enrollment") },
    financialService: { create: () => sideEffects.push("financial") },
    notificationService: { send: () => sideEffects.push("notification") },
    scheduleService: { create: () => sideEffects.push("schedule") },
    transactionRunner: () => sideEffects.push("transaction"),
  });

  await service.execute(command());

  assert.deepEqual(sideEffects, []);
  assert.equal("classLinkService" in service, false);
  assert.equal("enrollmentWriter" in service, false);
  assert.equal("financialService" in service, false);
  assert.equal("notificationService" in service, false);
  assert.equal("scheduleService" in service, false);
  assert.equal("transactionRunner" in service, false);
});

function fixture(overrides = {}) {
  const calls = { authorization: 0, executor: 0 };
  const executorCommands = [];
  const logs = [];
  const authorizationPolicy = Object.prototype.hasOwnProperty.call(overrides, "authorizationPolicy")
    ? overrides.authorizationPolicy
    : {
        async authorize() {
          calls.authorization += 1;
          return true;
        },
      };
  const activationExecutor = Object.prototype.hasOwnProperty.call(overrides, "activationExecutor")
    ? overrides.activationExecutor
    : {
        async execute(input) {
          calls.executor += 1;
          executorCommands.push(input);
          return Object.prototype.hasOwnProperty.call(overrides, "executorResult")
            ? overrides.executorResult
            : BLOCKED_RESULT;
        },
      };
  const service = new DigitalEnrollmentActivationTransactionBoundaryService({
    activationExecutor,
    authorizationPolicy,
    logger: { info: (...args) => logs.push(args) },
    ...overrides,
  });

  return { calls, executorCommands, logs, service };
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
