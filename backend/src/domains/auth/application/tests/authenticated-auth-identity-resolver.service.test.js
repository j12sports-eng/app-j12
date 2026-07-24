const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AUTHENTICATED_AUTH_IDENTITY_ERROR_CODES,
  AuthenticatedAuthIdentityResolverService,
} = require("../services/authenticated-auth-identity-resolver.service.js");

test("AuthenticatedAuthIdentityResolverService resolves existing users identity without creating", async () => {
  const calls = [];
  const logs = [];
  const service = createService({
    logger: captureLogger(logs),
    service: {
      findBySourceUser: async (input, context) => {
        calls.push({ input, context });
        return { authIdentityId: "identity-1" };
      },
      resolveOrCreateIdentity() {
        throw new Error("must not create identity in context resolution");
      },
    },
  });

  const result = await service.resolveAuthenticatedAuthIdentity(
    { source: "users", sourceUserId: "usr-admin" },
    context(),
  );

  assert.deepEqual(result, {
    authIdentityId: "identity-1",
    resolvedAt: "2026-07-24T12:00:00.000Z",
    source: "users",
    sourceUserId: "usr-admin",
  });
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(calls, [
    {
      input: { source: "users", sourceUserId: "usr-admin" },
      context: { correlationId: "corr-1", requestId: "req-1" },
    },
  ]);
  assert.equal(JSON.stringify(logs).includes("usr-admin"), false);
  assert.equal(JSON.stringify(logs).includes("sourceUserId"), false);
});

test("AuthenticatedAuthIdentityResolverService resolves existing j12_usuarios identity", async () => {
  const service = createService({
    service: {
      findBySourceUser: async () => ({ identity: { id: "identity-2" } }),
    },
  });

  const result = await service.resolveAuthenticatedAuthIdentity(
    { source: "j12_usuarios", sourceUserId: 42 },
    context(),
  );

  assert.equal(result.authIdentityId, "identity-2");
  assert.equal(result.source, "j12_usuarios");
  assert.equal(result.sourceUserId, "42");
});

test("AuthenticatedAuthIdentityResolverService rejects invalid input and mass assignment", async () => {
  const service = createService();

  await rejectsCode(
    () => service.resolveAuthenticatedAuthIdentity({ source: "staff", sourceUserId: "1" }, context()),
    AUTHENTICATED_AUTH_IDENTITY_ERROR_CODES.INVALID_INPUT,
  );
  await rejectsCode(
    () => service.resolveAuthenticatedAuthIdentity({ source: "j12_usuarios", sourceUserId: "abc" }, context()),
    AUTHENTICATED_AUTH_IDENTITY_ERROR_CODES.INVALID_INPUT,
  );
  await rejectsCode(
    () =>
      service.resolveAuthenticatedAuthIdentity(
        { role: "admin", source: "users", sourceUserId: "usr-admin" },
        context(),
      ),
    AUTHENTICATED_AUTH_IDENTITY_ERROR_CODES.INVALID_INPUT,
  );
});

test("AuthenticatedAuthIdentityResolverService fails closed for missing, inactive or unavailable identity", async () => {
  await rejectsCode(
    () => new AuthenticatedAuthIdentityResolverService().resolveAuthenticatedAuthIdentity({ source: "users", sourceUserId: "usr-admin" }, context()),
    AUTHENTICATED_AUTH_IDENTITY_ERROR_CODES.NOT_AVAILABLE,
  );
  await rejectsCode(
    () =>
      createService({ service: { findBySourceUser: async () => null } }).resolveAuthenticatedAuthIdentity(
        { source: "users", sourceUserId: "usr-admin" },
        context(),
      ),
    AUTHENTICATED_AUTH_IDENTITY_ERROR_CODES.NOT_AVAILABLE,
  );
  await rejectsCode(
    () =>
      createService({
        service: {
          findBySourceUser: async () => {
            const error = new Error("disabled identity for usr-admin");
            error.code = "AUTH_IDENTITY_DISABLED";
            throw error;
          },
        },
      }).resolveAuthenticatedAuthIdentity({ source: "users", sourceUserId: "usr-admin" }, context()),
    AUTHENTICATED_AUTH_IDENTITY_ERROR_CODES.NOT_AVAILABLE,
  );
});

function createService(options = {}) {
  return new AuthenticatedAuthIdentityResolverService({
    authIdentityApplicationService:
      options.service ||
      {
        findBySourceUser: async () => ({ authIdentityId: "identity-1" }),
      },
    clock: () => new Date("2026-07-24T12:00:00.000Z"),
    logger: options.logger || null,
  });
}

function context() {
  return { correlationId: "corr-1", requestId: "req-1" };
}

function captureLogger(records) {
  return {
    info(message, metadata) {
      records.push({ message, metadata });
    },
  };
}

async function rejectsCode(action, code) {
  await assert.rejects(action, (error) => {
    assert.equal(error.code, code);
    assert.equal(String(error.message).includes("usr-admin"), false);
    assert.equal(String(error.stack || "").includes("usr-admin"), false);
    return true;
  });
}
