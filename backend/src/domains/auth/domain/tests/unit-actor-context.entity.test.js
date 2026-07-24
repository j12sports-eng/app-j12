const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ActorContext,
  UnitContext,
  UnitContextResolutionSource,
} = require("../index.js");

test("UnitContext is canonical, immutable and minimally serializable", () => {
  const unitContext = createUnitContext();
  const serialized = unitContext.toJSON();

  assert.equal(Object.isFrozen(unitContext), true);
  assert.equal(Object.isFrozen(serialized), true);
  assert.deepEqual(serialized, {
    isDefault: true,
    membershipId: "membership-1",
    membershipRole: "admin",
    resolvedAt: "2026-07-24T12:00:00.000Z",
    resolvedBy: UnitContextResolutionSource.DEFAULT_MEMBERSHIP,
    unitId: "12",
  });
});

test("UnitContext rejects malformed identifiers, roles and mass-assignment", () => {
  assert.throws(
    () => createUnitContext({ sourceUserId: "usr-admin" }),
    /additional fields/i,
  );
  assert.throws(() => createUnitContext({ unitId: "0" }), /invalid format/i);
  assert.throws(() => createUnitContext({ membershipId: "" }), /membershipId/i);
  assert.throws(() => createUnitContext({ membershipRole: "secretaria" }), /role/i);
  assert.throws(() => createUnitContext({ resolvedBy: "jwt" }), /resolvedBy/i);
});

test("ActorContext binds authenticated identity, request correlation and UnitContext", () => {
  const actorContext = new ActorContext({
    authIdentityId: "identity-1",
    correlationId: "corr-1",
    globalRole: "ADMIN",
    requestId: "req-1",
    source: "users",
    sourceUserId: "usr-admin",
    unitContext: createUnitContext(),
  });

  assert.equal(Object.isFrozen(actorContext), true);
  assert.equal(actorContext.globalRole, "admin");
  assert.equal(actorContext.membershipRole, "admin");
  assert.equal(actorContext.unitContext.unitId, "12");
  assert.equal(Object.isFrozen(actorContext.toJSON().unitContext), true);
});

test("ActorContext fails closed for missing runtime context, invalid source and privilege injection", () => {
  assert.throws(
    () =>
      new ActorContext({
        authIdentityId: "identity-1",
        correlationId: "corr-1",
        requestId: "req-1",
        source: "users",
        sourceUserId: "usr-admin",
        unitContext: createUnitContext(),
        permissions: ["all"],
      }),
    /additional fields/i,
  );
  assert.throws(
    () =>
      new ActorContext({
        authIdentityId: "identity-1",
        correlationId: "corr-1",
        requestId: "req-1",
        source: "staff",
        sourceUserId: "usr-admin",
        unitContext: createUnitContext(),
      }),
    /source/i,
  );
  assert.throws(
    () =>
      new ActorContext({
        authIdentityId: "identity-1",
        correlationId: null,
        requestId: "req-1",
        source: "users",
        sourceUserId: "usr-admin",
        unitContext: createUnitContext(),
      }),
    /correlationId/i,
  );
  assert.throws(
    () =>
      new ActorContext({
        authIdentityId: "identity-1",
        correlationId: "corr-1",
        membershipRole: "professor",
        requestId: "req-1",
        source: "users",
        sourceUserId: "usr-admin",
        unitContext: createUnitContext({ membershipRole: "admin" }),
      }),
    /must match/i,
  );
});

function createUnitContext(overrides = {}) {
  return new UnitContext({
    isDefault: true,
    membershipId: "membership-1",
    membershipRole: "admin",
    resolvedAt: "2026-07-24T12:00:00.000Z",
    resolvedBy: UnitContextResolutionSource.DEFAULT_MEMBERSHIP,
    unitId: "12",
    ...overrides,
  });
}
