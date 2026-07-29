const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_UNIT_OWNERSHIP_CONFLICT_CODE,
  EnrollmentApplicationService,
} = require("../services/enrollment-application.service.js");

function draftInput(overrides = {}) {
  return {
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
  const existing = { id: "enrollment-1", unitId: "12" };
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
  const existing = { id: "enrollment-1", unitId: "12" };
  const service = new EnrollmentApplicationService({
    enrollmentRepository: {
      async create() {
        throw new Error("create must not be called");
      },
      async findDraftByStudent(input) {
        assert.deepEqual(input, {
          studentPersonId: "person-1",
          studentProfileId: "profile-1",
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
