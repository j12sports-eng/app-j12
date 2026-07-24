const assert = require("node:assert/strict");
const test = require("node:test");

const {
  USER_UNIT_MEMBERSHIP_ERROR_CODES,
  UserUnitMembershipApplicationService,
} = require("../services/user-unit-membership-application.service.js");
const {
  InMemoryUserUnitMembershipRepository,
} = require("../../infrastructure/repositories/memory-user-unit-membership.repository.js");

test("grantMembership creates an active canonical membership and logs safe metadata", async () => {
  const records = [];
  const service = createService({
    logger: {
      info(message, metadata) {
        records.push({ message, metadata });
      },
    },
  });

  const result = await service.grantMembership(
    { authIdentityId: "identity-1", role: "Professor", unitId: "1" },
    { actorAuthIdentityId: "actor-1", correlationId: "corr-1", requestId: "req-1" },
  );

  assert.equal(result.created, true);
  assert.equal(result.reused, false);
  assert.equal(result.membership.authIdentityId, "identity-1");
  assert.equal(result.membership.role, "professor");
  assert.equal(result.membership.status, "ACTIVE");
  assert.equal(records[0].metadata.action, "USER_UNIT_MEMBERSHIP_GRANTED");
  assert.equal(records[0].metadata.authIdentityId, "identity-1");
  assert.equal(JSON.stringify(records).includes("email"), false);
});

test("grantMembership is idempotent for an existing active identity/unit pair", async () => {
  const service = createService({
    initialRows: [
      membershipRow({
        authIdentityId: "identity-1",
        id: "membership-1",
        role: "professor",
        unitId: "1",
      }),
    ],
  });

  const result = await service.grantMembership(
    { authIdentityId: "identity-1", role: "coordenador", unitId: "1" },
    context(),
  );

  assert.equal(result.created, false);
  assert.equal(result.reused, true);
  assert.equal(result.membership.id, "membership-1");
  assert.equal(result.membership.role, "professor");
});

test("grantMembership rejects invalid, unavailable and mass-assignment inputs", async () => {
  const service = createService();

  await rejectsCode(
    () => service.grantMembership({ authIdentityId: "identity-1", role: "secretaria", unitId: "1" }, context()),
    USER_UNIT_MEMBERSHIP_ERROR_CODES.INVALID_INPUT,
  );
  await rejectsCode(
    () =>
      service.grantMembership(
        { authIdentityId: "identity-1", role: "professor", unitId: "1", status: "ACTIVE" },
        context(),
      ),
    USER_UNIT_MEMBERSHIP_ERROR_CODES.INVALID_INPUT,
  );
  await rejectsCode(
    () =>
      createService({ authIdentityResolver: async () => null }).grantMembership(
        { authIdentityId: "identity-missing", role: "professor", unitId: "1" },
        context(),
      ),
    USER_UNIT_MEMBERSHIP_ERROR_CODES.IDENTITY_NOT_AVAILABLE,
  );
  await rejectsCode(
    () =>
      createService({ unitResolver: async () => null }).grantMembership(
        { authIdentityId: "identity-1", role: "professor", unitId: "99" },
        context(),
      ),
    USER_UNIT_MEMBERSHIP_ERROR_CODES.UNIT_NOT_AVAILABLE,
  );
});

test("membership mutations revoke, deactivate and change roles without bypassing authorization", async () => {
  const repository = new InMemoryUserUnitMembershipRepository({
    initialRows: [
      membershipRow({ id: "membership-1", role: "professor", unitId: "1" }),
      membershipRow({ id: "membership-2", role: "professor", unitId: "2" }),
      membershipRow({
        id: "membership-3",
        revokedAt: "2026-07-24 12:00:00",
        revokedByAuthIdentityId: "actor-1",
        role: "professor",
        status: "REVOKED",
        unitId: "3",
      }),
    ],
  });
  const service = createService({ repository });

  const revoked = await service.revokeMembership({ membershipId: "membership-1" }, context());
  assert.equal(revoked.membership.status, "REVOKED");
  assert.equal(revoked.membership.revokedAt !== null, true);

  const deactivated = await service.deactivateMembership({ membershipId: "membership-2" }, context());
  assert.equal(deactivated.membership.status, "INACTIVE");

  await rejectsCode(
    () => service.changeMembershipRole({ membershipId: "membership-3", role: "admin" }, context()),
    USER_UNIT_MEMBERSHIP_ERROR_CODES.REVOKED,
  );

  await rejectsCode(
    () =>
      createService({ authorizeMembershipAction: async () => false, repository }).revokeMembership(
        { membershipId: "membership-2" },
        context(),
      ),
    USER_UNIT_MEMBERSHIP_ERROR_CODES.FORBIDDEN,
  );
});

test("setDefaultMembership changes the only active default for an identity", async () => {
  const repository = new InMemoryUserUnitMembershipRepository({
    initialRows: [
      membershipRow({ id: "membership-1", isDefault: true, unitId: "1" }),
      membershipRow({ id: "membership-2", unitId: "2" }),
    ],
  });
  const service = createService({ repository });

  const result = await service.setDefaultMembership({ membershipId: "membership-2" }, context());

  assert.equal(result.changed, true);
  assert.equal(result.membership.isDefault, true);
  assert.equal(result.previousDefaultMembershipId, "membership-1");
  assert.equal((await repository.findById("membership-1")).isDefault, false);
  assert.equal((await repository.findById("membership-2")).isDefault, true);
});

test("checkActiveMembership and listActiveMembershipsByIdentity fail closed by status", async () => {
  const service = createService({
    initialRows: [
      membershipRow({ id: "membership-active", unitId: "1" }),
      membershipRow({ id: "membership-inactive", status: "INACTIVE", unitId: "2" }),
      membershipRow({
        id: "membership-revoked",
        revokedAt: "2026-07-24 12:00:00",
        revokedByAuthIdentityId: "actor-1",
        status: "REVOKED",
        unitId: "3",
      }),
    ],
  });

  assert.equal(
    (await service.checkActiveMembership({ authIdentityId: "identity-1", unitId: "1" }, context())).membership.id,
    "membership-active",
  );
  assert.deepEqual(
    (await service.listActiveMembershipsByIdentity({ authIdentityId: "identity-1" }, context())).memberships.map(
      (membership) => membership.id,
    ),
    ["membership-active"],
  );
  await rejectsCode(
    () => service.checkActiveMembership({ authIdentityId: "identity-1", unitId: "2" }, context()),
    USER_UNIT_MEMBERSHIP_ERROR_CODES.INACTIVE,
  );
  await rejectsCode(
    () => service.checkActiveMembership({ authIdentityId: "identity-1", unitId: "3" }, context()),
    USER_UNIT_MEMBERSHIP_ERROR_CODES.REVOKED,
  );
  await rejectsCode(
    () => service.checkActiveMembership({ authIdentityId: "identity-1", unitId: "4" }, context()),
    USER_UNIT_MEMBERSHIP_ERROR_CODES.NOT_FOUND,
  );
});

test("findMembership rejects mismatched lookup constraints to reduce enumeration surface", async () => {
  const service = createService({
    initialRows: [membershipRow({ id: "membership-1", unitId: "1" })],
  });

  await rejectsCode(
    () =>
      service.findMembership(
        { authIdentityId: "identity-2", membershipId: "membership-1", unitId: "1" },
        context(),
      ),
    USER_UNIT_MEMBERSHIP_ERROR_CODES.INVALID_INPUT,
  );
  await rejectsCode(
    () => service.findMembership({ membershipId: "membership-missing" }, context()),
    USER_UNIT_MEMBERSHIP_ERROR_CODES.NOT_FOUND,
  );
});

function createService(options = {}) {
  const identities =
    options.identities ||
    new Map([
      ["identity-1", { id: "identity-1", status: "ACTIVE" }],
      ["identity-2", { id: "identity-2", status: "ACTIVE" }],
    ]);
  const units =
    options.units ||
    new Map([
      ["1", { id: "1", status: "ativo" }],
      ["2", { id: "2", status: "ativo" }],
      ["3", { id: "3", status: "ativo" }],
      ["4", { id: "4", status: "ativo" }],
      ["99", { id: "99", status: "ativo" }],
    ]);

  return new UserUnitMembershipApplicationService({
    authIdentityResolver:
      options.authIdentityResolver ||
      (async ({ authIdentityId }) => identities.get(String(authIdentityId)) || null),
    authorizeMembershipAction: options.authorizeMembershipAction || (async () => true),
    logger: options.logger || null,
    membershipRepository:
      options.repository ||
      new InMemoryUserUnitMembershipRepository({ initialRows: options.initialRows || [] }),
    unitResolver:
      options.unitResolver || (async ({ unitId }) => units.get(String(unitId)) || null),
  });
}

function membershipRow(overrides = {}) {
  return {
    authIdentityId: "identity-1",
    createdByAuthIdentityId: "actor-1",
    id: overrides.id || "membership-1",
    isDefault: Boolean(overrides.isDefault),
    role: overrides.role || "professor",
    status: overrides.status || "ACTIVE",
    unitId: overrides.unitId || "1",
    revokedAt: overrides.revokedAt || null,
    revokedByAuthIdentityId: overrides.revokedByAuthIdentityId || null,
  };
}

function context() {
  return { actorAuthIdentityId: "actor-1", correlationId: "corr-1", requestId: "req-1" };
}

async function rejectsCode(action, code) {
  await assert.rejects(action, (error) => {
    assert.equal(error.code, code);
    assert.equal(String(error.message).includes("identity-1"), false);
    assert.equal(String(error.stack || "").includes("identity-1"), false);
    return true;
  });
}
