const assert = require("node:assert/strict");
const test = require("node:test");
const {
  STUDENT_APPLICATION_ERROR_CODES,
  StudentApplicationService,
} = require("./student-application.service.js");

test("reuses existing Pessoa and Aluno profile in the modern model", async () => {
  const service = makeService({
    personResult: { created: false, personId: "p1", reused: true },
    profileResult: { personProfileId: "pr1", profileResolution: "FOUND", reused: true },
  });
  assert.deepEqual(await service.resolveOrCreateStudent({ personId: "p1" }), {
    personId: "p1",
    personProfileId: "pr1",
    personResolution: "FOUND",
    profileResolution: "FOUND",
    reused: { person: true, profile: true },
  });
});

test("creates Pessoa and Aluno profile explicitly without inventing studentId", async () => {
  const service = makeService({
    personResult: { created: true, personId: "p2", reused: false },
    profileResult: { personProfileId: "pr2", profileResolution: "CREATED", reused: false },
  });
  const result = await service.resolveOrCreateStudent(validStudent());
  assert.deepEqual(result, {
    personId: "p2",
    personProfileId: "pr2",
    personResolution: "CREATED",
    profileResolution: "CREATED",
    reused: { person: false, profile: false },
  });
  assert.equal(Object.hasOwn(result, "studentId"), false);
});

test("Pessoa conflict blocks profile resolution", async () => {
  let profileCalls = 0;
  const conflict = Object.assign(new Error("Identity conflict requires assisted review."), {
    code: "PERSON_IDENTITY_CONFLICT",
  });
  const service = makeService({
    personError: conflict,
    profileHandler: async () => profileCalls++,
  });
  await assert.rejects(
    service.resolveOrCreateStudent(validStudent()),
    (error) => error === conflict,
  );
  assert.equal(profileCalls, 0);
});

test("required student data is validated before Pessoa resolution", async () => {
  let personCalls = 0;
  const service = makeService({ personHandler: async () => personCalls++ });
  await assert.rejects(service.resolveOrCreateStudent({ cpf: "52998224725" }), (error) => {
    assert.equal(error.code, STUDENT_APPLICATION_ERROR_CODES.DATA_INCOMPLETE);
    assert.deepEqual(error.details.fields, ["nome", "dataNascimento", "sexo"]);
    assert.doesNotMatch(error.message, /529/u);
    return true;
  });
  assert.equal(personCalls, 0);
});

test("CPF-less student creation remains allowed with mandatory data", async () => {
  let personPayload;
  const service = makeService({
    personHandler: async (payload) => {
      personPayload = payload;
      return { created: true, personId: "p1", reused: false };
    },
  });
  await service.resolveOrCreateStudent(validStudent({ cpf: null }));
  assert.equal(personPayload.cpf, null);
});

test("contacts are delegated but never used by StudentApplicationService as identity", async () => {
  let personPayload;
  const service = makeService({
    personHandler: async (payload) => {
      personPayload = payload;
      return { created: true, personId: "p1", reused: false };
    },
  });
  await service.resolveOrCreateStudent(
    validStudent({ email: "shared@example.test", telefone: "11999999999" }),
  );
  assert.equal(personPayload.email, "shared@example.test");
  assert.equal(personPayload.telefone, "11999999999");
});

test("profile failure does not repeat Pessoa work inside the operation", async () => {
  let personCalls = 0;
  const failure = Object.assign(new Error("Student profile creation failed."), {
    code: "PROFILE_CREATION_FAILED",
  });
  const service = makeService({
    personHandler: async () => {
      personCalls += 1;
      return { created: true, personId: "p1", reused: false };
    },
    profileError: failure,
  });
  await assert.rejects(
    service.resolveOrCreateStudent(validStudent()),
    (error) => error === failure,
  );
  assert.equal(personCalls, 1);
});

test("authorization context is passed unchanged only to the Pessoa boundary", async () => {
  const context = Object.freeze({ unitId: "u1", userId: "user1" });
  let receivedContext;
  const service = makeService({
    personHandler: async (_payload, received) => {
      receivedContext = received;
      return { created: false, personId: "p1", reused: true };
    },
  });
  await service.resolveOrCreateStudent({ personId: "p1" }, context);
  assert.equal(receivedContext, context);
});

function validStudent(overrides = {}) {
  return {
    dataNascimento: "2010-01-01",
    nome: "Student Fixture",
    sexo: "F",
    ...overrides,
  };
}

function makeService(options = {}) {
  return new StudentApplicationService({
    personApplicationService: {
      createPerson: async () => ({ id: "legacy-compatible" }),
      resolveOrCreatePerson:
        options.personHandler ||
        (async () => {
          if (options.personError) throw options.personError;
          return options.personResult || { created: false, personId: "p1", reused: true };
        }),
    },
    profileApplicationService: {
      createStudentProfile: async () => ({ id: "legacy-profile" }),
      resolveOrCreateStudentProfile:
        options.profileHandler ||
        (async () => {
          if (options.profileError) throw options.profileError;
          return (
            options.profileResult || {
              personProfileId: "pr1",
              profileResolution: "FOUND",
              reused: true,
            }
          );
        }),
    },
  });
}
