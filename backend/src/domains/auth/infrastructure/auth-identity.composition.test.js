const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createAuthIdentityComposition,
  createAuthIdentitySourceResolvers,
} = require("./auth-identity.composition.js");

test("auth identity composition wires service without mounting routes", () => {
  const repository = {
    create() {},
    findById() {},
    findBySourceUser() {},
  };
  const composition = createAuthIdentityComposition({
    authIdentityRepository: repository,
    resolveJ12UsuariosSourceUser: async () => ({ id: "1", status: "ativo" }),
    resolveUsersSourceUser: async () => ({ id: "usr-admin", status: "ativo" }),
  });

  assert.equal(composition.authIdentityRepository, repository);
  assert.equal(typeof composition.authIdentityService.resolveOrCreateIdentity, "function");
  assert.equal(typeof composition.sourceResolvers.resolveUsersSourceUser, "function");
});

test("source resolvers select only id and status from canonical auth runtime tables", async () => {
  const calls = [];
  const resolvers = createAuthIdentitySourceResolvers({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      if (sql.includes("j12_usuarios")) return [{ id: 12, status: "ativo", email: "x" }];
      return [{ id: "usr-admin", status: "ativo", email: "x" }];
    },
  });

  assert.deepEqual(await resolvers.resolveUsersSourceUser({ sourceUserId: "usr-admin" }), {
    source: "users",
    sourceUserId: "usr-admin",
    status: "ativo",
  });
  assert.deepEqual(await resolvers.resolveJ12UsuariosSourceUser({ sourceUserId: "12" }), {
    source: "j12_usuarios",
    sourceUserId: "12",
    status: "ativo",
  });
  assert.equal(calls[0].sql.includes("SELECT id, status FROM users"), true);
  assert.equal(calls[1].sql.includes("SELECT id, status FROM j12_usuarios"), true);
  assert.equal(calls.map((call) => call.sql).join("\n").includes("email"), false);
  assert.equal(await resolvers.resolveJ12UsuariosSourceUser({ sourceUserId: "abc" }), null);
});
