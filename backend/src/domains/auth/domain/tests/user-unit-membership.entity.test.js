const assert = require("node:assert/strict");
const test = require("node:test");

const {
  UserUnitMembership,
  normalizeMembershipId,
  normalizeUnitId,
  normalizeUserUnitMembershipRole,
  normalizeUserUnitMembershipStatus,
} = require("../index.js");

test("user-unit membership normalizes canonical role, status and identifiers", () => {
  const membership = new UserUnitMembership({
    authIdentityId: "identity-1",
    createdByAuthIdentityId: "actor-1",
    id: "membership-1",
    role: "Professor",
    status: "active",
    unitId: "12",
  });

  assert.equal(membership.id, "membership-1");
  assert.equal(membership.authIdentityId, "identity-1");
  assert.equal(membership.unitId, "12");
  assert.equal(membership.role, "professor");
  assert.equal(membership.status, "ACTIVE");
  assert.equal(membership.isDefault, false);
  assert.deepEqual(membership.toJSON(), {
    authIdentityId: "identity-1",
    createdAt: null,
    createdByAuthIdentityId: "actor-1",
    id: "membership-1",
    isDefault: false,
    revokedAt: null,
    revokedByAuthIdentityId: null,
    role: "professor",
    status: "ACTIVE",
    unitId: "12",
    updatedAt: null,
  });
});

test("user-unit membership enforces active defaults and revoked audit fields", () => {
  assert.throws(
    () =>
      new UserUnitMembership({
        authIdentityId: "identity-1",
        createdByAuthIdentityId: "actor-1",
        isDefault: true,
        role: "professor",
        status: "inactive",
        unitId: "12",
      }),
    /default membership must be ACTIVE/i,
  );

  assert.throws(
    () =>
      new UserUnitMembership({
        authIdentityId: "identity-1",
        createdByAuthIdentityId: "actor-1",
        role: "professor",
        status: "revoked",
        unitId: "12",
      }),
    /revoked state requires audit fields/i,
  );
});

test("user-unit membership transitions stay within the canonical state model", () => {
  const membership = new UserUnitMembership({
    authIdentityId: "identity-1",
    createdByAuthIdentityId: "actor-1",
    id: "membership-1",
    role: "professor",
    status: "ACTIVE",
    unitId: "12",
  });

  const defaulted = membership.setDefault(true);
  assert.equal(defaulted.isDefault, true);

  const roleChanged = defaulted.changeRole("coordenador");
  assert.equal(roleChanged.role, "coordenador");

  const deactivated = roleChanged.deactivate({ updatedAt: "2026-07-24 12:00:00" });
  assert.equal(deactivated.status, "INACTIVE");
  assert.equal(deactivated.isDefault, false);

  const revoked = deactivated.revoke({
    revokedAt: "2026-07-24 12:05:00",
    revokedByAuthIdentityId: "actor-2",
  });
  assert.equal(revoked.status, "REVOKED");
  assert.equal(revoked.revokedByAuthIdentityId, "actor-2");
  assert.equal(revoked.revokedAt, "2026-07-24 12:05:00");
});

test("membership value normalizers fail closed for malformed inputs", () => {
  assert.equal(normalizeMembershipId(" membership-1 "), "membership-1");
  assert.equal(normalizeUnitId("12"), "12");
  assert.equal(normalizeUserUnitMembershipRole("ADMIN"), "admin");
  assert.equal(normalizeUserUnitMembershipStatus("active"), "ACTIVE");

  assert.equal(normalizeMembershipId(""), null);
  assert.throws(() => normalizeUnitId("0"), /invalid format/i);
  assert.equal(normalizeUserUnitMembershipRole("secretaria"), null);
  assert.equal(normalizeUserUnitMembershipStatus("cancelled"), null);
});
