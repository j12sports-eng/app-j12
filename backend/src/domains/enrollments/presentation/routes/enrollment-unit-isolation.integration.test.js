const assert = require("node:assert/strict");
const test = require("node:test");

const { EnrollmentFacade } = require("../../application/facades/enrollment.facade.js");
const { EnrollmentAdminController } = require("../controllers/enrollment-admin.controller.js");
const { EnrollmentPublicController } = require("../controllers/enrollment-public.controller.js");
const {
  createEnrollmentAdminRouter,
  ensureEnrollmentAdminAccess,
} = require("./enrollment-admin.routes.js");
const {
  createEnrollmentInvitationPublicRouter,
} = require("./enrollment-invitation-public.routes.js");
const {
  createEnrollmentPublicRouter,
  ensureEnrollmentPublicAccess,
} = require("./enrollment-public.routes.js");

const UNIT_A = "12";
const UNIT_B = "13";
const HOSTILE_UNIT = "999";
const STUDENT_PERSON_ID = "person-1";
const STUDENT_PROFILE_ID = "profile-1";
const ACTIVE_STUDENT_PERSON_ID = "person-2";
const ACTIVE_STUDENT_PROFILE_ID = "profile-2";

const SECURED_ROUTES = Object.freeze([
  {
    Controller: EnrollmentAdminController,
    createRouter: createEnrollmentAdminRouter,
    ensureAccess: ensureEnrollmentAdminAccess,
    name: "admin",
  },
  {
    Controller: EnrollmentPublicController,
    createRouter: createEnrollmentPublicRouter,
    ensureAccess: ensureEnrollmentPublicAccess,
    name: "secured public",
  },
]);

for (const route of SECURED_ROUTES) {
  test(`${route.name} mounted chain resolves canonical unit before the real controller`, async () => {
    const harness = createSecuredHarness({ route });

    const { res } = await dispatch(
      harness.router,
      hostileRequest({
        method: "GET",
        url: "/status?unitId=999&unit_id=999",
      }),
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(harness.order.slice(0, 4), [
      "requireAuth",
      "authorization",
      "actorContext",
      "controller:getStatus",
    ]);
    assert.deepEqual(
      harness.repository.calls.map((call) => [call.operation, call.input.unitId]),
      [
        ["findDraftByStudent", UNIT_A],
        ["findActiveByStudent", UNIT_A],
      ],
    );
  });
}

test("hostile request fields and a previous ActorContext cannot override persisted membership", async () => {
  const harness = createSecuredHarness({ route: SECURED_ROUTES[0] });
  const forgedActorContext = Object.freeze({
    authIdentityId: "attacker",
    unitContext: Object.freeze({ unitId: HOSTILE_UNIT }),
  });

  const { req, res } = await dispatch(
    harness.router,
    hostileRequest({
      actorContext: forgedActorContext,
      method: "GET",
      params: { unitId: HOSTILE_UNIT, unit_id: HOSTILE_UNIT },
      url: "/current-draft?unitId=999&unit_id=999",
    }),
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.id, "draft-12");
  assert.equal(res.body.data.unitId, UNIT_A);
  assert.equal(req.actorContext.unitContext.unitId, UNIT_A);
  assert.notEqual(req.actorContext, forgedActorContext);
  assert.equal(Object.isFrozen(req.actorContext), true);
  assert.equal(Object.isFrozen(req.actorContext.unitContext), true);
  assert.equal(harness.contextCalls.untrustedReaderCalls || 0, 0);
  assert.deepEqual(harness.repository.calls[0], {
    input: {
      studentPersonId: STUDENT_PERSON_ID,
      studentProfileId: STUDENT_PROFILE_ID,
      unitId: UNIT_A,
    },
    operation: "findDraftByStudent",
  });
});

test("two authenticated identities remain isolated despite identical hostile selectors", async () => {
  const harness = createSecuredHarness({ route: SECURED_ROUTES[1] });

  const unitA = await dispatch(
    harness.router,
    hostileRequest({
      authorization: "Bearer identity-a",
      method: "GET",
      url: "/current-draft?unitId=999",
    }),
  );
  const unitB = await dispatch(
    harness.router,
    hostileRequest({
      authorization: "Bearer identity-b",
      method: "GET",
      url: "/current-draft?unitId=999",
    }),
  );

  assert.equal(unitA.res.body.data.id, "draft-12");
  assert.equal(unitA.res.body.data.unitId, UNIT_A);
  assert.equal(unitB.res.body.data.id, "draft-13");
  assert.equal(unitB.res.body.data.unitId, UNIT_B);
  assert.deepEqual(
    harness.repository.calls.map((call) => call.input.unitId),
    [UNIT_A, UNIT_B],
  );
});

test("student search, status, DRAFT and ACTIVE reads consume only ActorContext unitId", async () => {
  const harness = createSecuredHarness({ route: SECURED_ROUTES[0] });
  const requests = [
    {
      expectedId: null,
      expectedOperation: "searchStudentScopes",
      query: { q: "student", unitId: HOSTILE_UNIT, unit_id: HOSTILE_UNIT },
      url: "/students/search?unitId=999",
    },
    {
      expectedId: null,
      expectedOperation: "findDraftByStudent",
      query: {
        studentPersonId: STUDENT_PERSON_ID,
        studentProfileId: STUDENT_PROFILE_ID,
        unitId: HOSTILE_UNIT,
        unit_id: HOSTILE_UNIT,
      },
      url: "/status?unitId=999",
    },
    {
      expectedId: "draft-12",
      expectedOperation: "findDraftByStudent",
      query: {
        studentPersonId: STUDENT_PERSON_ID,
        studentProfileId: STUDENT_PROFILE_ID,
        unitId: HOSTILE_UNIT,
        unit_id: HOSTILE_UNIT,
      },
      url: "/current-draft?unitId=999",
    },
    {
      expectedId: "active-12",
      expectedOperation: "findActiveByStudent",
      query: {
        studentPersonId: ACTIVE_STUDENT_PERSON_ID,
        studentProfileId: ACTIVE_STUDENT_PROFILE_ID,
        unitId: HOSTILE_UNIT,
        unit_id: HOSTILE_UNIT,
      },
      url: "/current-active?unitId=999",
    },
  ];

  for (const request of requests) {
    const before = harness.repository.calls.length;
    const { res } = await dispatch(
      harness.router,
      hostileRequest({
        method: "GET",
        query: request.query,
        url: request.url,
      }),
    );
    const calls = harness.repository.calls.slice(before);

    assert.equal(res.statusCode, 200);
    if (request.expectedId) assert.equal(res.body.data.id, request.expectedId);
    assert.equal(calls[0].operation, request.expectedOperation);
    assert.equal(
      calls.every((call) => call.input.unitId === UNIT_A),
      true,
    );
  }
});

test("confirmation compares ActorContext unit with persisted Enrollment ownership", async () => {
  const allowed = createSecuredHarness({ route: SECURED_ROUTES[0] });
  const allowedResult = await dispatch(
    allowed.router,
    hostileRequest({
      body: {
        confirmedBy: "actor@example.test",
        unitId: HOSTILE_UNIT,
        unit_id: HOSTILE_UNIT,
      },
      method: "POST",
      url: "/draft-12/confirm",
    }),
  );

  assert.equal(allowedResult.res.statusCode, 200);
  assert.equal(allowedResult.res.body.data.confirmed, true);
  assert.equal(
    allowed.repository.calls.some((call) => call.operation === "updateStatus"),
    true,
  );

  const denied = createSecuredHarness({ route: SECURED_ROUTES[0] });
  const deniedResult = await dispatch(
    denied.router,
    hostileRequest({
      authorization: "Bearer identity-b",
      body: {
        confirmedBy: "actor@example.test",
        unitId: UNIT_A,
        unit_id: UNIT_A,
      },
      method: "POST",
      url: "/draft-12/confirm",
    }),
  );

  assert.equal(deniedResult.res.statusCode, 404);
  assert.equal(deniedResult.res.body.code, "ENROLLMENT_UNIT_OWNERSHIP_CONFLICT");
  assert.equal(
    denied.repository.calls.some((call) => call.operation === "updateStatus"),
    false,
  );
});

test("missing active membership fails closed before controller and repository", async () => {
  const harness = createSecuredHarness({
    membershipsByIdentity: { "identity-a": [] },
    route: SECURED_ROUTES[0],
  });

  const { res } = await dispatch(harness.router, hostileRequest({ method: "GET", url: "/status" }));

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "UNIT_CONTEXT_MEMBERSHIP_NOT_AVAILABLE");
  assert.equal(harness.controllerCalls, 0);
  assert.deepEqual(harness.repository.calls, []);
});

test("ambiguous membership and unavailable units never select automatically", async (t) => {
  await t.test("two active memberships without default", async () => {
    const harness = createSecuredHarness({
      membershipsByIdentity: {
        "identity-a": [activeMembership(UNIT_A), activeMembership(UNIT_B)],
      },
      route: SECURED_ROUTES[0],
    });
    const { res } = await dispatch(
      harness.router,
      hostileRequest({ method: "GET", url: "/status" }),
    );

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, "UNIT_CONTEXT_SELECTION_REQUIRED");
    assert.equal(harness.controllerCalls, 0);
    assert.deepEqual(harness.repository.calls, []);
  });

  for (const [name, status] of [
    ["inactive", "inativo"],
    ["missing", null],
  ]) {
    await t.test(name, async () => {
      const harness = createSecuredHarness({
        route: SECURED_ROUTES[0],
        unitStatusById: { [UNIT_A]: status },
      });
      const { res } = await dispatch(
        harness.router,
        hostileRequest({ method: "GET", url: "/status" }),
      );

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, "UNIT_CONTEXT_UNIT_NOT_AVAILABLE");
      assert.equal(harness.controllerCalls, 0);
      assert.deepEqual(harness.repository.calls, []);
    });
  }
});

test("exactly one persisted default wins among multiple active memberships", async () => {
  const harness = createSecuredHarness({
    membershipsByIdentity: {
      "identity-a": [activeMembership(UNIT_A, { isDefault: true }), activeMembership(UNIT_B)],
    },
    route: SECURED_ROUTES[1],
  });

  const { req, res } = await dispatch(
    harness.router,
    hostileRequest({ method: "GET", url: "/current-draft?unitId=999" }),
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.id, "draft-12");
  assert.equal(req.actorContext.unitContext.unitId, UNIT_A);
  assert.equal(req.actorContext.unitContext.resolvedBy, "DEFAULT_MEMBERSHIP");
});

test("public invitation route stays authentication-independent and validates persisted ownership", async () => {
  const rawToken = "a".repeat(43);
  const publicCalls = [];
  const enrollmentRepository = new IsolatedEnrollmentRepository({
    calls: publicCalls,
    records: canonicalRecords(),
  });
  const invitationRepository = {
    async create() {
      throw new Error("not used");
    },
    async findByTokenHash(tokenHash) {
      publicCalls.push({ operation: "findByTokenHash", tokenHash });
      return {
        enrollmentId: "draft-12",
        expiresAt: "2026-08-01 12:00:00",
        id: "invitation-12",
        status: "ACTIVE",
        unitId: UNIT_A,
      };
    },
  };
  const router = createEnrollmentInvitationPublicRouter({
    clock: () => new Date("2026-07-29T12:00:00.000Z"),
    enrollmentFacade: new EnrollmentFacade({ enrollmentRepository }),
    invitationRepository,
  });

  const { res } = await dispatch(
    router,
    hostileRequest({
      auth: undefined,
      authorization: "",
      method: "GET",
      url: `/${rawToken}?unitId=999&unit_id=999`,
      user: undefined,
    }),
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal("unitId" in res.body.data, false);
  assert.equal(
    publicCalls.some((call) => call.operation === "findByTokenHash"),
    true,
  );
  assert.equal(
    publicCalls.some((call) => call.operation === "findById"),
    true,
  );

  const mismatchedRouter = createEnrollmentInvitationPublicRouter({
    clock: () => new Date("2026-07-29T12:00:00.000Z"),
    enrollmentFacade: new EnrollmentFacade({ enrollmentRepository }),
    invitationRepository: {
      async create() {
        throw new Error("not used");
      },
      async findByTokenHash() {
        return {
          enrollmentId: "draft-12",
          expiresAt: "2026-08-01 12:00:00",
          id: "invitation-13",
          status: "ACTIVE",
          unitId: UNIT_B,
        };
      },
    },
  });
  const mismatch = await dispatch(
    mismatchedRouter,
    hostileRequest({
      auth: undefined,
      authorization: "",
      method: "GET",
      url: `/${rawToken}?unitId=999`,
      user: undefined,
    }),
  );

  assert.equal(mismatch.res.statusCode, 404);
  assert.equal(mismatch.res.body.code, "RESOLVE_ENROLLMENT_INVITATION_NOT_AVAILABLE");
});

test("controlled failures and context logs omit token, payload, SQL and stack details", async () => {
  const harness = createSecuredHarness({
    membershipsByIdentity: { "identity-a": [] },
    route: SECURED_ROUTES[0],
  });
  const privateToken = "private-secret-token";

  const { res } = await dispatch(
    harness.router,
    hostileRequest({
      authorization: `Bearer ${privateToken}`,
      body: {
        name: "Private Student",
        unitId: HOSTILE_UNIT,
      },
      method: "GET",
      url: "/status",
    }),
  );
  const serialized = JSON.stringify({ body: res.body, logs: harness.logs });

  assert.equal(res.statusCode, 403);
  assert.equal(serialized.includes(privateToken), false);
  assert.equal(serialized.includes("Private Student"), false);
  assert.equal(serialized.includes("authorization"), false);
  assert.equal(serialized.includes("SELECT "), false);
  assert.equal(serialized.includes("stack"), false);
  assert.equal(serialized.includes("membership-"), false);
});

function createSecuredHarness({ membershipsByIdentity = null, route, unitStatusById = null } = {}) {
  const order = [];
  const logs = [];
  const contextCalls = {};
  const repository = new IsolatedEnrollmentRepository({
    order,
    records: canonicalRecords(),
  });
  const facade = new EnrollmentFacade({ enrollmentRepository: repository });
  const controller = new route.Controller({ enrollmentFacade: facade });
  let controllerCalls = 0;

  for (const method of [
    "searchStudentScopes",
    "getStatus",
    "getCurrentDraft",
    "getCurrentActive",
    "confirmDraft",
  ]) {
    if (typeof controller[method] !== "function") continue;
    const original = controller[method];
    controller[method] = (...args) => {
      controllerCalls += 1;
      order.push(`controller:${method}`);
      return original(...args);
    };
  }

  const memberships = membershipsByIdentity || {
    "identity-a": [activeMembership(UNIT_A, { isDefault: true })],
    "identity-b": [activeMembership(UNIT_B, { isDefault: true })],
  };
  const unitStatuses = unitStatusById || {
    [UNIT_A]: "ativo",
    [UNIT_B]: "ativo",
  };
  const accessMiddleware = (req, res, next) => {
    order.push("authorization");
    return route.ensureAccess(req, res, next);
  };
  const authMiddleware = (req, _res, next) => {
    order.push("requireAuth");
    const identityKey = String(req.headers?.authorization || "").includes("identity-b") ? "b" : "a";
    const user = Object.freeze({
      id: `user-${identityKey}`,
      role: "admin",
      source: "users",
      unitId: HOSTILE_UNIT,
    });
    req.auth = user;
    req.user = user;
    next();
  };
  const router = route.createRouter({
    accessMiddleware,
    authIdentityApplicationService: {
      async findBySourceUser({ source, sourceUserId }) {
        return {
          authIdentityId: sourceUserId === "user-b" ? "identity-b" : "identity-a",
          source,
          sourceUserId,
        };
      },
    },
    authMiddleware,
    clock: () => new Date("2026-07-29T12:00:00.000Z"),
    controller,
    logger: {
      info(message, metadata) {
        logs.push({ message, metadata });
        if (metadata?.action === "ACTOR_CONTEXT_CREATED") order.push("actorContext");
      },
    },
    requestedUnitIdReader() {
      contextCalls.untrustedReaderCalls = (contextCalls.untrustedReaderCalls || 0) + 1;
      return HOSTILE_UNIT;
    },
    resolveUnit: async ({ unitId }) => {
      const status = unitStatuses[unitId];
      return status ? { id: unitId, status } : null;
    },
    userUnitMembershipApplicationService: {
      async checkActiveMembership({ authIdentityId, unitId }) {
        return {
          membership: (memberships[authIdentityId] || []).find(
            (candidate) => candidate.unitId === unitId,
          ),
        };
      },
      async listActiveMembershipsByIdentity({ authIdentityId }) {
        return { memberships: memberships[authIdentityId] || [] };
      },
    },
  });

  return {
    contextCalls,
    get controllerCalls() {
      return controllerCalls;
    },
    logs,
    order,
    repository,
    router,
  };
}

class IsolatedEnrollmentRepository {
  constructor({ calls = null, order = null, records = [] } = {}) {
    this.calls = calls || [];
    this.order = order;
    this.records = records.map((record) => ({ ...record }));
  }

  async findDraftByStudent(input) {
    this.record("findDraftByStudent", input);
    return this.findByStudentAndStatus(input, "DRAFT");
  }

  async findActiveByStudent(input) {
    this.record("findActiveByStudent", input);
    return this.findByStudentAndStatus(input, "ACTIVE");
  }

  async searchStudentScopes(input) {
    this.record("searchStudentScopes", input);
    return [
      {
        studentName: `Student unit ${input.unitId}`,
        studentPersonId: STUDENT_PERSON_ID,
        studentProfileId: STUDENT_PROFILE_ID,
        unitId: input.unitId,
      },
    ];
  }

  async findById(enrollmentId) {
    this.calls.push({ enrollmentId, operation: "findById" });
    this.order?.push("repository:findById");
    return this.records.find((record) => record.id === enrollmentId) || null;
  }

  async updateStatus(enrollmentId, status, options = {}) {
    this.calls.push({ enrollmentId, operation: "updateStatus", options, status });
    this.order?.push("repository:updateStatus");
    const record = this.records.find((candidate) => candidate.id === enrollmentId);
    if (!record) return null;
    record.status = status;
    record.confirmedAt = options.confirmedAt || "2026-07-29 12:00:00";
    record.confirmedBy = options.confirmedBy || null;
    return record;
  }

  findByStudentAndStatus(input, status) {
    return (
      this.records.find(
        (record) =>
          record.status === status &&
          record.studentPersonId === input.studentPersonId &&
          record.studentProfileId === input.studentProfileId &&
          record.unitId === input.unitId,
      ) || null
    );
  }

  record(operation, input) {
    this.calls.push({ input: { ...input }, operation });
    this.order?.push(`repository:${operation}`);
  }
}

function activeMembership(unitId, { isDefault = false } = {}) {
  return Object.freeze({
    authIdentityId: "identity-a",
    id: `membership-${unitId}`,
    isDefault,
    role: "admin",
    status: "ACTIVE",
    unitId,
  });
}

function canonicalRecords() {
  return [
    enrollment("draft-12", UNIT_A, "DRAFT", STUDENT_PERSON_ID, STUDENT_PROFILE_ID),
    enrollment("draft-13", UNIT_B, "DRAFT", STUDENT_PERSON_ID, STUDENT_PROFILE_ID),
    enrollment("active-12", UNIT_A, "ACTIVE", ACTIVE_STUDENT_PERSON_ID, ACTIVE_STUDENT_PROFILE_ID),
    enrollment("active-13", UNIT_B, "ACTIVE", ACTIVE_STUDENT_PERSON_ID, ACTIVE_STUDENT_PROFILE_ID),
  ];
}

function enrollment(id, unitId, status, studentPersonId, studentProfileId) {
  return {
    createdAt: "2026-07-29 10:00:00",
    id,
    startDate: "2026-07-29",
    status,
    studentPersonId,
    studentProfileId,
    unitId,
    updatedAt: "2026-07-29 10:00:00",
  };
}

function hostileRequest(overrides = {}) {
  return {
    body: {
      unitId: HOSTILE_UNIT,
      unit_id: HOSTILE_UNIT,
    },
    correlationId: "corr-integration-1",
    headers: {
      authorization: overrides.authorization || "Bearer identity-a",
      "x-unit-id": HOSTILE_UNIT,
    },
    id: "req-integration-1",
    method: "GET",
    params: {
      unitId: HOSTILE_UNIT,
      unit_id: HOSTILE_UNIT,
    },
    query: {
      studentPersonId: STUDENT_PERSON_ID,
      studentProfileId: STUDENT_PROFILE_ID,
      unitId: HOSTILE_UNIT,
      unit_id: HOSTILE_UNIT,
    },
    url: "/status",
    ...overrides,
  };
}

function dispatch(router, request) {
  return new Promise((resolve) => {
    const req = request;
    const res = response(() => resolve({ req, res }));

    router.handle(req, res, (error) => {
      if (!error) {
        resolve({ req, res });
        return;
      }
      res.status(error.statusCode || error.status || 500).json({
        code: error.code || "INTERNAL_ERROR",
        error: error.expose ? error.message : "Operation failed.",
        success: false,
      });
    });
  });
}

function response(onJson) {
  return {
    body: null,
    headers: {},
    statusCode: 200,
    json(payload) {
      this.body = payload;
      onJson();
      return this;
    },
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}
