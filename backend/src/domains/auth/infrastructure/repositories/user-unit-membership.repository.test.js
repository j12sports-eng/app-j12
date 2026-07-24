const assert = require("node:assert/strict");
const test = require("node:test");

const {
  InMemoryUserUnitMembershipRepository,
} = require("./memory-user-unit-membership.repository.js");
const {
  INSERT_MEMBERSHIP_SQL,
  MySqlUserUnitMembershipRepository,
  SELECT_ACTIVE_MEMBERSHIP_FOR_CHECK_SQL,
  SELECT_MEMBERSHIP_BY_ID_SQL,
  isUserUnitMembershipDuplicateEntryError,
  toUserUnitMembershipData,
} = require("./mysql-user-unit-membership.repository.js");

test("InMemoryUserUnitMembershipRepository enforces identity/unit uniqueness and active default", async () => {
  const repository = new InMemoryUserUnitMembershipRepository();

  const first = await repository.create({
    authIdentityId: "identity-1",
    createdByAuthIdentityId: "actor-1",
    id: "membership-1",
    isDefault: true,
    role: "professor",
    status: "ACTIVE",
    unitId: "1",
  });

  await assert.rejects(
    () =>
      repository.create({
        authIdentityId: "identity-1",
        createdByAuthIdentityId: "actor-1",
        id: "membership-2",
        isDefault: true,
        role: "coordenador",
        status: "ACTIVE",
        unitId: "2",
      }),
    /Duplicate user-unit membership/,
  );

  const second = await repository.create({
    authIdentityId: "identity-2",
    createdByAuthIdentityId: "actor-1",
    id: "membership-3",
    role: "professor",
    status: "ACTIVE",
    unitId: "2",
  });

  const grantedDefault = await repository.setDefaultTransactionally({
    membershipId: second.id,
  });

  assert.equal(first.isDefault, true);
  assert.equal(grantedDefault.membership.isDefault, true);
});

test("InMemoryUserUnitMembershipRepository checkActive returns only active memberships", async () => {
  const repository = new InMemoryUserUnitMembershipRepository({
    initialRows: [
      {
        authIdentityId: "identity-1",
        createdByAuthIdentityId: "actor-1",
        id: "membership-1",
        role: "professor",
        status: "ACTIVE",
        unitId: "1",
      },
      {
        authIdentityId: "identity-1",
        createdByAuthIdentityId: "actor-1",
        id: "membership-2",
        role: "professor",
        status: "INACTIVE",
        unitId: "2",
      },
    ],
  });

  assert.equal((await repository.checkActive({ authIdentityId: "identity-1", unitId: "1" })).id, "membership-1");
  assert.equal(await repository.checkActive({ authIdentityId: "identity-1", unitId: "2" }), null);
});

test("MySqlUserUnitMembershipRepository uses parameterized SQL and canonical projections", async () => {
  const calls = [];
  const repository = new MySqlUserUnitMembershipRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      if (sql === INSERT_MEMBERSHIP_SQL) return { affectedRows: 1 };
      if (sql === SELECT_MEMBERSHIP_BY_ID_SQL) {
        return [
          {
            active_default_key: null,
            auth_identity_id: "identity-1",
            created_at: "2026-07-24 12:00:00",
            created_by_auth_identity_id: "actor-1",
            id: "membership-1",
            is_default: 0,
            role: "professor",
            revoked_at: null,
            revoked_by_auth_identity_id: null,
            status: "ACTIVE",
            unit_id: 1,
            updated_at: "2026-07-24 12:00:00",
          },
        ];
      }
      if (sql === SELECT_ACTIVE_MEMBERSHIP_FOR_CHECK_SQL) {
        return [
          {
            active_default_key: "identity-1",
            auth_identity_id: "identity-1",
            created_at: "2026-07-24 12:00:00",
            created_by_auth_identity_id: "actor-1",
            id: "membership-1",
            is_default: 1,
            role: "professor",
            revoked_at: null,
            revoked_by_auth_identity_id: null,
            status: "ACTIVE",
            unit_id: 1,
            updated_at: "2026-07-24 12:00:00",
          },
        ];
      }
      return [];
    },
  });

  const created = await repository.create({
    authIdentityId: "identity-1",
    createdByAuthIdentityId: "actor-1",
    id: "membership-1",
    role: "professor",
    status: "ACTIVE",
    unitId: "1",
  });

  assert.equal(created.id, "membership-1");
  assert.equal(calls[0].params[1], "identity-1");
  assert.equal(INSERT_MEMBERSHIP_SQL.includes("revoked_by_auth_identity_id"), true);
  assert.equal(SELECT_ACTIVE_MEMBERSHIP_FOR_CHECK_SQL.includes("m.*"), true);
  assert.equal(
    (await repository.checkActive({ authIdentityId: "identity-1", unitId: "1" })).isDefault,
    true,
  );
  assert.deepEqual(
    toUserUnitMembershipData({
      auth_identity_id: "identity-1",
      created_at: "created",
      created_by_auth_identity_id: "actor-1",
      id: "membership-1",
      is_default: 1,
      role: "professor",
      revoked_at: null,
      revoked_by_auth_identity_id: null,
      status: "ACTIVE",
      unit_id: 1,
      updated_at: "updated",
    }),
    {
      authIdentityId: "identity-1",
      createdAt: "created",
      createdByAuthIdentityId: "actor-1",
      id: "membership-1",
      isDefault: true,
      revokedAt: null,
      revokedByAuthIdentityId: null,
      role: "professor",
      status: "ACTIVE",
      unitId: "1",
      updatedAt: "updated",
    },
  );
});

test("MySqlUserUnitMembershipRepository duplicate helper detects canonical unique keys", () => {
  assert.equal(
    isUserUnitMembershipDuplicateEntryError({
      code: "ER_DUP_ENTRY",
      sqlMessage: "Duplicate entry for key 'ux_user_unit_memberships_active_default'",
    }),
    true,
  );
});
