const assert = require("node:assert/strict");
const test = require("node:test");
const {
  IdentityResolutionInfrastructureError,
  ResolveIdentityService,
} = require("./resolve-identity.service.js");
const { PersonRepository } = require("../../person.repository.js");

test("repository resolves normalized CPF with one bounded parameterized read", async () => {
  const calls = [];
  const repository = new PersonRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [{ id: "p1" }, { id: "p2" }];
    },
  });
  assert.deepEqual(await repository.findIdentityCandidatesByNormalizedCpf("52998224725"), [
    { id: "p1" },
    { id: "p2" },
  ]);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /WHERE cpf_normalized = \?/u);
  assert.match(calls[0].sql, /LIMIT 2/u);
  assert.deepEqual(calls[0].params, ["52998224725"]);
});

test("finds by id before CPF", async () => {
  const calls = [];
  const service = makeService({
    findById: async (id) => (calls.push(["id", id]), { id }),
    findIdentityCandidatesByNormalizedCpf: async () => (calls.push(["cpf"]), []),
  });
  assert.deepEqual(await service.resolve({ personId: "p1", cpf: "529.982.247-25" }), {
    status: "FOUND",
    matchedBy: "PERSON_ID",
    personId: "p1",
  });
  assert.deepEqual(calls, [["id", "p1"]]);
});

test("finds a unique person by normalized CPF", async () => {
  const calls = [];
  const service = makeService({
    findIdentityCandidatesByNormalizedCpf: async (cpf) => (calls.push(cpf), [{ id: "p2" }]),
  });
  assert.deepEqual(await service.resolve({ cpf: "529.982.247-25" }), {
    status: "FOUND",
    matchedBy: "CPF",
    personId: "p2",
  });
  assert.deepEqual(calls, ["52998224725"]);
});

test("returns NOT_FOUND for a missing canonical identity", async () => {
  const service = makeService();
  assert.deepEqual(await service.resolve({ personId: "missing" }), {
    status: "NOT_FOUND",
    matchedBy: "PERSON_ID",
  });
  assert.deepEqual(await service.resolve({ cpfNormalized: "52998224725" }), {
    status: "NOT_FOUND",
    matchedBy: "CPF",
  });
});

test("returns INSUFFICIENT_DATA for absent, invalid or shared-only identifiers", async () => {
  const service = makeService();
  for (const input of [
    {},
    null,
    { cpf: "invalid" },
    { email: "shared@example.test" },
    { telefone: "11999999999" },
  ]) {
    assert.deepEqual(await service.resolve(input), { status: "INSUFFICIENT_DATA" });
  }
});

test("returns CONFLICT for duplicate normalized CPF", async () => {
  const service = makeService({
    findIdentityCandidatesByNormalizedCpf: async () => [{ id: "p1" }, { id: "p2" }],
  });
  assert.deepEqual(await service.resolve({ cpf: "52998224725" }), {
    status: "CONFLICT",
    matchedBy: "CPF",
  });
});

test("falls through from a missing id to CPF", async () => {
  const service = makeService({
    findIdentityCandidatesByNormalizedCpf: async () => [{ id: "by-cpf" }],
  });
  assert.deepEqual(await service.resolve({ id: "missing", cpf: "52998224725" }), {
    status: "FOUND",
    matchedBy: "CPF",
    personId: "by-cpf",
  });
});

test("sanitizes repository failures without exposing PII", async () => {
  const cpf = "529.982.247-25";
  const service = makeService({
    findIdentityCandidatesByNormalizedCpf: async () => {
      throw new Error(`database rejected ${cpf}`);
    },
  });
  await assert.rejects(service.resolve({ cpf }), (error) => {
    assert.ok(error instanceof IdentityResolutionInfrastructureError);
    assert.equal(error.code, "IDENTITY_RESOLUTION_UNAVAILABLE");
    assert.doesNotMatch(
      `${error.name} ${error.message} ${JSON.stringify(error)}`,
      /529|982|247|25/u,
    );
    return true;
  });
});

function makeService(overrides = {}) {
  return new ResolveIdentityService({
    personRepository: {
      findById: async () => null,
      findIdentityCandidatesByNormalizedCpf: async () => [],
      ...overrides,
    },
  });
}
