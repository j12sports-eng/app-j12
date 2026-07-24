const assert = require("node:assert/strict");
const test = require("node:test");

const {
  InMemoryAuthIdentityRepository,
} = require("./memory-auth-identity.repository.js");
const {
  INSERT_AUTH_IDENTITY_SQL,
  MySqlAuthIdentityRepository,
  SELECT_AUTH_IDENTITY_BY_SOURCE_USER_SQL,
  isAuthIdentityDuplicateEntryError,
  readAffectedRows,
  toAuthIdentityData,
} = require("./mysql-auth-identity.repository.js");

test("InMemoryAuthIdentityRepository enforces unique source/sourceUserId", async () => {
  const repository = new InMemoryAuthIdentityRepository();
  const first = await repository.create({
    id: "identity-1",
    source: "users",
    sourceUserId: "usr-admin",
  });

  await assert.rejects(
    () =>
      repository.create({
        id: "identity-2",
        source: "users",
        sourceUserId: "usr-admin",
      }),
    /Duplicate AuthIdentity/,
  );
  assert.equal(
    (await repository.findBySourceUser({ source: "users", sourceUserId: "usr-admin" })).id,
    first.id,
  );
});

test("InMemoryAuthIdentityRepository stores colliding IDs by source independently", async () => {
  const repository = new InMemoryAuthIdentityRepository();
  await repository.create({ id: "identity-users", source: "users", sourceUserId: "1" });
  await repository.create({ id: "identity-j12", source: "j12_usuarios", sourceUserId: "1" });

  assert.equal(
    (await repository.findBySourceUser({ source: "users", sourceUserId: "1" })).id,
    "identity-users",
  );
  assert.equal(
    (await repository.findBySourceUser({ source: "j12_usuarios", sourceUserId: "1" })).id,
    "identity-j12",
  );
});

test("MySqlAuthIdentityRepository uses parameterized SQL and minimal projection", async () => {
  const calls = [];
  const repository = new MySqlAuthIdentityRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      if (sql === INSERT_AUTH_IDENTITY_SQL) return { affectedRows: 1 };
      return [
        {
          created_at: "2026-07-24 12:00:00",
          disabled_at: null,
          id: params[0],
          source: "users",
          source_user_id: "usr-admin",
          status: "ACTIVE",
          updated_at: "2026-07-24 12:00:00",
        },
      ];
    },
  });

  const created = await repository.create({
    id: "identity-1",
    source: "users",
    sourceUserId: "usr-admin",
  });

  assert.equal(created.id, "identity-1");
  assert.equal(calls[0].params[2], "usr-admin");
  assert.equal(INSERT_AUTH_IDENTITY_SQL.includes("email"), false);
  assert.equal(INSERT_AUTH_IDENTITY_SQL.includes("cpf"), false);
  assert.equal(SELECT_AUTH_IDENTITY_BY_SOURCE_USER_SQL.includes("source_user_id = ?"), true);
});

test("MySqlAuthIdentityRepository sanitizes unexpected persistence results and detects duplicate key", async () => {
  const repository = new MySqlAuthIdentityRepository({
    queryRunner: async () => ({ affectedRows: 0 }),
  });

  await assert.rejects(
    () =>
      repository.create({
        id: "identity-1",
        source: "users",
        sourceUserId: "usr-admin",
      }),
    (error) => {
      assert.equal(error.code, "AUTH_IDENTITY_PERSISTENCE_FAILED");
      assert.equal(String(error.message).includes("usr-admin"), false);
      return true;
    },
  );
  assert.equal(readAffectedRows([{ affectedRows: 1 }]), 1);
  assert.equal(
    isAuthIdentityDuplicateEntryError({
      code: "ER_DUP_ENTRY",
      sqlMessage: "Duplicate entry for key 'ux_auth_identities_source_user'",
    }),
    true,
  );
});

test("toAuthIdentityData maps DB rows without PII fields", () => {
  assert.deepEqual(
    toAuthIdentityData({
      created_at: "created",
      disabled_at: null,
      email: "admin@example.test",
      id: "identity-1",
      source: "users",
      source_user_id: "usr-admin",
      status: "ACTIVE",
      updated_at: "updated",
    }),
    {
      createdAt: "created",
      disabledAt: null,
      id: "identity-1",
      source: "users",
      sourceUserId: "usr-admin",
      status: "ACTIVE",
      updatedAt: "updated",
    },
  );
});
