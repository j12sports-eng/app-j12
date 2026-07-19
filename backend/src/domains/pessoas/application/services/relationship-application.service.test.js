const assert = require("node:assert/strict");
const test = require("node:test");

const { PersonRelationshipRepository } = require("../../relationships/relationship.repository.js");
const {
  RELATIONSHIP_APPLICATION_ERROR_CODES,
  RelationshipApplicationService,
} = require("./relationship-application.service.js");

test("repository reads at most two active responsible-student relationships", async () => {
  const calls = [];
  const repository = new PersonRelationshipRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [
        {
          id: "relationship-1",
          person_id: "responsible-1",
          related_person_id: "student-1",
          relationship_type: "responsible",
          status: "active",
        },
      ];
    },
  });

  const result = await repository.findCandidatesByPeopleAndType(
    "responsible-1",
    "student-1",
    "responsible",
  );

  assert.equal(result.length, 1);
  assert.match(calls[0].sql, /status = 'active'/u);
  assert.match(calls[0].sql, /LIMIT 2/u);
  assert.deepEqual(calls[0].params, ["responsible-1", "student-1", "responsible"]);
});

test("existing relationship is reused without writes", async () => {
  let creates = 0;
  const service = makeService({
    create: async () => {
      creates += 1;
    },
    findCandidatesByPeopleAndType: async () => [{ id: "relationship-1" }],
  });

  assert.deepEqual(
    await service.resolveOrCreateResponsibleStudentRelationship({
      responsiblePersonId: "responsible-1",
      studentPersonId: "student-1",
    }),
    {
      relationshipId: "relationship-1",
      relationshipResolution: "FOUND",
      reused: true,
    },
  );
  assert.equal(creates, 0);
});

test("missing relationship is created once and then reused", async () => {
  const relationships = [];
  const service = makeService({
    create: async (payload) => {
      const relationship = { ...payload, id: "relationship-1" };
      relationships.push(relationship);
      return relationship;
    },
    findCandidatesByPeopleAndType: async () => relationships,
  });

  const command = {
    relationship: { responsavelLegal: true, tipo: "mae" },
    responsiblePersonId: "responsible-1",
    studentPersonId: "student-1",
  };
  assert.equal(
    (await service.resolveOrCreateResponsibleStudentRelationship(command)).relationshipResolution,
    "CREATED",
  );
  assert.equal(
    (await service.resolveOrCreateResponsibleStudentRelationship(command)).relationshipResolution,
    "FOUND",
  );
  assert.equal(relationships.length, 1);
  assert.equal(relationships[0].legalGuardian, true);
});

test("multiple active relationships return a controlled conflict", async () => {
  const service = makeService({
    findCandidatesByPeopleAndType: async () => [{ id: "r1" }, { id: "r2" }],
  });

  await assert.rejects(
    service.resolveOrCreateResponsibleStudentRelationship({
      responsiblePersonId: "responsible-1",
      studentPersonId: "student-1",
    }),
    (error) =>
      error.code === RELATIONSHIP_APPLICATION_ERROR_CODES.CONFLICT && error.statusCode === 409,
  );
});

test("relationship persistence failure is sanitized", async () => {
  const service = makeService({
    create: async () => {
      throw new Error("CPF 52998224725 SQL");
    },
  });

  await assert.rejects(
    service.resolveOrCreateResponsibleStudentRelationship({
      responsiblePersonId: "responsible-1",
      studentPersonId: "student-1",
    }),
    (error) =>
      error.code === RELATIONSHIP_APPLICATION_ERROR_CODES.CREATION_FAILED &&
      !error.message.includes("52998224725"),
  );
});

test("duplicate key rereads and reuses the winning relationship", async () => {
  let reads = 0;
  const service = makeService({
    create: async () => {
      throw Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" });
    },
    findCandidatesByPeopleAndType: async () =>
      ++reads === 1 ? [] : [{ id: "relationship-winner" }],
  });

  assert.deepEqual(
    await service.resolveOrCreateResponsibleStudentRelationship({
      responsiblePersonId: "responsible-1",
      studentPersonId: "student-1",
    }),
    {
      relationshipId: "relationship-winner",
      relationshipResolution: "FOUND",
      reused: true,
    },
  );
});

test("concurrent equivalent relationships create once and preserve different types", async () => {
  let winner = null;
  let creates = 0;
  const repository = {
    async create(payload) {
      await Promise.resolve();
      if (winner) throw Object.assign(new Error("duplicate"), { errno: 1062 });
      creates += 1;
      winner = { ...payload, id: "relationship-winner" };
      return winner;
    },
    async findCandidatesByPeopleAndType(_personId, _relatedPersonId, relationshipType) {
      return winner?.relationshipType === relationshipType ? [winner] : [];
    },
  };
  const service = new RelationshipApplicationService({ personRelationshipRepository: repository });
  const command = { responsiblePersonId: "responsible-1", studentPersonId: "student-1" };
  const results = await Promise.all([
    service.resolveOrCreateResponsibleStudentRelationship(command),
    service.resolveOrCreateResponsibleStudentRelationship(command),
  ]);

  assert.equal(creates, 1);
  assert.deepEqual(results.map((result) => result.relationshipResolution).sort(), [
    "CREATED",
    "FOUND",
  ]);
  assert.deepEqual(
    await repository.findCandidatesByPeopleAndType("responsible-1", "student-1", "guardian"),
    [],
  );
});

function makeService(overrides = {}) {
  return new RelationshipApplicationService({
    personRelationshipRepository: {
      create: async (payload) => ({ ...payload, id: "relationship-1" }),
      findCandidatesByPeopleAndType: async () => [],
      ...overrides,
    },
  });
}
