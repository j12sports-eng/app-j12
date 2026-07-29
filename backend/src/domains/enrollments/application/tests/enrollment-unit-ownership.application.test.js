const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_UNIT_OWNERSHIP_CONFLICT_CODE,
  EnrollmentApplicationService,
} = require("../services/enrollment-application.service.js");

function draftInput(overrides = {}) {
  return {
    responsiblePersonId: "responsible-person-1",
    responsibleProfileId: "responsible-profile-1",
    responsibleRelationshipId: "relationship-1",
    startDate: "2026-08-01",
    studentPersonId: "person-1",
    studentProfileId: "profile-1",
    unitId: "12",
    ...overrides,
  };
}

test("createDraftEnrollment propagates canonical unitId", () => {
  const service = new EnrollmentApplicationService();
  const enrollment = service.createDraftEnrollment(draftInput());

  assert.equal(enrollment.unitId, "12");
  assert.equal(enrollment.toJSON().unitId, "12");
});

test("atomic idempotent reuse succeeds inside the same unit", async () => {
  const existing = { id: "enrollment-1", ...draftInput() };
  const service = new EnrollmentApplicationService({
    enrollmentRepository: {
      async create() {
        throw new Error("create must not be called");
      },
      async createDraftIfNotExists(enrollment) {
        assert.equal(enrollment.unitId, "12");
        return { created: false, enrollment: existing, reused: true };
      },
    },
  });

  const result = await service.createDraftEnrollmentIdempotently(draftInput());

  assert.equal(result.created, false);
  assert.equal(result.reused, true);
  assert.equal(result.draftEnrollment, existing);
});

test("atomic idempotent reuse fails closed across units", async () => {
  const service = new EnrollmentApplicationService({
    enrollmentRepository: {
      async create() {
        throw new Error("create must not be called");
      },
      async createDraftIfNotExists() {
        return {
          created: false,
          enrollment: { id: "enrollment-1", unitId: "99" },
          reused: true,
        };
      },
    },
  });

  await assert.rejects(
    () => service.createDraftEnrollmentIdempotently(draftInput()),
    (error) => error?.code === ENROLLMENT_UNIT_OWNERSHIP_CONFLICT_CODE,
  );
});

test("atomic idempotent reuse blocks legacy draft without ownership", async () => {
  const service = new EnrollmentApplicationService({
    enrollmentRepository: {
      async create() {
        throw new Error("create must not be called");
      },
      async createDraftIfNotExists() {
        return {
          created: false,
          enrollment: { id: "enrollment-legacy", unitId: null },
          reused: true,
        };
      },
    },
  });

  await assert.rejects(
    () => service.createDraftEnrollmentIdempotently(draftInput()),
    (error) => error?.code === ENROLLMENT_UNIT_OWNERSHIP_CONFLICT_CODE,
  );
});

test("fallback idempotency allows reuse inside the same unit", async () => {
  const existing = { id: "enrollment-1", ...draftInput() };
  const service = new EnrollmentApplicationService({
    enrollmentRepository: {
      async create() {
        throw new Error("create must not be called");
      },
      async findDraftByStudent(input) {
        assert.deepEqual(input, {
          studentPersonId: "person-1",
          studentProfileId: "profile-1",
          unitId: "12",
        });
        return existing;
      },
    },
  });

  const result = await service.createDraftEnrollmentIdempotently(draftInput());

  assert.equal(result.created, false);
  assert.equal(result.reused, true);
  assert.equal(result.draftEnrollment, existing);
});

test("fallback idempotency fails before create when unit differs", async () => {
  let createCalls = 0;
  const service = new EnrollmentApplicationService({
    enrollmentRepository: {
      async create() {
        createCalls += 1;
        return null;
      },
      async findDraftByStudent() {
        return { id: "enrollment-1", unitId: "99" };
      },
    },
  });

  await assert.rejects(
    () => service.createDraftEnrollmentIdempotently(draftInput()),
    (error) => error?.code === ENROLLMENT_UNIT_OWNERSHIP_CONFLICT_CODE,
  );

  assert.equal(createCalls, 0);
});

test("new draft is persisted with its unit ownership", async () => {
  let persisted = null;
  const service = new EnrollmentApplicationService({
    enrollmentRepository: {
      async create(enrollment) {
        persisted = enrollment;
        return enrollment;
      },
      async findDraftByStudent() {
        return null;
      },
    },
  });

  const result = await service.createDraftEnrollmentIdempotently(draftInput());

  assert.equal(result.created, true);
  assert.equal(result.reused, false);
  assert.equal(persisted.unitId, "12");
  assert.equal(result.draftEnrollment.unitId, "12");
  assert.equal(persisted.responsiblePersonId, "responsible-person-1");
});

test("trusted ActorContext overrides a hostile input unit selector", async () => {
  let persisted = null;
  const service = new EnrollmentApplicationService({
    enrollmentRepository: {
      async create(enrollment) {
        persisted = enrollment;
        return enrollment;
      },
      async findDraftByStudent() {
        return null;
      },
    },
  });

  await service.createDraftEnrollmentIdempotently(draftInput({ unitId: "999" }), {
    unitId: "12",
  });
  assert.equal(persisted.unitId, "12");
});

test("missing unitId is rejected before repository access", async () => {
  let repositoryCalls = 0;
  const service = new EnrollmentApplicationService({
    enrollmentRepository: {
      async create() {
        repositoryCalls += 1;
      },
      async createDraftIfNotExists() {
        repositoryCalls += 1;
      },
    },
  });

  await assert.rejects(
    () => service.createDraftEnrollmentIdempotently(draftInput({ unitId: undefined })),
    /requires unitId/,
  );

  assert.equal(repositoryCalls, 0);
});

class MultiunitDraftRepository {
  constructor() {
    this.records = [];
  }

  async validateDraftOwnership(enrollment) {
    if (enrollment.responsibleRelationshipId === "relationship-invalid") {
      const error = new Error("Relationship ownership mismatch.");
      error.code = "ENROLLMENT_DRAFT_OWNERSHIP_INVALID";
      throw error;
    }
  }

  async create(enrollment) {
    return enrollment;
  }

  async createDraftIfNotExists(enrollment) {
    const existing = this.findCurrent(enrollment, "DRAFT");
    if (existing) {
      return { created: false, enrollment: existing, reused: true };
    }
    const record = { ...enrollment, id: `draft-${this.records.length + 1}` };
    this.records.push(record);
    return { created: true, enrollment: record, reused: false };
  }

  async findActiveByStudent(input) {
    return this.findCurrent(input, "ACTIVE");
  }

  findCurrent(input, status) {
    for (const record of this.records) {
      if (record.status !== status) continue;
      if (record.unitId !== input.unitId) continue;
      if (record.studentPersonId !== input.studentPersonId) continue;
      if (record.studentProfileId !== input.studentProfileId) continue;
      return record;
    }
    return null;
  }
}

test("same student has independent DRAFTs in different units", async () => {
  const repository = new MultiunitDraftRepository();
  const service = new EnrollmentApplicationService({ enrollmentRepository: repository });
  const first = await service.createDraftEnrollmentIdempotently(draftInput({ unitId: "12" }));
  const second = await service.createDraftEnrollmentIdempotently(draftInput({ unitId: "13" }));

  assert.equal(first.created, true);
  assert.equal(second.created, true);
  assert.notEqual(first.draftEnrollment.id, second.draftEnrollment.id);
});

test("same responsible can create one DRAFT for each student", async () => {
  const repository = new MultiunitDraftRepository();
  const service = new EnrollmentApplicationService({ enrollmentRepository: repository });
  const first = await service.createDraftEnrollmentIdempotently(draftInput());
  const second = await service.createDraftEnrollmentIdempotently(
    draftInput({ studentPersonId: "person-2", studentProfileId: "profile-2" }),
  );

  assert.equal(first.created, true);
  assert.equal(second.created, true);
  assert.equal(repository.records.length, 2);
});

test("same functional DRAFT identity is reused", async () => {
  const repository = new MultiunitDraftRepository();
  const service = new EnrollmentApplicationService({ enrollmentRepository: repository });
  const first = await service.createDraftEnrollmentIdempotently(draftInput());
  const second = await service.createDraftEnrollmentIdempotently(draftInput());

  assert.equal(first.created, true);
  assert.equal(second.reused, true);
  assert.equal(second.draftEnrollment.id, first.draftEnrollment.id);
});

test("ACTIVE is scoped to unit when guarding DRAFT creation", async () => {
  const repository = new MultiunitDraftRepository();
  repository.records.push({ ...draftInput({ unitId: "13" }), id: "active-13", status: "ACTIVE" });
  const service = new EnrollmentApplicationService({ enrollmentRepository: repository });

  const allowed = await service.ensureNoActiveEnrollment(draftInput({ unitId: "12" }));
  assert.equal(allowed.allowed, true);

  await assert.rejects(
    () => service.ensureNoActiveEnrollment(draftInput({ unitId: "13" })),
    (error) => error.code === "ACTIVE_ENROLLMENT_ALREADY_EXISTS",
  );
});

test("invalid responsible-student relationship fails before persistence", async () => {
  const repository = new MultiunitDraftRepository();
  const service = new EnrollmentApplicationService({ enrollmentRepository: repository });

  await assert.rejects(
    () =>
      service.createDraftEnrollmentIdempotently(
        draftInput({ responsibleRelationshipId: "relationship-invalid" }),
      ),
    (error) => error.code === "ENROLLMENT_DRAFT_OWNERSHIP_INVALID",
  );
  assert.equal(repository.records.length, 0);
});
