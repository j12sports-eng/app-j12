const assert = require("node:assert/strict");
const test = require("node:test");

const { EnrollmentFacade } = require("../facades/enrollment.facade.js");
const {
  ENROLLMENT_CLASS_LINK_ACCESS_DENIED_CODE,
  ENROLLMENT_CLASS_LINK_CLASS_FULL_CODE,
  ENROLLMENT_CLASS_LINK_INPUT_INVALID_CODE,
  ENROLLMENT_CLASS_LINK_RESULT_INVALID_CODE,
  ENROLLMENT_CLASS_LINK_STATE_CONFLICT_CODE,
  EnrollmentClassLinkService,
} = require("../services/enrollment-class-link.service.js");

test("assignEnrollmentToClass authorizes trusted context and returns a frozen minimal DTO", async () => {
  const authorizationCalls = [];
  const linkCalls = [];
  const logs = [];
  let now = 100;
  const service = new EnrollmentClassLinkService({
    authorizeClassAssignment(input) {
      authorizationCalls.push(input);
      return true;
    },
    clock() {
      now += 5;
      return now;
    },
    logger: createLogger(logs),
  });

  service.linkActiveEnrollmentToClass = async (input) => {
    linkCalls.push(input);
    return {
      classValidation: { capacity: 20 },
      created: true,
      link: {
        classId: 42,
        enrollmentId: "enrollment-1",
        id: "link-1",
        linkedBy: "actor-1",
        status: "ACTIVE",
      },
      persisted: true,
    };
  };

  const result = await service.assignEnrollmentToClass(
    { classId: 42, enrollmentId: "enrollment-1" },
    {
      actorId: "actor-1",
      authorization: { unitMembership: "verified" },
      correlationId: "correlation-1",
      requestId: "request-1",
    },
  );

  assert.deepEqual(result, {
    enrollmentClassLinkId: "link-1",
    enrollmentId: "enrollment-1",
    classId: 42,
    status: "ACTIVE",
    created: true,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(Object.keys(result).sort(), [
    "classId",
    "created",
    "enrollmentClassLinkId",
    "enrollmentId",
    "status",
  ]);
  assert.equal(Object.isFrozen(authorizationCalls[0]), true);
  assert.deepEqual(linkCalls, [
    {
      classId: 42,
      enrollmentId: "enrollment-1",
      linkedBy: "actor-1",
      metadata: {
        correlationId: "correlation-1",
        requestId: "request-1",
      },
      origin: "canonical_assignment",
      requireIncompatibleLinkCheck: true,
    },
  ]);
  assert.deepEqual(
    logs.map((entry) => entry.message),
    ["[enrollments] assignment_started", "[enrollments] assignment_created"],
  );
  assert.equal(JSON.stringify(logs).includes("unitMembership"), false);
});

test("assignEnrollmentToClass reports an idempotent reuse without exposing internal result", async () => {
  const service = new EnrollmentClassLinkService({
    authorizeClassAssignment: async () => true,
  });

  service.linkActiveEnrollmentToClass = async () => ({
    classValidation: { internal: true },
    created: false,
    link: {
      classId: 7,
      enrollmentId: "enrollment-reused",
      id: "link-reused",
      metadata: { private: true },
      status: "ACTIVE",
    },
    reused: true,
  });

  const result = await service.assignEnrollmentToClass(
    { classId: 7, enrollmentId: "enrollment-reused" },
    { actorId: "actor-2" },
  );

  assert.deepEqual(result, {
    enrollmentClassLinkId: "link-reused",
    enrollmentId: "enrollment-reused",
    classId: 7,
    status: "ACTIVE",
    created: false,
  });
});

test("assignEnrollmentToClass fails closed when authorization is absent, false or throws", async (t) => {
  const cases = [
    ["absent", null],
    ["false", async () => false],
    [
      "throws",
      async () => {
        throw new Error("authorization backend unavailable");
      },
    ],
  ];

  for (const [name, authorizeClassAssignment] of cases) {
    await t.test(name, async () => {
      let persistenceCalled = false;
      const service = new EnrollmentClassLinkService({ authorizeClassAssignment });
      service.linkActiveEnrollmentToClass = async () => {
        persistenceCalled = true;
      };

      await assert.rejects(
        () =>
          service.assignEnrollmentToClass(
            { classId: 1, enrollmentId: "enrollment-denied" },
            {
              actorId: "actor-denied",
              authorization: { globalRole: "admin" },
            },
          ),
        { code: ENROLLMENT_CLASS_LINK_ACCESS_DENIED_CODE },
      );
      assert.equal(persistenceCalled, false);
    });
  }
});

test("assignEnrollmentToClass rejects mass-assignment fields before authorization or persistence", async () => {
  let authorizationCalled = false;
  let persistenceCalled = false;
  const logs = [];
  const service = new EnrollmentClassLinkService({
    authorizeClassAssignment: async () => {
      authorizationCalled = true;
      return true;
    },
    logger: createLogger(logs),
  });
  service.linkActiveEnrollmentToClass = async () => {
    persistenceCalled = true;
  };

  await assert.rejects(
    () =>
      service.assignEnrollmentToClass(
        {
          classId: 1,
          enrollmentId: "enrollment-safe",
          linkedBy: "forged-actor",
          studentId: "forged-student",
          unitId: "forged-unit",
        },
        { actorId: "trusted-actor" },
      ),
    {
      code: ENROLLMENT_CLASS_LINK_INPUT_INVALID_CODE,
      unexpectedFields: ["linkedBy", "studentId", "unitId"],
    },
  );

  assert.equal(authorizationCalled, false);
  assert.equal(persistenceCalled, false);
  assert.equal(JSON.stringify(logs).includes("forged"), false);
});

test("assignEnrollmentToClass rejects an invalid class identifier before authorization", async () => {
  let authorizationCalled = false;
  const service = new EnrollmentClassLinkService({
    authorizeClassAssignment: async () => {
      authorizationCalled = true;
      return true;
    },
  });

  await assert.rejects(
    () =>
      service.assignEnrollmentToClass(
        { classId: "not-a-class", enrollmentId: "enrollment-safe" },
        { actorId: "trusted-actor" },
      ),
    {
      code: "ENROLLMENT_CLASS_LINK_INPUT_REQUIRED",
      hasClassId: false,
    },
  );
  assert.equal(authorizationCalled, false);
});

test("assignEnrollmentToClass preserves capacity errors and logs only safe operational context", async () => {
  const logs = [];
  const service = new EnrollmentClassLinkService({
    authorizeClassAssignment: async () => true,
    logger: createLogger(logs),
  });
  service.linkActiveEnrollmentToClass = async () => {
    const error = new Error("full");
    error.code = ENROLLMENT_CLASS_LINK_CLASS_FULL_CODE;
    error.studentName = "Sensitive Name";
    throw error;
  };

  await assert.rejects(
    () =>
      service.assignEnrollmentToClass(
        { classId: 2, enrollmentId: "enrollment-full" },
        { actorId: "actor-capacity" },
      ),
    { code: ENROLLMENT_CLASS_LINK_CLASS_FULL_CODE },
  );

  assert.equal(logs.at(-1).message, "[enrollments] assignment_capacity_exhausted");
  assert.equal(JSON.stringify(logs).includes("Sensitive Name"), false);
});

test("assignEnrollmentToClass rejects a mismatched persistence result", async () => {
  const service = new EnrollmentClassLinkService({
    authorizeClassAssignment: async () => true,
  });
  service.linkActiveEnrollmentToClass = async () => ({
    created: true,
    link: {
      classId: 99,
      enrollmentId: "another-enrollment",
      id: "link-invalid",
      status: "ACTIVE",
    },
  });

  await assert.rejects(
    () =>
      service.assignEnrollmentToClass(
        { classId: 3, enrollmentId: "expected-enrollment" },
        { actorId: "actor-result" },
      ),
    { code: ENROLLMENT_CLASS_LINK_RESULT_INVALID_CODE },
  );
});

test("assignEnrollmentToClass blocks an INACTIVE historical link without reactivation", async () => {
  let createCalled = false;
  const classLinkRepository = {
    async createActiveLinkIfNotExists() {
      createCalled = true;
    },
    async findActiveByEnrollmentAndClass() {
      return null;
    },
    async findLatestByEnrollmentAndClass() {
      return {
        classId: 5,
        enrollmentId: "enrollment-inactive",
        id: "inactive-link",
        status: "INACTIVE",
      };
    },
  };
  const service = new EnrollmentClassLinkService({
    authorizeClassAssignment: async () => true,
    transactionRunner: async (work) =>
      work({
        classLinkRepository,
        enrollmentReader: {
          async findEnrollmentById(id) {
            return { id, status: "ACTIVE" };
          },
        },
      }),
  });

  await assert.rejects(
    () =>
      service.assignEnrollmentToClass(
        { classId: 5, enrollmentId: "enrollment-inactive" },
        { actorId: "actor-conflict" },
      ),
    {
      code: ENROLLMENT_CLASS_LINK_STATE_CONFLICT_CODE,
      existingLinkId: "inactive-link",
      existingStatus: "INACTIVE",
    },
  );
  assert.equal(createCalled, false);
});

test("EnrollmentFacade delegates the canonical command and trusted context unchanged", async () => {
  const calls = [];
  const service = {
    async assignEnrollmentToClass(command, context) {
      calls.push({ command, context });
      return { enrollmentClassLinkId: "facade-link" };
    },
  };
  const facade = new EnrollmentFacade({
    enrollmentClassLinkService: service,
  });
  const command = { classId: 4, enrollmentId: "facade-enrollment" };
  const context = { actorId: "facade-actor" };

  const result = await facade.assignEnrollmentToClass(command, context);

  assert.deepEqual(result, { enrollmentClassLinkId: "facade-link" });
  assert.deepEqual(calls, [{ command, context }]);
});

function createLogger(entries) {
  return {
    error(message, context) {
      entries.push({ level: "error", message, context });
    },
    info(message, context) {
      entries.push({ level: "info", message, context });
    },
    warn(message, context) {
      entries.push({ level: "warn", message, context });
    },
  };
}
