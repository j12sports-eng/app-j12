const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ACTOR_CONTEXT_ERROR_CODES,
  ActorContextFactoryService,
} = require("../services/actor-context-factory.service.js");
const { UnitContext } = require("../../domain/index.js");

test("ActorContextFactoryService creates immutable actor context from authenticated identity and UnitContext", () => {
  const logs = [];
  const service = new ActorContextFactoryService({
    logger: {
      info(message, metadata) {
        logs.push({ message, metadata });
      },
    },
  });
  const unitContext = createUnitContext();

  const actorContext = service.createActorContext(
    {
      authIdentity: { authIdentityId: "identity-1", source: "users", sourceUserId: "usr-admin" },
      correlationId: "corr-1",
      globalRole: "admin",
      requestId: "req-1",
      unitContext,
    },
    { correlationId: "corr-1", requestId: "req-1" },
  );

  assert.equal(actorContext.authIdentityId, "identity-1");
  assert.equal(actorContext.source, "users");
  assert.equal(actorContext.unitContext, unitContext);
  assert.equal(Object.isFrozen(actorContext), true);
  assert.equal(JSON.stringify(actorContext).includes("permissions"), false);
  assert.equal(JSON.stringify(logs).includes("usr-admin"), false);
});

test("ActorContextFactoryService rejects missing context and mass-assignment input", () => {
  const service = new ActorContextFactoryService();

  assert.throws(
    () =>
      service.createActorContext({
        authIdentity: { authIdentityId: "identity-1", source: "users", sourceUserId: "usr-admin" },
        correlationId: "corr-1",
        permissions: ["*"],
        requestId: "req-1",
        unitContext: createUnitContext(),
      }),
    { code: ACTOR_CONTEXT_ERROR_CODES.INVALID_INPUT },
  );
  assert.throws(
    () =>
      service.createActorContext({
        correlationId: "corr-1",
        requestId: "req-1",
        unitContext: createUnitContext(),
      }),
    { code: ACTOR_CONTEXT_ERROR_CODES.NOT_AVAILABLE },
  );
  assert.throws(
    () =>
      service.createActorContext({
        authIdentity: { authIdentityId: "identity-1", source: "users", sourceUserId: "usr-admin" },
        correlationId: "corr-1",
        requestId: "req-1",
      }),
    { code: ACTOR_CONTEXT_ERROR_CODES.NOT_AVAILABLE },
  );
});

function createUnitContext() {
  return new UnitContext({
    isDefault: true,
    membershipId: "membership-1",
    membershipRole: "admin",
    resolvedAt: "2026-07-24T12:00:00.000Z",
    resolvedBy: "DEFAULT_MEMBERSHIP",
    unitId: "12",
  });
}
