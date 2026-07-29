const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ACTIVE_ENROLLMENT_ALREADY_EXISTS_CODE,
  ENROLLMENT_DRAFT_OWNERSHIP_INVALID_CODE,
  ENROLLMENT_OPEN_DRAFT_ACTOR_CONTEXT_REQUIRED_CODE,
  ENROLLMENT_OPEN_DRAFT_INPUT_INVALID_CODE,
  EnrollmentApplicationService,
} = require("../services/enrollment-application.service.js");

const COMMAND = Object.freeze({
  responsiblePersonId: "person-responsible",
  startDate: "2026-08-01",
  studentPersonId: "person-student",
});
const ACTOR_CONTEXT = Object.freeze({ unitContext: Object.freeze({ unitId: "12" }) });

test("openDraftEnrollment opens a canonical DRAFT and returns only its public projection", async () => {
  const repository = new OpeningRepository();
  const result = await service(repository).openDraftEnrollment(COMMAND, ACTOR_CONTEXT);

  assert.deepEqual(result, {
    created: true,
    enrollmentId: "draft-1",
    reused: false,
    startDate: "2026-08-01",
    status: "DRAFT",
  });
  assert.deepEqual(repository.ownershipCalls, [
    {
      responsiblePersonId: "person-responsible",
      studentPersonId: "person-student",
      unitId: "12",
    },
  ]);
  assert.equal(JSON.stringify(result).includes("unitId"), false);
  assert.equal(JSON.stringify(result).includes("responsibleProfileId"), false);
});

test("openDraftEnrollment is idempotent and returns the same persisted DRAFT", async () => {
  const repository = new OpeningRepository();
  const application = service(repository);
  const first = await application.openDraftEnrollment(COMMAND, ACTOR_CONTEXT);
  const second = await application.openDraftEnrollment(COMMAND, ACTOR_CONTEXT);

  assert.equal(first.enrollmentId, second.enrollmentId);
  assert.equal(second.created, false);
  assert.equal(second.reused, true);
  assert.equal(repository.createCalls, 1);
});

test("openDraftEnrollment blocks an existing ACTIVE Enrollment", async () => {
  const repository = new OpeningRepository({ active: true });
  await assert.rejects(() => service(repository).openDraftEnrollment(COMMAND, ACTOR_CONTEXT), {
    code: ACTIVE_ENROLLMENT_ALREADY_EXISTS_CODE,
    statusCode: 409,
  });
  assert.equal(repository.createCalls, 0);
});

test("openDraftEnrollment rejects invalid canonical ownership", async () => {
  const repository = new OpeningRepository({ invalidOwnership: true });
  await assert.rejects(() => service(repository).openDraftEnrollment(COMMAND, ACTOR_CONTEXT), {
    code: ENROLLMENT_DRAFT_OWNERSHIP_INVALID_CODE,
    statusCode: 422,
  });
  assert.equal(repository.createCalls, 0);
});

test("openDraftEnrollment requires ActorContext unit ownership", async () => {
  const repository = new OpeningRepository();
  await assert.rejects(() => service(repository).openDraftEnrollment(COMMAND, {}), {
    code: ENROLLMENT_OPEN_DRAFT_ACTOR_CONTEXT_REQUIRED_CODE,
    statusCode: 403,
  });
  assert.equal(repository.ownershipCalls.length, 0);
});

test("openDraftEnrollment refuses unitId and internal fields in the application command", async () => {
  const repository = new OpeningRepository();
  await assert.rejects(
    () =>
      service(repository).openDraftEnrollment(
        { ...COMMAND, status: "ACTIVE", unitId: "999" },
        ACTOR_CONTEXT,
      ),
    { code: ENROLLMENT_OPEN_DRAFT_INPUT_INVALID_CODE },
  );
  assert.equal(repository.ownershipCalls.length, 0);
});

function service(repository) {
  return new EnrollmentApplicationService({ enrollmentRepository: repository });
}

class OpeningRepository {
  constructor({ active = false, invalidOwnership = false } = {}) {
    this.active = active;
    this.invalidOwnership = invalidOwnership;
    this.draft = null;
    this.createCalls = 0;
    this.ownershipCalls = [];
  }

  async resolveDraftOpeningOwnership(input) {
    this.ownershipCalls.push({ ...input });
    if (this.invalidOwnership) {
      const error = new Error("invalid ownership");
      error.code = ENROLLMENT_DRAFT_OWNERSHIP_INVALID_CODE;
      throw error;
    }
    return {
      responsiblePersonId: input.responsiblePersonId,
      responsibleProfileId: "profile-responsible",
      responsibleRelationshipId: "relationship-1",
      studentPersonId: input.studentPersonId,
      studentProfileId: "profile-student",
      unitId: input.unitId,
    };
  }

  async findDraftByStudent() {
    return this.draft;
  }

  async findActiveByStudent(input) {
    return this.active ? { id: "active-1", status: "ACTIVE", ...this.ownership(input) } : null;
  }

  async validateDraftOwnership() {}

  async create() {
    throw new Error("create bypass must not be used");
  }

  async createDraftIfNotExists(enrollment) {
    this.createCalls += 1;
    this.draft = { ...enrollment.toJSON(), id: "draft-1" };
    return { created: true, enrollment: this.draft, reused: false };
  }

  ownership(input) {
    return {
      studentPersonId: input.studentPersonId,
      studentProfileId: input.studentProfileId,
      unitId: input.unitId,
    };
  }
}
