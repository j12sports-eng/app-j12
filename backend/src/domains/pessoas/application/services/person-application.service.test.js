const assert = require("node:assert/strict");
const test = require("node:test");
const { PersonIdentityNormalizationError } = require("../../person-identity-normalizer.js");
const {
  PERSON_APPLICATION_ERROR_CODES,
  PersonApplicationService,
} = require("./person-application.service.js");

test("FOUND by id reuses Pessoa and performs no write or update", async () => {
  const calls = [];
  const service = makeService({
    resolution: { status: "FOUND", matchedBy: "PERSON_ID", personId: "p1" },
    repository: {
      create: async () => (calls.push("create"), { id: "new" }),
      update: async () => calls.push("update"),
    },
  });
  assert.deepEqual(await service.resolveOrCreatePerson({ id: "p1", nome: "Changed" }), {
    created: false,
    identityResolution: "FOUND",
    personId: "p1",
    reused: true,
  });
  assert.deepEqual(calls, []);
});

test("default DI composes the canonical resolver with the injected repository", async () => {
  const reads = [];
  const service = new PersonApplicationService({
    personRepository: {
      create: async () => {
        throw new Error("must not create");
      },
      findById: async (id) => (reads.push(["id", id]), null),
      findIdentityCandidatesByNormalizedCpf: async (cpf) => (
        reads.push(["cpf", cpf]),
        [{ id: "canonical" }]
      ),
    },
  });
  assert.deepEqual(await service.resolveOrCreatePerson({ id: "missing", cpf: "529.982.247-25" }), {
    created: false,
    identityResolution: "FOUND",
    personId: "canonical",
    reused: true,
  });
  assert.deepEqual(reads, [
    ["id", "missing"],
    ["cpf", "52998224725"],
  ]);
});

test("FOUND by CPF reuses only personId without exposing or updating PII", async () => {
  const service = makeService({
    resolution: { status: "FOUND", matchedBy: "CPF", personId: "p2" },
  });
  const result = await service.resolveOrCreatePerson({
    cpf: "529.982.247-25",
    email: "shared@example.test",
    nome: "Received Name",
  });
  assert.deepEqual(result, {
    created: false,
    identityResolution: "FOUND",
    personId: "p2",
    reused: true,
  });
  assert.equal(JSON.stringify(result).includes("529"), false);
  assert.equal(JSON.stringify(result).includes("shared"), false);
});

test("NOT_FOUND creates exactly once and returns explicit state", async () => {
  let creates = 0;
  const service = makeService({
    resolution: { status: "NOT_FOUND", matchedBy: "CPF" },
    repository: { create: async () => ({ id: `created-${++creates}` }) },
  });
  assert.deepEqual(await service.resolveOrCreatePerson({ cpf: "52998224725", nome: "Pessoa" }), {
    created: true,
    identityResolution: "NOT_FOUND",
    personId: "created-1",
    reused: false,
  });
  assert.equal(creates, 1);
});

test("explicit missing person id is fail-closed when the caller requires an existing Pessoa", async () => {
  let creates = 0;
  const service = makeService({
    resolution: { status: "NOT_FOUND", matchedBy: "PERSON_ID" },
    repository: { create: async () => creates++ },
  });

  await assert.rejects(
    service.resolveOrCreatePerson(
      { personId: "missing-person" },
      { requireExistingPersonId: true },
    ),
    (error) => error.code === PERSON_APPLICATION_ERROR_CODES.NOT_FOUND && error.statusCode === 404,
  );
  assert.equal(creates, 0);
});

test("CONFLICT blocks creation with deterministic PII-safe error", async () => {
  let creates = 0;
  const service = makeService({
    resolution: { status: "CONFLICT", matchedBy: "CPF" },
    repository: { create: async () => creates++ },
  });
  await assert.rejects(
    service.resolveOrCreatePerson({ cpf: "52998224725", nome: "Pessoa" }),
    (error) => {
      assert.equal(error.code, PERSON_APPLICATION_ERROR_CODES.IDENTITY_CONFLICT);
      assert.equal(error.statusCode, 409);
      assert.doesNotMatch(error.message, /529|Pessoa/u);
      return true;
    },
  );
  assert.equal(creates, 0);
});

test("INSUFFICIENT_DATA allows basic creation without CPF", async () => {
  let received;
  const service = makeService({
    resolution: { status: "INSUFFICIENT_DATA" },
    repository: { create: async (payload) => ((received = payload), { id: "without-cpf" }) },
  });
  assert.deepEqual(await service.resolveOrCreatePerson({ nome: "Pessoa sem CPF", cpf: null }), {
    created: true,
    identityResolution: "INSUFFICIENT_DATA",
    personId: "without-cpf",
    reused: false,
  });
  assert.equal(received.cpf, null);
});

test("INSUFFICIENT_DATA blocks operations requiring strong identity", async () => {
  const service = makeService({ resolution: { status: "INSUFFICIENT_DATA" } });
  await assert.rejects(
    service.resolveOrCreatePerson({ nome: "Pessoa" }, { requiresStrongIdentity: true }),
    (error) => error.code === PERSON_APPLICATION_ERROR_CODES.IDENTITY_REQUIRED,
  );
});

test("invalid CPF is rejected by the canonical normalizer before resolution or creation", async () => {
  let resolved = false;
  let created = false;
  const service = new PersonApplicationService({
    personRepository: { create: async () => (created = true) },
    resolveIdentityService: { resolve: async () => (resolved = true) },
  });
  await assert.rejects(
    service.resolveOrCreatePerson({ cpf: "abcXYZ", nome: "Fulano" }),
    (error) => {
      assert.ok(error instanceof PersonIdentityNormalizationError);
      assert.equal(error.code, "PERSON_CPF_INVALID");
      assert.doesNotMatch(error.message, /abcXYZ|Fulano/u);
      return true;
    },
  );
  assert.equal(resolved, false);
  assert.equal(created, false);
});

test("email and telephone remain contacts and do not prevent CPF-less creation", async () => {
  const service = makeService({
    resolution: { status: "INSUFFICIENT_DATA" },
    repository: { create: async () => ({ id: "contact-person" }) },
  });
  const result = await service.resolveOrCreatePerson({
    email: "shared@example.test",
    nome: "Pessoa",
    telefone: "11999999999",
  });
  assert.equal(result.personId, "contact-person");
  assert.equal(result.identityResolution, "INSUFFICIENT_DATA");
});

test("resolver infrastructure errors stay sanitized and prevent writes", async () => {
  let creates = 0;
  const service = new PersonApplicationService({
    personRepository: { create: async () => creates++ },
    resolveIdentityService: {
      resolve: async () => {
        const error = new Error("Identity resolution is temporarily unavailable.");
        error.code = "IDENTITY_RESOLUTION_UNAVAILABLE";
        throw error;
      },
    },
  });
  await assert.rejects(service.resolveOrCreatePerson({ cpf: "52998224725" }), (error) => {
    assert.equal(error.code, "IDENTITY_RESOLUTION_UNAVAILABLE");
    assert.doesNotMatch(error.message, /529/u);
    return true;
  });
  assert.equal(creates, 0);
});

test("creation failures are converted to a deterministic safe error", async () => {
  const service = makeService({
    resolution: { status: "NOT_FOUND" },
    repository: {
      create: async () => {
        throw new Error("failed for 52998224725 Pessoa");
      },
    },
  });
  await assert.rejects(
    service.resolveOrCreatePerson({ cpf: "52998224725", nome: "Pessoa" }),
    (error) => {
      assert.equal(error.code, PERSON_APPLICATION_ERROR_CODES.CREATION_FAILED);
      assert.equal(error.statusCode, 500);
      assert.doesNotMatch(error.message, /529|Pessoa/u);
      return true;
    },
  );
});

test("authorization context is not mutated or interpreted as global access", async () => {
  const context = Object.freeze({
    requiresStrongIdentity: false,
    unitId: "unit-1",
    userId: "user-1",
  });
  const service = makeService({
    resolution: { status: "NOT_FOUND" },
    repository: { create: async () => ({ id: "p1" }) },
  });
  await service.resolveOrCreatePerson({ nome: "Pessoa" }, context);
  assert.deepEqual(context, { requiresStrongIdentity: false, unitId: "unit-1", userId: "user-1" });
});

test("createPerson preserves its existing repository return contract", async () => {
  const persisted = { cpf: null, id: "legacy-contract", nome: "Pessoa" };
  const service = new PersonApplicationService({
    personRepository: { create: async () => persisted },
  });
  assert.equal(await service.createPerson({ nome: "Pessoa" }), persisted);
});

test("application service exports load without circular dependency", () => {
  const exports = require("./index.js");
  assert.equal(exports.PersonApplicationService, PersonApplicationService);
  assert.equal(typeof exports.ResolveIdentityService, "function");
});

function makeService({ repository = {}, resolution = { status: "INSUFFICIENT_DATA" } } = {}) {
  return new PersonApplicationService({
    personRepository: {
      create: async () => ({ id: "created" }),
      ...repository,
    },
    resolveIdentityService: {
      resolve: async () => resolution,
    },
  });
}
