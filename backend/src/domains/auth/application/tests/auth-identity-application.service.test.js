const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AUTH_IDENTITY_ERROR_CODES,
  AuthIdentityApplicationService,
} = require("../services/auth-identity-application.service.js");
const {
  InMemoryAuthIdentityRepository,
} = require("../../infrastructure/repositories/memory-auth-identity.repository.js");

test("resolveOrCreateIdentity creates a stable users identity without PII logs", async () => {
  const records = [];
  const service = createService({
    logger: {
      info(message, metadata) {
        records.push({ message, metadata });
      },
    },
  });

  const result = await service.resolveOrCreateIdentity(
    { source: "users", sourceUserId: "usr-admin" },
    { actorId: "actor-1", correlationId: "corr-1", requestId: "req-1" },
  );

  assert.equal(result.created, true);
  assert.equal(result.reused, false);
  assert.equal(result.source, "users");
  assert.equal(result.identity.sourceUserId, "usr-admin");
  assert.equal(records[0].metadata.action, "AUTH_IDENTITY_CREATED");
  assert.equal(records[0].metadata.source, "users");
  assert.equal(JSON.stringify(records).includes("sourceUserId"), false);
  assert.equal(JSON.stringify(records).includes("usr-admin"), false);
});

test("resolveOrCreateIdentity is idempotent for the same source user", async () => {
  const service = createService();
  const first = await service.resolveOrCreateIdentity({
    source: "users",
    sourceUserId: "usr-admin",
  });
  const second = await service.resolveOrCreateIdentity({
    source: "users",
    sourceUserId: "usr-admin",
  });

  assert.equal(first.authIdentityId, second.authIdentityId);
  assert.equal(second.created, false);
  assert.equal(second.reused, true);
});

test("resolveOrCreateIdentity keeps colliding physical IDs separated by source", async () => {
  const service = createService();
  const usersIdentity = await service.resolveOrCreateIdentity({
    source: "users",
    sourceUserId: "1",
  });
  const j12Identity = await service.resolveOrCreateIdentity({
    source: "j12_usuarios",
    sourceUserId: "1",
  });

  assert.notEqual(usersIdentity.authIdentityId, j12Identity.authIdentityId);
  assert.equal(usersIdentity.identity.source, "users");
  assert.equal(j12Identity.identity.source, "j12_usuarios");
});

test("resolveOrCreateIdentity rejects malformed, unsupported and mass-assignment input", async () => {
  const service = createService();

  await rejectsCode(
    () => service.resolveOrCreateIdentity({ source: "staff", sourceUserId: "1" }),
    AUTH_IDENTITY_ERROR_CODES.SOURCE_UNSUPPORTED,
  );
  await rejectsCode(
    () => service.resolveOrCreateIdentity({ source: "j12_usuarios", sourceUserId: "abc" }),
    AUTH_IDENTITY_ERROR_CODES.INPUT_INVALID,
  );
  await rejectsCode(
    () =>
      service.resolveOrCreateIdentity({
        role: "admin",
        source: "users",
        sourceUserId: "usr-admin",
      }),
    AUTH_IDENTITY_ERROR_CODES.INPUT_INVALID,
  );
});

test("resolveOrCreateIdentity fails closed for missing resolver, adapter failure and source state", async () => {
  await rejectsCode(
    () =>
      new AuthIdentityApplicationService({
        authIdentityRepository: new InMemoryAuthIdentityRepository(),
      }).resolveOrCreateIdentity({ source: "users", sourceUserId: "usr-admin" }),
    AUTH_IDENTITY_ERROR_CODES.SOURCE_RESOLVER_MISSING,
  );

  await rejectsCode(
    () =>
      createService({
        resolveUsersSourceUser: async () => {
          throw new Error("db with email@example.test");
        },
      }).resolveOrCreateIdentity({ source: "users", sourceUserId: "usr-admin" }),
    AUTH_IDENTITY_ERROR_CODES.SOURCE_RESOLUTION_FAILED,
  );

  await rejectsCode(
    () =>
      createService({
        resolveUsersSourceUser: async () => null,
      }).resolveOrCreateIdentity({ source: "users", sourceUserId: "usr-missing" }),
    AUTH_IDENTITY_ERROR_CODES.SOURCE_USER_NOT_FOUND,
  );

  await rejectsCode(
    () =>
      createService({
        resolveUsersSourceUser: async () => ({ id: "usr-admin", status: "inativo" }),
      }).resolveOrCreateIdentity({ source: "users", sourceUserId: "usr-admin" }),
    AUTH_IDENTITY_ERROR_CODES.SOURCE_USER_INACTIVE,
  );
});

test("resolveOrCreateIdentity handles duplicate-entry races by reading the created identity", async () => {
  const repository = new DuplicateOnCreateRepository();
  const service = createService({ repository });

  const result = await service.resolveOrCreateIdentity({
    source: "users",
    sourceUserId: "usr-admin",
  });

  assert.equal(result.created, false);
  assert.equal(result.reused, true);
  assert.equal(result.authIdentityId, "identity-created-by-other-request");
});

test("resolveOrCreateIdentity rejects disabled identity and removed source user", async () => {
  const repository = new InMemoryAuthIdentityRepository({
    initialRows: [
      {
        id: "identity-disabled",
        source: "users",
        sourceUserId: "usr-admin",
        status: "DISABLED",
      },
    ],
  });

  await rejectsCode(
    () => createService({ repository }).resolveOrCreateIdentity({ source: "users", sourceUserId: "usr-admin" }),
    AUTH_IDENTITY_ERROR_CODES.DISABLED,
  );

  const existingRepository = new InMemoryAuthIdentityRepository({
    initialRows: [
      {
        id: "identity-existing",
        source: "users",
        sourceUserId: "usr-removed",
        status: "ACTIVE",
      },
    ],
  });

  await rejectsCode(
    () =>
      createService({
        repository: existingRepository,
        resolveUsersSourceUser: async () => null,
      }).resolveOrCreateIdentity({ source: "users", sourceUserId: "usr-removed" }),
    AUTH_IDENTITY_ERROR_CODES.SOURCE_USER_NOT_FOUND,
  );
});

test("findIdentity and findBySourceUser return active identities only", async () => {
  const repository = new InMemoryAuthIdentityRepository({
    initialRows: [
      {
        id: "identity-active",
        source: "users",
        sourceUserId: "usr-admin",
        status: "ACTIVE",
      },
      {
        id: "identity-disabled",
        source: "j12_usuarios",
        sourceUserId: "12",
        status: "DISABLED",
      },
    ],
  });
  const service = createService({ repository });

  assert.equal((await service.findIdentity({ identityId: "identity-active" })).authIdentityId, "identity-active");
  assert.equal(
    (await service.findBySourceUser({ source: "users", sourceUserId: "usr-admin" })).authIdentityId,
    "identity-active",
  );
  await rejectsCode(
    () => service.findIdentity({ identityId: "identity-disabled" }),
    AUTH_IDENTITY_ERROR_CODES.DISABLED,
  );
});

test("findIdentity fails closed when the source user no longer exists", async () => {
  const repository = new InMemoryAuthIdentityRepository({
    initialRows: [
      {
        id: "identity-orphan",
        source: "users",
        sourceUserId: "usr-orphan",
        status: "ACTIVE",
      },
    ],
  });

  await rejectsCode(
    () =>
      createService({
        repository,
        resolveUsersSourceUser: async () => null,
      }).findIdentity({ identityId: "identity-orphan" }),
    AUTH_IDENTITY_ERROR_CODES.SOURCE_USER_NOT_FOUND,
  );
});
function createService(options = {}) {
  return new AuthIdentityApplicationService({
    authIdentityRepository: options.repository || new InMemoryAuthIdentityRepository(),
    logger: options.logger || null,
    resolveJ12UsuariosSourceUser:
      options.resolveJ12UsuariosSourceUser ||
      (async ({ sourceUserId }) => ({ id: sourceUserId, status: "ativo" })),
    resolveUsersSourceUser:
      options.resolveUsersSourceUser ||
      (async ({ sourceUserId }) => ({ id: sourceUserId, status: "ativo" })),
  });
}

class DuplicateOnCreateRepository extends InMemoryAuthIdentityRepository {
  constructor() {
    super({
      initialRows: [
        {
          id: "identity-created-by-other-request",
          source: "users",
          sourceUserId: "usr-admin",
          status: "ACTIVE",
        },
      ],
    });
    this.firstFind = true;
  }

  async findBySourceUser(input) {
    if (this.firstFind) {
      this.firstFind = false;
      return null;
    }
    return super.findBySourceUser(input);
  }

  async create() {
    const error = new Error("duplicate");
    error.code = "ER_DUP_ENTRY";
    error.errno = 1062;
    throw error;
  }
}

async function rejectsCode(action, code) {
  await assert.rejects(action, (error) => {
    assert.equal(error.code, code);
    assert.equal(String(error.message).includes("usr-admin"), false);
    assert.equal(String(error.stack || "").includes("usr-admin"), false);
    return true;
  });
}
