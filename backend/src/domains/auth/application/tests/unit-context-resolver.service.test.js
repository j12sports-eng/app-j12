const assert = require("node:assert/strict");
const test = require("node:test");

const {
  UNIT_CONTEXT_ERROR_CODES,
  UnitContextResolverService,
} = require("../services/unit-context-resolver.service.js");

test("UnitContextResolverService resolves an explicitly requested active unit by membership", async () => {
  const service = createService({
    memberships: [membership({ id: "membership-1", unitId: "12" })],
  });

  const result = await service.resolveUnitContext(
    { authIdentityId: "identity-1", requestedUnitId: "12" },
    context(),
  );

  assert.equal(result.unitId, "12");
  assert.equal(result.membershipId, "membership-1");
  assert.equal(result.resolvedBy, "EXPLICIT_REQUEST");
  assert.equal(Object.isFrozen(result), true);
});

test("UnitContextResolverService resolves default and single active memberships deterministically", async () => {
  const defaultResult = await createService({
    memberships: [
      membership({ id: "membership-1", isDefault: false, unitId: "12" }),
      membership({ id: "membership-2", isDefault: true, unitId: "13" }),
    ],
  }).resolveUnitContext({ authIdentityId: "identity-1" }, context());
  const singleResult = await createService({
    memberships: [membership({ id: "membership-3", unitId: "14" })],
  }).resolveUnitContext({ authIdentityId: "identity-1" }, context());

  assert.equal(defaultResult.unitId, "13");
  assert.equal(defaultResult.resolvedBy, "DEFAULT_MEMBERSHIP");
  assert.equal(singleResult.unitId, "14");
  assert.equal(singleResult.resolvedBy, "SINGLE_ACTIVE_MEMBERSHIP");
});

test("UnitContextResolverService fails closed for malformed or unauthorized requested units", async () => {
  const service = createService({
    memberships: [membership({ unitId: "12" })],
  });

  await rejectsCode(
    () => service.resolveUnitContext({ authIdentityId: "identity-1", requestedUnitId: "abc" }, context()),
    UNIT_CONTEXT_ERROR_CODES.INVALID_REQUESTED_UNIT,
  );
  await rejectsCode(
    () => service.resolveUnitContext({ authIdentityId: "identity-1", requestedUnitId: "13" }, context()),
    UNIT_CONTEXT_ERROR_CODES.MEMBERSHIP_NOT_AVAILABLE,
  );
  await rejectsCode(
    () => service.resolveUnitContext({ authIdentityId: "identity-1", requestedUnitId: "12", role: "admin" }, context()),
    UNIT_CONTEXT_ERROR_CODES.INVALID_REQUESTED_UNIT,
  );
});

test("UnitContextResolverService fails closed for revoked membership, inactive unit and no active membership", async () => {
  await rejectsCode(
    () =>
      createService({
        checkActiveMembership: async () => {
          const error = new Error("revoked membership");
          error.code = "USER_UNIT_MEMBERSHIP_REVOKED";
          throw error;
        },
        memberships: [membership({ unitId: "12" })],
      }).resolveUnitContext({ authIdentityId: "identity-1", requestedUnitId: "12" }, context()),
    UNIT_CONTEXT_ERROR_CODES.MEMBERSHIP_NOT_AVAILABLE,
  );
  await rejectsCode(
    () =>
      createService({
        memberships: [membership({ unitId: "12" })],
        units: new Map([["12", { id: "12", status: "inativo" }]]),
      }).resolveUnitContext({ authIdentityId: "identity-1", requestedUnitId: "12" }, context()),
    UNIT_CONTEXT_ERROR_CODES.UNIT_NOT_AVAILABLE,
  );
  await rejectsCode(
    () => createService({ memberships: [] }).resolveUnitContext({ authIdentityId: "identity-1" }, context()),
    UNIT_CONTEXT_ERROR_CODES.MEMBERSHIP_NOT_AVAILABLE,
  );
});

test("UnitContextResolverService detects ambiguous selection and inconsistent defaults", async () => {
  await rejectsCode(
    () =>
      createService({
        memberships: [
          membership({ id: "membership-1", unitId: "12" }),
          membership({ id: "membership-2", unitId: "13" }),
        ],
      }).resolveUnitContext({ authIdentityId: "identity-1" }, context()),
    UNIT_CONTEXT_ERROR_CODES.SELECTION_REQUIRED,
  );
  await rejectsCode(
    () =>
      createService({
        memberships: [
          membership({ id: "membership-1", isDefault: true, unitId: "12" }),
          membership({ id: "membership-2", isDefault: true, unitId: "13" }),
        ],
      }).resolveUnitContext({ authIdentityId: "identity-1" }, context()),
    UNIT_CONTEXT_ERROR_CODES.STATE_CONFLICT,
  );
});

test("UnitContextResolverService revalidates membership before returning context", async () => {
  const service = createService({
    checkActiveMembership: async () => ({
      membership: membership({ id: "membership-revalidated", role: "coordenador", unitId: "12" }),
    }),
    memberships: [membership({ id: "membership-listed", role: "professor", unitId: "12" })],
  });

  const result = await service.resolveUnitContext(
    { authIdentityId: "identity-1", requestedUnitId: "12" },
    context(),
  );

  assert.equal(result.membershipId, "membership-revalidated");
  assert.equal(result.membershipRole, "coordenador");
});

test("UnitContextResolverService emits safe logs without source user identifiers", async () => {
  const logs = [];
  const service = createService({
    logger: {
      info(message, metadata) {
        logs.push({ message, metadata });
      },
    },
    memberships: [membership({ unitId: "12" })],
  });

  await service.resolveUnitContext(
    { authIdentityId: "identity-1", requestedUnitId: "12" },
    { ...context(), sourceUserId: "usr-admin" },
  );

  assert.equal(JSON.stringify(logs).includes("usr-admin"), false);
  assert.equal(JSON.stringify(logs).includes("sourceUserId"), false);
});

function createService(options = {}) {
  const memberships = options.memberships || [membership()];
  const units =
    options.units ||
    new Map([
      ["12", { id: "12", status: "ativo" }],
      ["13", { id: "13", status: "ativo" }],
      ["14", { id: "14", status: "ativo" }],
    ]);
  const membershipService = {
    checkActiveMembership:
      options.checkActiveMembership ||
      (async ({ unitId }) => ({ membership: memberships.find((item) => item.unitId === String(unitId)) || null })),
    listActiveMembershipsByIdentity: async () => ({ memberships }),
  };

  return new UnitContextResolverService({
    clock: () => new Date("2026-07-24T12:00:00.000Z"),
    logger: options.logger || null,
    resolveUnit: options.resolveUnit || (async ({ unitId }) => units.get(String(unitId)) || null),
    userUnitMembershipApplicationService: options.membershipService || membershipService,
  });
}

function membership(overrides = {}) {
  return {
    id: overrides.id || "membership-1",
    isDefault: Boolean(overrides.isDefault),
    role: overrides.role || "professor",
    unitId: overrides.unitId || "12",
  };
}

function context() {
  return { authIdentityId: "identity-1", correlationId: "corr-1", requestId: "req-1" };
}

async function rejectsCode(action, code) {
  await assert.rejects(action, (error) => {
    assert.equal(error.code, code);
    assert.equal(String(error.message).includes("identity-1"), false);
    assert.equal(String(error.stack || "").includes("identity-1"), false);
    return true;
  });
}
