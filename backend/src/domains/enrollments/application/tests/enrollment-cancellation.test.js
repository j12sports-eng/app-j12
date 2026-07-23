const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_CANCEL_ACCESS_DENIED_CODE,
  ENROLLMENT_CANCEL_FAILED_CODE,
  ENROLLMENT_CANCEL_INPUT_INVALID_CODE,
  ENROLLMENT_CANCEL_INPUT_REQUIRED_CODE,
  ENROLLMENT_CANCEL_NOT_FOUND_CODE,
  ENROLLMENT_STATE_CONFLICT_CODE,
  EnrollmentApplicationService,
} = require("../services/enrollment-application.service.js");

test("cancelEnrollment cancels ACTIVE Enrollment through conditional persistence", async () => {
  const authorizationCalls = [];
  const repository = new FakeCancellationRepository();
  repository.seed({ id: "enrollment-active", status: "ACTIVE" });
  const service = new EnrollmentApplicationService({
    authorizeEnrollmentCancellation(input) {
      authorizationCalls.push(input);
      return true;
    },
    enrollmentRepository: repository,
  });

  const result = await service.cancelEnrollment(
    { enrollmentId: "enrollment-active" },
    {
      actorId: "actor-1",
      authorization: { role: "admin" },
      correlationId: "correlation-1",
      requestId: "request-1",
    },
  );

  assert.deepEqual(result, {
    changed: true,
    enrollmentId: "enrollment-active",
    previousStatus: "ACTIVE",
    status: "CANCELLED",
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(repository.records.get("enrollment-active").status, "CANCELLED");
  assert.deepEqual(repository.cancelCalls, [
    {
      enrollmentId: "enrollment-active",
      expectedStatus: "ACTIVE",
      status: "CANCELLED",
    },
  ]);
  assert.equal(authorizationCalls[0].operation, "cancelEnrollment");
  assert.equal(Object.isFrozen(authorizationCalls[0]), true);
  assert.equal(JSON.stringify(result).includes("studentPersonId"), false);
});

test("cancelEnrollment is idempotent for an already CANCELLED Enrollment", async () => {
  const repository = new FakeCancellationRepository();
  repository.seed({ id: "enrollment-cancelled", status: "CANCELLED" });
  const service = createCancellationService(repository);

  const result = await service.cancelEnrollment(
    { enrollmentId: "enrollment-cancelled" },
    { actorId: "actor-1" },
  );

  assert.deepEqual(result, {
    changed: false,
    enrollmentId: "enrollment-cancelled",
    previousStatus: "CANCELLED",
    status: "CANCELLED",
  });
  assert.deepEqual(repository.cancelCalls, []);
});

test("cancelEnrollment blocks incompatible states", async (t) => {
  for (const status of ["DRAFT", "PENDING", "SUSPENDED", "FINISHED"]) {
    await t.test(status, async () => {
      const repository = new FakeCancellationRepository();
      repository.seed({ id: `enrollment-${status.toLowerCase()}`, status });
      const service = createCancellationService(repository);

      await assert.rejects(
        () =>
          service.cancelEnrollment(
            { enrollmentId: `enrollment-${status.toLowerCase()}` },
            { actorId: "actor-1" },
          ),
        { code: ENROLLMENT_STATE_CONFLICT_CODE, currentStatus: status },
      );
      assert.deepEqual(repository.cancelCalls, []);
    });
  }
});

test("cancelEnrollment fails for missing or invalid input", async (t) => {
  const cases = [
    ["empty command", {}, ENROLLMENT_CANCEL_INPUT_REQUIRED_CODE],
    ["invalid id", { enrollmentId: "invalid id" }, ENROLLMENT_CANCEL_INPUT_INVALID_CODE],
  ];

  for (const [name, command, code] of cases) {
    await t.test(name, async () => {
      const repository = new FakeCancellationRepository();
      const service = createCancellationService(repository);

      await assert.rejects(() => service.cancelEnrollment(command, { actorId: "actor-1" }), {
        code,
      });
      assert.equal(repository.findCalls.length, 0);
    });
  }
});

test("cancelEnrollment rejects mass assignment before authorization", async () => {
  let authorized = false;
  const service = new EnrollmentApplicationService({
    authorizeEnrollmentCancellation() {
      authorized = true;
      return true;
    },
    enrollmentRepository: new FakeCancellationRepository(),
  });

  await assert.rejects(
    () =>
      service.cancelEnrollment(
        {
          enrollmentId: "enrollment-forged",
          actorId: "forged-actor",
          authorization: { allowed: true },
          cancelledBy: "forged",
          reason: "unsupported",
          status: "CANCELLED",
        },
        { actorId: "actor-1" },
      ),
    {
      code: ENROLLMENT_CANCEL_INPUT_INVALID_CODE,
      unexpectedFields: ["actorId", "authorization", "cancelledBy", "reason", "status"],
    },
  );
  assert.equal(authorized, false);
});

test("cancelEnrollment fails closed when authorization is absent, false or throws", async (t) => {
  const cases = [
    ["absent", null],
    ["false", async () => false],
    [
      "throws",
      async () => {
        throw new Error("authorization unavailable");
      },
    ],
  ];

  for (const [name, authorizeEnrollmentCancellation] of cases) {
    await t.test(name, async () => {
      const repository = new FakeCancellationRepository();
      repository.seed({ id: "enrollment-auth", status: "ACTIVE" });
      const service = new EnrollmentApplicationService({
        authorizeEnrollmentCancellation,
        enrollmentRepository: repository,
      });

      await assert.rejects(
        () => service.cancelEnrollment({ enrollmentId: "enrollment-auth" }, { actorId: "actor-1" }),
        { code: ENROLLMENT_CANCEL_ACCESS_DENIED_CODE },
      );
      assert.equal(repository.findCalls.length, 0);
    });
  }
});

test("cancelEnrollment requires trusted actor context", async () => {
  const repository = new FakeCancellationRepository();
  repository.seed({ id: "enrollment-context", status: "ACTIVE" });
  const service = createCancellationService(repository);

  await assert.rejects(() => service.cancelEnrollment({ enrollmentId: "enrollment-context" }, {}), {
    code: ENROLLMENT_CANCEL_INPUT_REQUIRED_CODE,
    hasActorId: false,
  });
  assert.equal(repository.findCalls.length, 0);
});

test("cancelEnrollment fails when Enrollment is not found", async () => {
  const repository = new FakeCancellationRepository();
  const service = createCancellationService(repository);

  await assert.rejects(
    () => service.cancelEnrollment({ enrollmentId: "missing-enrollment" }, { actorId: "actor-1" }),
    { code: ENROLLMENT_CANCEL_NOT_FOUND_CODE },
  );
});

test("cancelEnrollment rereads after affectedRows zero and returns concurrent idempotency", async () => {
  const repository = new FakeCancellationRepository({ changed: false });
  repository.seed({ id: "enrollment-concurrent", status: "ACTIVE" });
  repository.afterCancel = () => repository.seed({ id: "enrollment-concurrent", status: "CANCELLED" });
  const service = createCancellationService(repository);

  const result = await service.cancelEnrollment(
    { enrollmentId: "enrollment-concurrent" },
    { actorId: "actor-1" },
  );

  assert.deepEqual(result, {
    changed: false,
    enrollmentId: "enrollment-concurrent",
    previousStatus: "CANCELLED",
    status: "CANCELLED",
  });
  assert.equal(repository.findCalls.length, 2);
});

test("cancelEnrollment blocks concurrent transition to another status", async () => {
  const repository = new FakeCancellationRepository({ changed: false });
  repository.seed({ id: "enrollment-concurrent-finished", status: "ACTIVE" });
  repository.afterCancel = () => repository.seed({ id: "enrollment-concurrent-finished", status: "FINISHED" });
  const service = createCancellationService(repository);

  await assert.rejects(
    () =>
      service.cancelEnrollment(
        { enrollmentId: "enrollment-concurrent-finished" },
        { actorId: "actor-1" },
      ),
    { code: ENROLLMENT_STATE_CONFLICT_CODE, currentStatus: "FINISHED" },
  );
  assert.equal(repository.findCalls.length, 2);
});

test("cancelEnrollment maps repository failures to sanitized errors", async () => {
  const repository = new FakeCancellationRepository({ failure: new Error("SQL secret details") });
  repository.seed({ id: "enrollment-failure", status: "ACTIVE" });
  const service = createCancellationService(repository);

  await assert.rejects(
    () => service.cancelEnrollment({ enrollmentId: "enrollment-failure" }, { actorId: "actor-1" }),
    { code: ENROLLMENT_CANCEL_FAILED_CODE, enrollmentId: "enrollment-failure" },
  );
});

test("cancelEnrollment does not touch external integrations", async () => {
  const repository = new FakeCancellationRepository();
  repository.seed({ id: "enrollment-isolated", status: "ACTIVE" });
  const service = new EnrollmentApplicationService({
    authorizeEnrollmentCancellation: async () => true,
    classFacade: failExternal("classes"),
    classLinkRepository: failExternal("class links"),
    enrollmentFinancialService: failExternal("financial"),
    enrollmentNotificationService: failExternal("notifications"),
    enrollmentRepository: repository,
  });

  await service.cancelEnrollment({ enrollmentId: "enrollment-isolated" }, { actorId: "actor-1" });
});

function createCancellationService(repository) {
  return new EnrollmentApplicationService({
    authorizeEnrollmentCancellation: async () => true,
    enrollmentRepository: repository,
  });
}

function failExternal(name) {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(`${name} must not be touched`);
      },
    },
  );
}

class FakeCancellationRepository {
  constructor({ changed = true, failure = null } = {}) {
    this.afterCancel = null;
    this.cancelCalls = [];
    this.changed = changed;
    this.failure = failure;
    this.findCalls = [];
    this.records = new Map();
  }

  seed(record) {
    this.records.set(record.id, { ...record });
  }

  async findById(id) {
    this.findCalls.push(id);
    const record = this.records.get(id);
    return record ? { ...record } : null;
  }

  async cancelActiveEnrollment(input) {
    this.cancelCalls.push({ ...input });

    if (this.failure) {
      throw this.failure;
    }

    if (this.afterCancel) {
      this.afterCancel();
    }

    const current = this.records.get(input.enrollmentId);

    if (this.changed && current?.status === input.expectedStatus) {
      this.records.set(input.enrollmentId, { ...current, status: input.status });
      return { changed: true };
    }

    return { changed: false };
  }
}