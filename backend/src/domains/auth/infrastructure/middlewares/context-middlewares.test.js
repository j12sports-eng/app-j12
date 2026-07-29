const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createActorContextMiddleware,
  createUnitContextMiddleware,
  readAuthIdentityInput,
  readRequestedUnitId,
  readRuntimeContext,
} = require("./context-middlewares.js");
const { UnitContext } = require("../../domain/index.js");

test("context middlewares read authenticated runtime state without mutating req.user or req.auth", async () => {
  const calls = [];
  const unitContext = createUnitContext();
  const actorContext = Object.freeze({ actor: true });
  const req = {
    auth: { id: "usr-admin", role: "admin", source: "users" },
    correlationId: "corr-1",
    headers: { "x-unit-id": "12" },
    id: "req-1",
    user: { id: "usr-admin", nome: "Admin" },
  };
  const originalAuth = JSON.stringify(req.auth);
  const originalUser = JSON.stringify(req.user);
  const middleware = createActorContextMiddleware({
    actorContextFactory: {
      createActorContext(command) {
        calls.push({ actorCommand: command });
        return actorContext;
      },
    },
    authIdentityResolver: {
      resolveAuthenticatedAuthIdentity: async (command, context) => {
        calls.push({ identityCommand: command, identityContext: context });
        return { authIdentityId: "identity-1", source: "users", sourceUserId: "usr-admin" };
      },
    },
    unitContextResolver: {
      resolveUnitContext: async (command, context) => {
        calls.push({ unitCommand: command, unitResolverContext: context });
        return unitContext;
      },
    },
  });

  const error = await runMiddleware(middleware, req);

  assert.equal(error, null);
  assert.equal(req.unitContext, unitContext);
  assert.equal(req.actorContext, actorContext);
  assert.equal(JSON.stringify(req.auth), originalAuth);
  assert.equal(JSON.stringify(req.user), originalUser);
  assert.equal(calls[0].identityCommand.sourceUserId, "usr-admin");
  assert.deepEqual(calls[1].unitCommand, { authIdentityId: "identity-1", requestedUnitId: "12" });
});

test("unit context middleware attaches only UnitContext and fails closed without auth", async () => {
  const unitContext = createUnitContext();
  const middleware = createUnitContextMiddleware({
    authIdentityResolver: {
      resolveAuthenticatedAuthIdentity: async () => ({ authIdentityId: "identity-1", source: "users", sourceUserId: "usr-admin" }),
    },
    unitContextResolver: {
      resolveUnitContext: async () => unitContext,
    },
  });

  const req = {
    auth: { id: "usr-admin", source: "users" },
    correlationId: "corr-1",
    headers: {},
    id: "req-1",
  };
  assert.equal(await runMiddleware(middleware, req), null);
  assert.equal(req.unitContext, unitContext);
  assert.equal(req.actorContext, undefined);

  const error = await runMiddleware(middleware, { headers: {}, id: "req-1", correlationId: "corr-1" });
  assert.equal(error.code, "UNIT_CONTEXT_AUTH_REQUIRED");
});

test("x-unit-id is only a requested context and is validated before resolver calls", () => {
  assert.equal(readRequestedUnitId({ headers: { "x-unit-id": " 12 " } }), "12");
  assert.equal(readRequestedUnitId({ headers: {} }), null);
  assert.throws(() => readRequestedUnitId({ headers: { "x-unit-id": ["12"] } }), /Unit context/i);
  assert.throws(() => readRequestedUnitId({ headers: { "x-unit-id": "12,13" } }), /Unit context/i);
  assert.throws(() => readRequestedUnitId({ headers: { "x-unit-id": "abc" } }), /Unit context/i);
});

test("context middleware supports a route-specific reader that ignores client unit headers", async () => {
  const calls = [];
  const unitContext = createUnitContext();
  const middleware = createUnitContextMiddleware({
    authIdentityResolver: {
      resolveAuthenticatedAuthIdentity: async () => ({
        authIdentityId: "identity-1",
        source: "users",
        sourceUserId: "usr-admin",
      }),
    },
    requestedUnitIdReader(req, headerName) {
      calls.push({ headerName, receivedHeader: req.headers?.[headerName] });
      return null;
    },
    unitContextResolver: {
      resolveUnitContext: async (command) => {
        calls.push(command);
        return unitContext;
      },
    },
  });
  const req = {
    auth: { id: "usr-admin", source: "users" },
    correlationId: "corr-1",
    headers: { "x-unit-id": "999" },
    id: "req-1",
  };

  assert.equal(await runMiddleware(middleware, req), null);
  assert.deepEqual(calls, [
    { headerName: "x-unit-id", receivedHeader: "999" },
    { authIdentityId: "identity-1", requestedUnitId: null },
  ]);
  assert.equal(req.unitContext, unitContext);
});

test("context middleware helpers derive identity and runtime context from canonical request fields", () => {
  assert.deepEqual(
    readAuthIdentityInput({ id: "usr-admin", source: "users" }),
    { source: "users", sourceUserId: "usr-admin" },
  );
  assert.deepEqual(readRuntimeContext({ correlationId: "corr-1", id: "req-1" }), {
    correlationId: "corr-1",
    requestId: "req-1",
  });
  assert.deepEqual(readRuntimeContext({ correlationId: "<bad>", id: "" }), {
    correlationId: null,
    requestId: null,
  });
});

test("context middleware factories validate dependencies", () => {
  assert.throws(() => createUnitContextMiddleware(), /auth identity resolver/i);
  assert.throws(
    () =>
      createUnitContextMiddleware({
        authIdentityResolver: { resolveAuthenticatedAuthIdentity() {} },
      }),
    /unit context resolver/i,
  );
  assert.throws(
    () =>
      createActorContextMiddleware({
        authIdentityResolver: { resolveAuthenticatedAuthIdentity() {} },
        unitContextResolver: { resolveUnitContext() {} },
      }),
    /actor context factory/i,
  );
});

test("server composition does not mount UnitContext globally and CORS does not allow x-unit-id", () => {
  const serverPath = path.resolve(__dirname, "../../../../server.js");
  const serverSource = fs.readFileSync(serverPath, "utf8");

  assert.equal(serverSource.includes("createUnitContextComposition"), false);
  assert.equal(serverSource.includes("createUnitContextMiddleware"), false);
  assert.equal(serverSource.includes("createActorContextMiddleware"), false);
  assert.equal(serverSource.includes('"X-Unit-Id"'), false);
  assert.equal(serverSource.includes("X-Unit-Id"), false);
});

function createUnitContext() {
  return new UnitContext({
    isDefault: false,
    membershipId: "membership-1",
    membershipRole: "admin",
    resolvedAt: "2026-07-24T12:00:00.000Z",
    resolvedBy: "EXPLICIT_REQUEST",
    unitId: "12",
  });
}

function runMiddleware(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (error) => resolve(error || null));
  });
}
