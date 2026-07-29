const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createEnrollmentRouteContextComposition,
} = require("./enrollment-route-context.composition.js");

test("Enrollment route context resolves authenticated identity, active default membership and active unit", async () => {
  const calls = [];
  const logs = [];
  const membership = activeMembership({ isDefault: true, unitId: "12" });
  const composition = createComposition({
    calls,
    logs,
    memberships: [membership],
  });
  const req = hostileRequest();
  const untrustedActorContext = Object.freeze({
    authIdentityId: "attacker",
    unitContext: Object.freeze({ unitId: "999" }),
  });
  req.actorContext = untrustedActorContext;
  const originalAuth = JSON.stringify(req.auth);
  const originalUser = JSON.stringify(req.user);

  const error = await runMiddleware(composition.actorContextMiddleware, req);

  assert.equal(error, null);
  assert.equal(req.actorContext.authIdentityId, "identity-1");
  assert.equal(req.actorContext.unitContext.unitId, "12");
  assert.equal(req.actorContext.unitContext.membershipId, "membership-12");
  assert.equal(req.actorContext.unitContext.membershipRole, "admin");
  assert.equal(Object.isFrozen(req.actorContext), true);
  assert.equal(Object.isFrozen(req.actorContext.unitContext), true);
  assert.notEqual(req.actorContext, untrustedActorContext);
  assert.equal(JSON.stringify(req.auth), originalAuth);
  assert.equal(JSON.stringify(req.user), originalUser);
  assert.deepEqual(calls.unitCommands, [
    { authIdentityId: "identity-1", unitId: "12" },
  ]);
  assert.equal(JSON.stringify(logs).includes("Bearer secret-token"), false);
  assert.equal(JSON.stringify(logs).includes("Private Student"), false);
});

test("Enrollment route context ignores every client unit source", async () => {
  const calls = [];
  const composition = createComposition({
    calls,
    memberships: [activeMembership({ isDefault: true, unitId: "12" })],
  });
  const req = hostileRequest();

  assert.equal(await runMiddleware(composition.actorContextMiddleware, req), null);
  assert.equal(req.actorContext.unitContext.unitId, "12");
  assert.equal(req.actorContext.unitContext.resolvedBy, "DEFAULT_MEMBERSHIP");
  assert.deepEqual(calls.listCommands, [{ authIdentityId: "identity-1" }]);
  assert.equal(calls.untrustedReaderCalls || 0, 0);
});

test("Enrollment route context fails before controller work without active membership", async () => {
  let controllerCalls = 0;
  const composition = createComposition({
    memberships: [],
  });
  const req = hostileRequest();

  const error = await runMiddleware(composition.actorContextMiddleware, req, () => {
    controllerCalls += 1;
  });

  assert.equal(error.code, "UNIT_CONTEXT_MEMBERSHIP_NOT_AVAILABLE");
  assert.equal(error.statusCode, 403);
  assert.equal(controllerCalls, 0);
  assert.equal(req.actorContext, undefined);
});

test("Enrollment route context rejects inactive membership and ambiguous active units", async (t) => {
  await t.test("inactive", async () => {
    const composition = createComposition({
      listError: Object.assign(new Error("private payload"), {
        code: "USER_UNIT_MEMBERSHIP_INACTIVE",
      }),
    });
    const error = await runMiddleware(composition.actorContextMiddleware, hostileRequest());

    assert.equal(error.code, "UNIT_CONTEXT_MEMBERSHIP_NOT_AVAILABLE");
    assert.equal(error.statusCode, 403);
  });

  await t.test("ambiguous", async () => {
    const composition = createComposition({
      memberships: [
        activeMembership({ unitId: "12" }),
        activeMembership({ unitId: "13" }),
      ],
    });
    const error = await runMiddleware(composition.actorContextMiddleware, hostileRequest());

    assert.equal(error.code, "UNIT_CONTEXT_SELECTION_REQUIRED");
    assert.equal(error.statusCode, 409);
  });
});

test("Enrollment route contexts keep two canonical units isolated", async () => {
  const first = createComposition({
    memberships: [activeMembership({ isDefault: true, unitId: "12" })],
  });
  const second = createComposition({
    memberships: [activeMembership({ isDefault: true, unitId: "13" })],
  });
  const firstRequest = hostileRequest();
  const secondRequest = hostileRequest();

  assert.equal(await runMiddleware(first.actorContextMiddleware, firstRequest), null);
  assert.equal(await runMiddleware(second.actorContextMiddleware, secondRequest), null);
  assert.equal(firstRequest.actorContext.unitContext.unitId, "12");
  assert.equal(secondRequest.actorContext.unitContext.unitId, "13");
});

function createComposition(options = {}) {
  const calls = options.calls || {};
  calls.listCommands ||= [];
  calls.unitCommands ||= [];

  return createEnrollmentRouteContextComposition({
    authIdentityApplicationService: {
      async findBySourceUser(command) {
        calls.identityCommand = command;
        return {
          authIdentityId: "identity-1",
          source: "users",
          sourceUserId: "usr-admin",
        };
      },
    },
    clock: () => new Date("2026-07-29T12:00:00.000Z"),
    logger: {
      info(message, metadata) {
        options.logs?.push({ message, metadata });
      },
    },
    requestedUnitIdReader() {
      calls.untrustedReaderCalls = (calls.untrustedReaderCalls || 0) + 1;
      return "999";
    },
    resolveUnit: async ({ unitId }) => {
      calls.unitCommands.push({ authIdentityId: "identity-1", unitId });
      return { id: unitId, status: "ativo" };
    },
    userUnitMembershipApplicationService: {
      async checkActiveMembership(command) {
        const membership = (options.memberships || []).find(
          (candidate) => candidate.unitId === command.unitId,
        );
        return { membership };
      },
      async listActiveMembershipsByIdentity(command) {
        calls.listCommands.push(command);
        if (options.listError) throw options.listError;
        return {
          memberships: options.memberships || [],
        };
      },
    },
  });
}

function activeMembership(overrides = {}) {
  const unitId = overrides.unitId || "12";
  return {
    authIdentityId: "identity-1",
    createdAt: "2026-07-29 12:00:00",
    createdByAuthIdentityId: "identity-1",
    id: `membership-${unitId}`,
    isDefault: overrides.isDefault === true,
    revokedAt: null,
    role: "admin",
    status: "ACTIVE",
    unitId,
    updatedAt: "2026-07-29 12:00:00",
  };
}

function hostileRequest() {
  return {
    auth: {
      id: "usr-admin",
      role: "admin",
      source: "users",
      unitId: "999",
    },
    body: {
      name: "Private Student",
      unitId: "999",
      unit_id: "999",
    },
    correlationId: "corr-1",
    headers: {
      authorization: "Bearer secret-token",
      "x-unit-id": "999",
    },
    id: "req-1",
    params: { unitId: "999" },
    query: { unitId: "999", unit_id: "999" },
    user: {
      id: "usr-admin",
      role: "admin",
      source: "users",
      unitId: "999",
    },
  };
}

function runMiddleware(middleware, req, onSuccess = null) {
  return new Promise((resolve) => {
    middleware(req, {}, (error) => {
      if (!error) onSuccess?.();
      resolve(error || null);
    });
  });
}
