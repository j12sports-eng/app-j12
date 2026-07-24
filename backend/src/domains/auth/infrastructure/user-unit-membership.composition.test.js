const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createAuthIdentityResolver,
  createUnitResolver,
  createUserUnitMembershipComposition,
} = require("./user-unit-membership.composition.js");

test("user-unit membership composition wires canonical repositories and service", async () => {
  const authIdentityRepository = {
    findById: async () => ({ id: "identity-1", status: "ACTIVE" }),
  };
  const membershipRepository = {
    create() {},
    findById() {},
    findByIdentityAndUnit() {},
  };

  const composition = createUserUnitMembershipComposition({
    authIdentityRepository,
    membershipRepository,
    unitResolver: async () => ({ id: "1", status: "ativo" }),
  });

  assert.equal(composition.authIdentityRepository, authIdentityRepository);
  assert.equal(composition.membershipRepository, membershipRepository);
  assert.equal(typeof composition.membershipService.grantMembership, "function");
  assert.deepEqual(
    await composition.authIdentityResolver({ authIdentityId: "identity-1" }),
    { id: "identity-1", status: "ACTIVE" },
  );
});

test("user-unit membership resolvers stay on canonical id and status fields", async () => {
  const calls = [];
  const authIdentityResolver = createAuthIdentityResolver({
    authIdentityRepository: {
      findById: async (authIdentityId) => {
        calls.push(authIdentityId);
        return { id: authIdentityId, status: "ACTIVE", email: "hidden@example.test" };
      },
    },
  });
  const unitResolver = createUnitResolver({
    queryRunner: async (sql, params) => {
      calls.push({ sql, params });
      return [[{ id: 7, status: "ativo", nome: "Unit 7" }]];
    },
  });

  assert.deepEqual(await authIdentityResolver({ authIdentityId: "identity-1" }), {
    id: "identity-1",
    status: "ACTIVE",
  });
  assert.deepEqual(await unitResolver({ unitId: "7" }), {
    id: "7",
    status: "ativo",
  });
  assert.equal(calls[1].sql.includes("SELECT id, status FROM j12_unidades"), true);
  assert.equal(await unitResolver({ unitId: "abc" }), null);
});
