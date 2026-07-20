const assert = require("node:assert/strict");
const test = require("node:test");

const { EnrollmentFacade } = require("../facades/enrollment.facade.js");
const {
  ENROLLMENT_CLASS_LINK_ACCESS_DENIED_CODE,
  ENROLLMENT_CLASS_LINK_CLASS_FULL_CODE,
  ENROLLMENT_CLASS_LINK_INPUT_INVALID_CODE,
  ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS_CODE,
  ENROLLMENT_CLASS_LINK_INVALID_ENROLLMENT_STATUS_CODE,
  ENROLLMENT_CLASS_LINK_REACTIVATION_BLOCKED_CODE,
  ENROLLMENT_CLASS_LINK_STATE_CONFLICT_CODE,
  ENROLLMENT_CLASS_LINK_TRANSFER_CONFLICT_CODE,
  EnrollmentClassLinkService,
} = require("../services/enrollment-class-link.service.js");

test("transferEnrollmentToClass moves a single active link and returns a frozen minimal DTO", async () => {
  const logs = [];
  const events = [];
  const activeSource = activeLink("link-current", "enrollment-transfer", 10);
  const service = createTransferService({
    events,
    logger: createLogger(logs),
    sourceLinks: [activeSource],
  });

  const result = await service.transferEnrollmentToClass(
    { enrollmentId: "enrollment-transfer", targetClassId: 20 },
    {
      actorId: "actor-transfer",
      authorization: { sensitiveRole: "unit-admin" },
      correlationId: "correlation-transfer",
      requestId: "request-transfer",
    },
  );

  assert.deepEqual(result, {
    enrollmentClassLinkId: "link-created-20",
    enrollmentId: "enrollment-transfer",
    previousClassId: 10,
    previousEnrollmentClassLinkId: "link-current",
    status: "ACTIVE",
    targetClassId: 20,
    created: true,
    reused: false,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(Object.keys(result).sort(), [
    "created",
    "enrollmentClassLinkId",
    "enrollmentId",
    "previousClassId",
    "previousEnrollmentClassLinkId",
    "reused",
    "status",
    "targetClassId",
  ]);
  assert.deepEqual(events.map((event) => event.type), [
    "authorize",
    "transaction",
    "findEnrollmentById",
    "findActiveByEnrollment",
    "findLatestByEnrollmentAndClass",
    "findActiveClassById",
    "ensureClassHasAvailableCapacity",
    "unlinkActiveLink",
    "createActiveLinkIfNotExists",
    "ensureClassHasAvailableCapacity",
  ]);
  assert.equal(events.find((event) => event.type === "authorize").input.operation, "transferEnrollmentToClass");
  assert.equal(Object.isFrozen(events.find((event) => event.type === "authorize").input), true);
  assert.deepEqual(events.find((event) => event.type === "unlinkActiveLink").input, {
    classId: 10,
    enrollmentId: "enrollment-transfer",
    unlinkedBy: "actor-transfer",
  });
  assert.deepEqual(events.find((event) => event.type === "createActiveLinkIfNotExists").input, {
    classId: 20,
    enrollmentId: "enrollment-transfer",
    linkedBy: "actor-transfer",
    metadata: {
      correlationId: "correlation-transfer",
      requestId: "request-transfer",
    },
    origin: "canonical_transfer",
  });
  assert.equal(JSON.stringify(result).includes("studentId"), false);
  assert.equal(JSON.stringify(logs).includes("sensitiveRole"), false);
});

test("transferEnrollmentToClass is idempotent when target is already the only active class", async () => {
  const events = [];
  const service = createTransferService({
    events,
    sourceLinks: [activeLink("link-same", "enrollment-same", 30)],
  });

  const result = await service.transferEnrollmentToClass(
    { enrollmentId: "enrollment-same", targetClassId: 30 },
    { actorId: "actor-same", authorization: {} },
  );

  assert.deepEqual(result, {
    enrollmentClassLinkId: "link-same",
    enrollmentId: "enrollment-same",
    previousClassId: null,
    previousEnrollmentClassLinkId: null,
    status: "ACTIVE",
    targetClassId: 30,
    created: false,
    reused: true,
  });
  assert.equal(events.some((event) => event.type === "unlinkActiveLink"), false);
  assert.equal(events.some((event) => event.type === "createActiveLinkIfNotExists"), false);
});

test("transferEnrollmentToClass rejects forged command fields before authorization", async () => {
  const events = [];
  const service = createTransferService({ events });

  await assert.rejects(
    () =>
      service.transferEnrollmentToClass(
        {
          enrollmentId: "enrollment-forged",
          targetClassId: 40,
          linkedBy: "forged",
          status: "INACTIVE",
          studentId: "student-forged",
          unitId: "unit-forged",
        },
        { actorId: "actor-forged", authorization: {} },
      ),
    {
      code: ENROLLMENT_CLASS_LINK_INPUT_INVALID_CODE,
      unexpectedFields: ["linkedBy", "status", "studentId", "unitId"],
    },
  );
  assert.equal(events.length, 0);
});

test("transferEnrollmentToClass fails closed when authorization is absent, false or throws", async (t) => {
  const cases = [
    ["absent", null],
    ["denied", async () => false],
    [
      "throws",
      async () => {
        throw new Error("authorization unavailable");
      },
    ],
  ];

  for (const [name, authorizeClassAssignment] of cases) {
    await t.test(name, async () => {
      const events = [];
      const service = createTransferService({ authorizeClassAssignment, events });

      await assert.rejects(
        () =>
          service.transferEnrollmentToClass(
            { enrollmentId: "enrollment-auth", targetClassId: 50 },
            { actorId: "actor-auth", authorization: {} },
          ),
        { code: ENROLLMENT_CLASS_LINK_ACCESS_DENIED_CODE },
      );
      assert.equal(events.some((event) => event.type === "transaction"), false);
    });
  }
});

test("transferEnrollmentToClass blocks missing or ambiguous active source links", async (t) => {
  const cases = [
    ["missing", []],
    [
      "ambiguous",
      [
        activeLink("link-a", "enrollment-ambiguous", 60),
        activeLink("link-b", "enrollment-ambiguous", 61),
      ],
    ],
  ];

  for (const [name, sourceLinks] of cases) {
    await t.test(name, async () => {
      const events = [];
      const service = createTransferService({ events, sourceLinks });

      await assert.rejects(
        () =>
          service.transferEnrollmentToClass(
            { enrollmentId: "enrollment-ambiguous", targetClassId: 62 },
            { actorId: "actor-ambiguous", authorization: {} },
          ),
        { code: ENROLLMENT_CLASS_LINK_TRANSFER_CONFLICT_CODE },
      );
      assert.equal(events.some((event) => event.type === "unlinkActiveLink"), false);
      assert.equal(events.some((event) => event.type === "createActiveLinkIfNotExists"), false);
    });
  }
});

test("transferEnrollmentToClass preserves the current link when target history is incompatible", async () => {
  const events = [];
  const service = createTransferService({
    events,
    latestLink: {
      classId: 70,
      enrollmentId: "enrollment-history",
      id: "link-inactive-history",
      status: "INACTIVE",
    },
    sourceLinks: [activeLink("link-current-history", "enrollment-history", 69)],
  });

  await assert.rejects(
    () =>
      service.transferEnrollmentToClass(
        { enrollmentId: "enrollment-history", targetClassId: 70 },
        { actorId: "actor-history", authorization: {} },
      ),
    {
      code: ENROLLMENT_CLASS_LINK_STATE_CONFLICT_CODE,
      existingLinkId: "link-inactive-history",
      existingStatus: "INACTIVE",
    },
  );
  assert.equal(events.some((event) => event.type === "unlinkActiveLink"), false);
  assert.equal(events.some((event) => event.type === "createActiveLinkIfNotExists"), false);
});

test("transferEnrollmentToClass maps inactive and full target classes without mutating links", async (t) => {
  const cases = [
    ["inactive", { activeClass: null, classRecord: { id: 80, status: "INACTIVE" } }, ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS_CODE],
    ["full", { capacityErrorCode: ENROLLMENT_CLASS_LINK_CLASS_FULL_CODE }, ENROLLMENT_CLASS_LINK_CLASS_FULL_CODE],
  ];

  for (const [name, options, code] of cases) {
    await t.test(name, async () => {
      const events = [];
      const service = createTransferService({
        ...options,
        events,
        sourceLinks: [activeLink("link-current-capacity", "enrollment-capacity", 79)],
      });

      await assert.rejects(
        () =>
          service.transferEnrollmentToClass(
            { enrollmentId: "enrollment-capacity", targetClassId: 80 },
            { actorId: "actor-capacity", authorization: {} },
          ),
        { code },
      );
      assert.equal(events.some((event) => event.type === "unlinkActiveLink"), false);
      assert.equal(events.some((event) => event.type === "createActiveLinkIfNotExists"), false);
    });
  }
});

test("transferEnrollmentToClass rejects incompatible Enrollment status before class mutation", async () => {
  const events = [];
  const service = createTransferService({
    enrollment: { id: "enrollment-inactive", status: "INACTIVE" },
    events,
    sourceLinks: [activeLink("link-current-inactive", "enrollment-inactive", 90)],
  });

  await assert.rejects(
    () =>
      service.transferEnrollmentToClass(
        { enrollmentId: "enrollment-inactive", targetClassId: 91 },
        { actorId: "actor-inactive", authorization: {} },
      ),
    { code: ENROLLMENT_CLASS_LINK_INVALID_ENROLLMENT_STATUS_CODE },
  );
  assert.equal(events.some((event) => event.type === "findActiveByEnrollment"), false);
  assert.equal(events.some((event) => event.type === "unlinkActiveLink"), false);
});

test("transferEnrollmentToClass leaves rollback responsibility to the transaction runner after create failure", async () => {
  const events = [];
  const createError = new Error("create failed");
  const service = createTransferService({
    createError,
    events,
    sourceLinks: [activeLink("link-before-failure", "enrollment-failure", 100)],
  });

  await assert.rejects(
    () =>
      service.transferEnrollmentToClass(
        { enrollmentId: "enrollment-failure", targetClassId: 101 },
        { actorId: "actor-failure", authorization: {} },
      ),
    createError,
  );
  assert.deepEqual(events.map((event) => event.type).filter((type) => type.includes("Link")), [
    "unlinkActiveLink",
    "createActiveLinkIfNotExists",
  ]);
});

test("reactivateEnrollmentClassLink blocks INACTIVE history without implicit reactivation", async () => {
  const service = createReactivationService({
    activeLinks: [],
    latestLink: {
      classId: 110,
      enrollmentId: "enrollment-reactivate",
      id: "link-inactive-reactivate",
      status: "INACTIVE",
    },
  });

  await assert.rejects(
    () =>
      service.reactivateEnrollmentClassLink(
        { enrollmentId: "enrollment-reactivate", classId: 110 },
        { actorId: "actor-reactivate", authorization: {} },
      ),
    {
      code: ENROLLMENT_CLASS_LINK_REACTIVATION_BLOCKED_CODE,
      existingLinkId: "link-inactive-reactivate",
      existingStatus: "INACTIVE",
    },
  );
});

test("reactivateEnrollmentClassLink is idempotent when the requested link is already ACTIVE", async () => {
  const result = await createReactivationService({
    activeLinks: [activeLink("link-active-reactivate", "enrollment-active-reactivate", 120)],
    latestLink: activeLink("link-active-reactivate", "enrollment-active-reactivate", 120),
  }).reactivateEnrollmentClassLink(
    { enrollmentId: "enrollment-active-reactivate", classId: 120 },
    { actorId: "actor-reactivate", authorization: {} },
  );

  assert.deepEqual(result, {
    enrollmentClassLinkId: "link-active-reactivate",
    enrollmentId: "enrollment-active-reactivate",
    classId: 120,
    status: "ACTIVE",
    created: false,
  });
  assert.equal(Object.isFrozen(result), true);
});

test("reactivateEnrollmentClassLink rejects forged fields and missing history", async (t) => {
  await t.test("forged fields", async () => {
    await assert.rejects(
      () =>
        createReactivationService({}).reactivateEnrollmentClassLink(
          {
            enrollmentId: "enrollment-forged-reactivation",
            classId: 130,
            linkedBy: "forged",
            status: "ACTIVE",
            studentId: "student-forged",
            unitId: "unit-forged",
          },
          { actorId: "actor-reactivation", authorization: {} },
        ),
      {
        code: ENROLLMENT_CLASS_LINK_INPUT_INVALID_CODE,
        unexpectedFields: ["linkedBy", "status", "studentId", "unitId"],
      },
    );
  });

  await t.test("missing inactive history", async () => {
    await assert.rejects(
      () =>
        createReactivationService({ latestLink: null }).reactivateEnrollmentClassLink(
          { enrollmentId: "enrollment-missing-reactivation", classId: 131 },
          { actorId: "actor-reactivation", authorization: {} },
        ),
      { code: ENROLLMENT_CLASS_LINK_STATE_CONFLICT_CODE },
    );
  });
});

test("reactivateEnrollmentClassLink fails closed for authorization absence, denial and callback failure", async (t) => {
  const cases = [
    ["absent", null],
    ["denied", async () => false],
    [
      "throws",
      async () => {
        throw new Error("authorization failed");
      },
    ],
  ];

  for (const [name, authorizeClassAssignment] of cases) {
    await t.test(name, async () => {
      await assert.rejects(
        () =>
          createReactivationService({ authorizeClassAssignment }).reactivateEnrollmentClassLink(
            { enrollmentId: "enrollment-auth-reactivation", classId: 140 },
            { actorId: "actor-reactivation", authorization: {} },
          ),
        { code: ENROLLMENT_CLASS_LINK_ACCESS_DENIED_CODE },
      );
    });
  }
});

test("EnrollmentFacade delegates transfer and reactivation commands unchanged", async () => {
  const calls = [];
  const facade = new EnrollmentFacade({
    enrollmentClassLinkService: {
      async transferEnrollmentToClass(command, context) {
        calls.push({ method: "transfer", command, context });
        return { enrollmentClassLinkId: "link-transfer" };
      },
      async reactivateEnrollmentClassLink(command, context) {
        calls.push({ method: "reactivate", command, context });
        return { enrollmentClassLinkId: "link-reactivate" };
      },
    },
  });
  const transferCommand = { enrollmentId: "enrollment-facade", targetClassId: 150 };
  const reactivateCommand = { enrollmentId: "enrollment-facade", classId: 151 };
  const context = { actorId: "actor-facade" };

  assert.deepEqual(await facade.transferEnrollmentToClass(transferCommand, context), {
    enrollmentClassLinkId: "link-transfer",
  });
  assert.deepEqual(await facade.reactivateEnrollmentClassLink(reactivateCommand, context), {
    enrollmentClassLinkId: "link-reactivate",
  });
  assert.deepEqual(calls, [
    { method: "transfer", command: transferCommand, context },
    { method: "reactivate", command: reactivateCommand, context },
  ]);
});

function createTransferService(options = {}) {
  const events = options.events || [];
  const authorization =
    "authorizeClassAssignment" in options ? options.authorizeClassAssignment : async () => true;
  const repository = {
    async createActiveLinkIfNotExists(input) {
      events.push({ type: "createActiveLinkIfNotExists", input });

      if (options.createError) {
        throw options.createError;
      }

      return {
        created: true,
        link: activeLink(`link-created-${input.classId}`, input.enrollmentId, input.classId),
      };
    },
    async findActiveByEnrollment(input) {
      events.push({ type: "findActiveByEnrollment", input });
      return options.sourceLinks || [activeLink("link-current-default", input.enrollmentId, 1)];
    },
    async findLatestByEnrollmentAndClass(input) {
      events.push({ type: "findLatestByEnrollmentAndClass", input });
      return options.latestLink || null;
    },
    async unlinkActiveLink(input) {
      events.push({ type: "unlinkActiveLink", input });
      return activeLink("link-unlinked", input.enrollmentId, input.classId, "INACTIVE");
    },
  };

  return new EnrollmentClassLinkService({
    authorizeClassAssignment(input) {
      if (!authorization) {
        return false;
      }

      events.push({ type: "authorize", input });
      return authorization(input);
    },
    classFacade: {
      async ensureClassHasAvailableCapacity(input) {
        events.push({ type: "ensureClassHasAvailableCapacity", input });

        if (options.capacityErrorCode) {
          const error = new Error(options.capacityErrorCode);
          error.code = options.capacityErrorCode;
          throw error;
        }

        return { available: true };
      },
      async findActiveClassById(input) {
        events.push({ type: "findActiveClassById", input });
        return "activeClass" in options ? options.activeClass : { id: input.classId, status: "ACTIVE" };
      },
      async ensureClassOccupancyWithinCapacity(input) {
        return this.ensureClassHasAvailableCapacity(input);
      },
      async findClassById(input) {
        events.push({ type: "findClassById", input });
        return options.classRecord || null;
      },
    },
    classLinkRepository: repository,
    enrollmentReader: {
      async findEnrollmentById(id) {
        events.push({ type: "findEnrollmentById", id });
        return options.enrollment || { id, status: "ACTIVE" };
      },
    },
    logger: options.logger || createLogger([]),
    transactionRunner: async (work) => {
      events.push({ type: "transaction" });
      return work({
        classCapacityTransactionEnabled: true,
        classFacade: undefined,
        classLinkRepository: repository,
      });
    },
  });
}

function createReactivationService(options = {}) {
  const authorization =
    "authorizeClassAssignment" in options ? options.authorizeClassAssignment : async () => true;
  const repository = {
    async findActiveByEnrollment() {
      return options.activeLinks || [];
    },
    async findLatestByEnrollmentAndClass() {
      return "latestLink" in options
        ? options.latestLink
        : activeLink("link-reactivation-default", "enrollment-reactivation-default", 1, "INACTIVE");
    },
  };

  return new EnrollmentClassLinkService({
    authorizeClassAssignment(input) {
      if (!authorization) {
        return false;
      }

      return authorization(input);
    },
    classLinkRepository: repository,
    transactionRunner: async (work) => work({ classLinkRepository: repository }),
  });
}

function activeLink(id, enrollmentId, classId, status = "ACTIVE") {
  return {
    classId,
    enrollmentId,
    id,
    status,
  };
}

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

