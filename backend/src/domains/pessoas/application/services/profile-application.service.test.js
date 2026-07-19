const assert = require("node:assert/strict");
const test = require("node:test");
const { PersonProfileRepository } = require("../../profiles/person-profile.repository.js");
const {
  PROFILE_APPLICATION_ERROR_CODES,
  ProfileApplicationService,
} = require("./profile-application.service.js");

test("repository finds at most two profiles by person and type", async () => {
  const calls = [];
  const repository = new PersonProfileRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [
        { id: "pr1", person_id: "p1", profile_type: "aluno", status: "ativo" },
        { id: "pr2", person_id: "p1", profile_type: "aluno", status: "ativo" },
      ];
    },
  });
  assert.equal((await repository.findCandidatesByPersonAndType("p1", "aluno")).length, 2);
  assert.match(calls[0].sql, /person_id = \? AND profile_type = \?/u);
  assert.match(calls[0].sql, /LIMIT 2/u);
  assert.deepEqual(calls[0].params, ["p1", "aluno"]);
});

test("existing student profile is reused without writes", async () => {
  let creates = 0;
  const service = makeService({
    create: async () => creates++,
    findCandidatesByPersonAndType: async () => [{ id: "pr1" }],
  });
  assert.deepEqual(await service.resolveOrCreateStudentProfile({ personId: "p1" }), {
    personProfileId: "pr1",
    profileResolution: "FOUND",
    reused: true,
  });
  assert.equal(creates, 0);
});

test("missing student profile is created explicitly", async () => {
  const service = makeService({
    create: async (payload) => ({ ...payload, id: "created-profile" }),
  });
  assert.deepEqual(await service.resolveOrCreateStudentProfile({ id: "p1" }), {
    personProfileId: "created-profile",
    profileResolution: "CREATED",
    reused: false,
  });
});

test("responsible profile uses the same idempotent resolution contract", async () => {
  const calls = [];
  const service = makeService({
    findCandidatesByPersonAndType: async (personId, profileType) => {
      calls.push({ personId, profileType });
      return [{ id: "responsible-profile" }];
    },
  });

  assert.deepEqual(await service.resolveOrCreateResponsibleProfile({ personId: "p1" }), {
    personProfileId: "responsible-profile",
    profileResolution: "FOUND",
    reused: true,
  });
  assert.deepEqual(calls, [{ personId: "p1", profileType: "responsavel" }]);
});

test("multiple responsible profiles block arbitrary selection", async () => {
  const service = makeService({
    findCandidatesByPersonAndType: async () => [{ id: "pr1" }, { id: "pr2" }],
  });

  await assert.rejects(
    service.resolveOrCreateResponsibleProfile({ personId: "p1" }),
    (error) =>
      error.code === PROFILE_APPLICATION_ERROR_CODES.RESPONSIBLE_PROFILE_CONFLICT &&
      error.statusCode === 409,
  );
});

test("multiple student profiles block arbitrary selection", async () => {
  const service = makeService({
    findCandidatesByPersonAndType: async () => [{ id: "pr1" }, { id: "pr2" }],
  });
  await assert.rejects(service.resolveOrCreateStudentProfile({ personId: "p1" }), (error) => {
    assert.equal(error.code, PROFILE_APPLICATION_ERROR_CODES.STUDENT_PROFILE_CONFLICT);
    assert.equal(error.statusCode, 409);
    return true;
  });
});

test("sequential calls reuse the profile created by the first call", async () => {
  const profiles = [];
  const service = makeService({
    create: async (payload) => {
      const profile = { ...payload, id: "pr1" };
      profiles.push(profile);
      return profile;
    },
    findCandidatesByPersonAndType: async () => profiles,
  });
  assert.equal(
    (await service.resolveOrCreateStudentProfile({ personId: "p1" })).profileResolution,
    "CREATED",
  );
  assert.equal(
    (await service.resolveOrCreateStudentProfile({ personId: "p1" })).profileResolution,
    "FOUND",
  );
  assert.equal(profiles.length, 1);
});

test("profile creation failures are sanitized", async () => {
  const service = makeService({
    create: async () => {
      throw new Error("failed for p1 CPF 52998224725");
    },
  });
  await assert.rejects(service.resolveOrCreateStudentProfile({ personId: "p1" }), (error) => {
    assert.equal(error.code, PROFILE_APPLICATION_ERROR_CODES.CREATION_FAILED);
    assert.doesNotMatch(error.message, /p1|529/u);
    return true;
  });
});

function makeService(overrides = {}) {
  return new ProfileApplicationService({
    personProfileRepository: {
      create: async (payload) => ({ ...payload, id: "profile" }),
      findCandidatesByPersonAndType: async () => [],
      ...overrides,
    },
  });
}
