const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ACTIVE_ENROLLMENT_ALREADY_EXISTS_CODE,
  CONFIRM_DRAFT_ENROLLMENT_UNIT_CONTEXT_REQUIRED_CODE,
  ENROLLMENT_PROCEED_BLOCKED_CODE,
  ENROLLMENT_PROCEED_CONFLICT_CODE,
  ENROLLMENT_SEARCH_UNIT_CONTEXT_REQUIRED_CODE,
  EnrollmentApplicationService,
} = require("../services/enrollment-application.service.js");

test("EnrollmentApplicationService creates and reuses a persisted DRAFT in memory", async () => {
  const repository = new FakeEnrollmentRepository();
  const service = new EnrollmentApplicationService({ enrollmentRepository: repository });

  const first = await service.createDraftEnrollmentIdempotently({
    id: "draft-1",
    responsiblePersonId: "responsible-person-1",
    responsibleProfileId: "responsible-profile-1",
    responsibleRelationshipId: "relationship-1",
    startDate: "2026-06-30",
    studentPersonId: "person-1",
    studentProfileId: "profile-1",
    unitId: "1",
  });
  const second = await service.createDraftEnrollmentIdempotently({
    id: "draft-2",
    responsiblePersonId: "responsible-person-1",
    responsibleProfileId: "responsible-profile-1",
    responsibleRelationshipId: "relationship-1",
    startDate: "2026-06-30",
    studentPersonId: "person-1",
    studentProfileId: "profile-1",
    unitId: "1",
  });

  assert.equal(first.created, true);
  assert.equal(first.reused, false);
  assert.equal(first.draftEnrollment.id, "draft-1");
  assert.equal(second.created, false);
  assert.equal(second.reused, true);
  assert.equal(second.draftEnrollment.id, "draft-1");
  assert.equal(repository.records.size, 1);
});

test("EnrollmentApplicationService reads current DRAFT and ACTIVE enrollments", async () => {
  const repository = new FakeEnrollmentRepository();
  repository.seed({
    id: "draft-read",
    startDate: "2026-06-30",
    status: "DRAFT",
    studentPersonId: "person-2",
    studentProfileId: "profile-2",
  });
  repository.seed({
    id: "active-read",
    startDate: "2026-06-30",
    status: "ACTIVE",
    studentPersonId: "person-3",
    studentProfileId: "profile-3",
  });
  const service = new EnrollmentApplicationService({ enrollmentRepository: repository });

  const draft = await service.findCurrentDraftEnrollment({
    studentPersonId: "person-2",
    studentProfileId: "profile-2",
    unitId: "1",
  });
  const active = await service.findCurrentActiveEnrollment({
    studentPersonId: "person-3",
    studentProfileId: "profile-3",
    unitId: "1",
  });
  const invalid = await service.findCurrentDraftEnrollment({
    studentPersonId: "",
    studentProfileId: "profile-2",
    unitId: "1",
  });

  assert.equal(draft.id, "draft-read");
  assert.equal(active.id, "active-read");
  assert.equal(invalid, null);
});

test("EnrollmentApplicationService reads Enrollment by id for internal integrations", async () => {
  const repository = new FakeEnrollmentRepository();
  repository.seed({
    id: "enrollment-by-id",
    startDate: "2026-06-30",
    status: "ACTIVE",
    studentPersonId: "person-by-id",
    studentProfileId: "profile-by-id",
  });
  const service = new EnrollmentApplicationService({ enrollmentRepository: repository });

  const found = await service.findEnrollmentById("enrollment-by-id");
  const missing = await service.findEnrollmentById("missing-by-id");
  const invalid = await service.findEnrollmentById("");

  assert.equal(found.id, "enrollment-by-id");
  assert.equal(missing, null);
  assert.equal(invalid, null);
});

test("EnrollmentApplicationService confirms DRAFT to ACTIVE with audit metadata", async () => {
  const repository = new FakeEnrollmentRepository();
  repository.seed({
    id: "draft-confirm",
    startDate: "2026-06-30",
    status: "DRAFT",
    studentPersonId: "person-4",
    studentProfileId: "profile-4",
  });
  const service = new EnrollmentApplicationService({ enrollmentRepository: repository });

  const result = await service.confirmDraftEnrollment(
    {
      confirmedAt: "2026-06-30T10:15:30.000Z",
      confirmedBy: "admin@j12.local",
      enrollmentId: "draft-confirm",
    },
    { unitId: "1" },
  );

  assert.equal(result.confirmed, true);
  assert.equal(result.alreadyConfirmed, false);
  assert.equal(result.status, "ACTIVE");
  assert.equal(result.enrollment.status, "ACTIVE");
  assert.equal(result.enrollment.unitId, "1");
  assert.equal(result.confirmedAt, "2026-06-30 10:15:30");
  assert.equal(result.confirmedBy, "admin@j12.local");
  assert.deepEqual(repository.updateCalls, [
    {
      id: "draft-confirm",
      options: {
        confirmedAt: "2026-06-30 10:15:30",
        confirmedBy: "admin@j12.local",
        expectedStatus: "DRAFT",
        unitId: "1",
      },
      status: "ACTIVE",
    },
  ]);
});

test("EnrollmentApplicationService blocks confirmation when ACTIVE already exists", async () => {
  const repository = new FakeEnrollmentRepository();
  repository.seed({
    id: "draft-blocked",
    startDate: "2026-06-30",
    status: "DRAFT",
    studentPersonId: "person-5",
    studentProfileId: "profile-5",
  });
  repository.seed({
    id: "active-blocking",
    startDate: "2026-06-30",
    status: "ACTIVE",
    studentPersonId: "person-5",
    studentProfileId: "profile-5",
  });
  const service = new EnrollmentApplicationService({ enrollmentRepository: repository });

  await assert.rejects(
    () => service.confirmDraftEnrollment({ enrollmentId: "draft-blocked" }, { unitId: "1" }),
    {
      code: ACTIVE_ENROLLMENT_ALREADY_EXISTS_CODE,
    },
  );
  assert.equal(repository.updateCalls.length, 0);
});

test("EnrollmentApplicationService blocks confirmation without persisted unit ownership", async () => {
  const repository = new FakeEnrollmentRepository();
  repository.seed({
    id: "legacy-draft",
    startDate: "2026-06-30",
    status: "DRAFT",
    studentPersonId: "legacy-person",
    studentProfileId: "legacy-profile",
    unitId: null,
  });
  const service = new EnrollmentApplicationService({ enrollmentRepository: repository });

  await assert.rejects(
    () => service.confirmDraftEnrollment({ enrollmentId: "legacy-draft" }, { unitId: "1" }),
    {
      code: "ENROLLMENT_UNIT_OWNERSHIP_CONFLICT",
    },
  );
  assert.equal(repository.updateCalls.length, 0);
});

test("EnrollmentApplicationService rejects confirmation without trusted unit before repository reads", async () => {
  let reads = 0;
  const service = new EnrollmentApplicationService({
    enrollmentRepository: {
      async findById() {
        reads += 1;
        return null;
      },
    },
  });

  await assert.rejects(
    () => service.confirmDraftEnrollment({ enrollmentId: "draft-without-context" }),
    {
      code: CONFIRM_DRAFT_ENROLLMENT_UNIT_CONTEXT_REQUIRED_CODE,
      statusCode: 403,
    },
  );
  assert.equal(reads, 0);
});

test("EnrollmentApplicationService rejects confirmation from another trusted unit", async () => {
  const repository = new FakeEnrollmentRepository();
  repository.seed({
    id: "draft-other-unit",
    startDate: "2026-06-30",
    status: "DRAFT",
    studentPersonId: "person-other-unit",
    studentProfileId: "profile-other-unit",
    unitId: "1",
  });
  const service = new EnrollmentApplicationService({ enrollmentRepository: repository });

  await assert.rejects(
    () => service.confirmDraftEnrollment({ enrollmentId: "draft-other-unit" }, { unitId: "2" }),
    {
      code: "ENROLLMENT_UNIT_OWNERSHIP_CONFLICT",
      statusCode: 404,
    },
  );
  assert.equal(repository.updateCalls.length, 0);
});

test("EnrollmentApplicationService summarizes NONE, DRAFT, ACTIVE and CONFLICT statuses", async () => {
  const noneService = new EnrollmentApplicationService({
    enrollmentRepository: new FakeEnrollmentRepository(),
  });
  assert.equal(
    (
      await noneService.getEnrollmentStatusSummary({
        studentPersonId: "person-none",
        studentProfileId: "profile-none",
        unitId: "1",
      })
    ).status,
    "NONE",
  );

  const draftRepository = new FakeEnrollmentRepository();
  draftRepository.seed({
    id: "draft-summary",
    startDate: "2026-06-30",
    status: "DRAFT",
    studentPersonId: "person-draft",
    studentProfileId: "profile-draft",
  });
  const draftService = new EnrollmentApplicationService({ enrollmentRepository: draftRepository });
  assert.equal(
    (
      await draftService.getEnrollmentStatusSummary({
        studentPersonId: "person-draft",
        studentProfileId: "profile-draft",
        unitId: "1",
      })
    ).status,
    "DRAFT",
  );

  const activeRepository = new FakeEnrollmentRepository();
  activeRepository.seed({
    id: "active-summary",
    startDate: "2026-06-30",
    status: "ACTIVE",
    studentPersonId: "person-active",
    studentProfileId: "profile-active",
  });
  const activeService = new EnrollmentApplicationService({
    enrollmentRepository: activeRepository,
  });
  assert.equal(
    (
      await activeService.getEnrollmentStatusSummary({
        studentPersonId: "person-active",
        studentProfileId: "profile-active",
        unitId: "1",
      })
    ).status,
    "ACTIVE",
  );

  const conflictRepository = new FakeEnrollmentRepository();
  conflictRepository.seed({
    id: "draft-conflict",
    startDate: "2026-06-30",
    status: "DRAFT",
    studentPersonId: "person-conflict",
    studentProfileId: "profile-conflict",
  });
  conflictRepository.seed({
    id: "active-conflict",
    startDate: "2026-06-30",
    status: "ACTIVE",
    studentPersonId: "person-conflict",
    studentProfileId: "profile-conflict",
  });
  const conflictService = new EnrollmentApplicationService({
    enrollmentRepository: conflictRepository,
  });
  assert.equal(
    (
      await conflictService.getEnrollmentStatusSummary({
        studentPersonId: "person-conflict",
        studentProfileId: "profile-conflict",
        unitId: "1",
      })
    ).status,
    "CONFLICT",
  );
});

test("EnrollmentApplicationService searches student scopes through repository", async () => {
  const repository = new FakeEnrollmentRepository();
  const service = new EnrollmentApplicationService({ enrollmentRepository: repository });

  repository.studentScopes = [
    {
      status: "DRAFT",
      studentName: "Aluno Teste",
      studentPersonId: "person-search",
      studentProfileId: "profile-search",
    },
  ];

  const shortSearch = await service.searchStudentScopes({ query: "a" });
  const results = await service.searchStudentScopes({
    limit: 999,
    query: "Aluno",
    unitId: "1",
  });

  assert.deepEqual(shortSearch, []);
  assert.deepEqual(results, repository.studentScopes);
  assert.deepEqual(repository.searchCalls, [
    {
      limit: 25,
      query: "Aluno",
      unitId: "1",
    },
  ]);
});

test("EnrollmentApplicationService fails closed when search has no trusted unit", async () => {
  const repository = new FakeEnrollmentRepository();
  const service = new EnrollmentApplicationService({ enrollmentRepository: repository });

  await assert.rejects(() => service.searchStudentScopes({ query: "Aluno" }), {
    code: ENROLLMENT_SEARCH_UNIT_CONTEXT_REQUIRED_CODE,
    statusCode: 403,
  });
  assert.deepEqual(repository.searchCalls, []);
});

test("EnrollmentApplicationService guards allowed, ACTIVE blocked and CONFLICT blocked states", async () => {
  const draftRepository = new FakeEnrollmentRepository();
  draftRepository.seed({
    id: "draft-guard",
    startDate: "2026-06-30",
    status: "DRAFT",
    studentPersonId: "person-guard-draft",
    studentProfileId: "profile-guard-draft",
  });
  const draftService = new EnrollmentApplicationService({ enrollmentRepository: draftRepository });
  const allowed = await draftService.ensureEnrollmentCanProceed({
    studentPersonId: "person-guard-draft",
    studentProfileId: "profile-guard-draft",
    unitId: "1",
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.status, "DRAFT");

  const activeRepository = new FakeEnrollmentRepository();
  activeRepository.seed({
    id: "active-guard",
    startDate: "2026-06-30",
    status: "ACTIVE",
    studentPersonId: "person-guard-active",
    studentProfileId: "profile-guard-active",
  });
  const activeService = new EnrollmentApplicationService({
    enrollmentRepository: activeRepository,
  });
  await assert.rejects(
    () =>
      activeService.ensureEnrollmentCanProceed({
        studentPersonId: "person-guard-active",
        studentProfileId: "profile-guard-active",
        unitId: "1",
      }),
    { code: ENROLLMENT_PROCEED_BLOCKED_CODE },
  );

  const conflictRepository = new FakeEnrollmentRepository();
  conflictRepository.seed({
    id: "draft-guard-conflict",
    startDate: "2026-06-30",
    status: "DRAFT",
    studentPersonId: "person-guard-conflict",
    studentProfileId: "profile-guard-conflict",
  });
  conflictRepository.seed({
    id: "active-guard-conflict",
    startDate: "2026-06-30",
    status: "ACTIVE",
    studentPersonId: "person-guard-conflict",
    studentProfileId: "profile-guard-conflict",
  });
  const conflictService = new EnrollmentApplicationService({
    enrollmentRepository: conflictRepository,
  });
  await assert.rejects(
    () =>
      conflictService.ensureEnrollmentCanProceed({
        allowedStatuses: ["NONE", "DRAFT", "ACTIVE", "CONFLICT"],
        studentPersonId: "person-guard-conflict",
        studentProfileId: "profile-guard-conflict",
        unitId: "1",
      }),
    { code: ENROLLMENT_PROCEED_CONFLICT_CODE },
  );
});

test("confirmation race returns alreadyConfirmed when conditional update loses", async () => {
  const current = {
    id: "draft-race",
    startDate: "2026-06-30",
    status: "DRAFT",
    studentPersonId: "person-race",
    studentProfileId: "profile-race",
    unitId: "1",
  };
  const repository = {
    async findActiveByStudent() {
      return null;
    },
    async findById() {
      return current;
    },
    async updateStatus() {
      return { ...current, status: "ACTIVE", transitionChanged: false };
    },
  };
  const service = new EnrollmentApplicationService({ enrollmentRepository: repository });

  const result = await service.confirmDraftEnrollment(
    { enrollmentId: "draft-race" },
    { unitId: "1" },
  );

  assert.equal(result.confirmed, false);
  assert.equal(result.alreadyConfirmed, true);
  assert.equal(result.status, "ACTIVE");
});

class FakeEnrollmentRepository {
  constructor() {
    this.records = new Map();
    this.searchCalls = [];
    this.studentScopes = [];
    this.updateCalls = [];
  }

  seed(record) {
    this.records.set(record.id, { unitId: "1", ...record });
    return this.records.get(record.id);
  }

  async create(enrollment) {
    const record = { ...enrollment };
    this.records.set(record.id, record);
    return record;
  }

  async createDraftIfNotExists(enrollment) {
    const existing = await this.findDraftByStudent({
      studentPersonId: enrollment.studentPersonId,
      studentProfileId: enrollment.studentProfileId,
      unitId: enrollment.unitId,
    });

    if (existing) {
      return {
        created: false,
        enrollment: existing,
        reused: true,
      };
    }

    const record = {
      ...enrollment,
      id: enrollment.id || `draft-${this.records.size + 1}`,
    };
    this.records.set(record.id, record);

    return {
      created: true,
      enrollment: record,
      reused: false,
    };
  }

  async findDraftByStudent(input) {
    return this.findByStudentAndStatus(input, "DRAFT");
  }

  async findActiveByStudent(input) {
    return this.findByStudentAndStatus(input, "ACTIVE");
  }

  async findById(id) {
    return this.records.get(id) || null;
  }

  async updateStatus(id, status, options = {}) {
    const current = this.records.get(id);

    if (!current) {
      return null;
    }

    const next = {
      ...current,
      confirmedAt: options.confirmedAt ?? current.confirmedAt ?? null,
      confirmedBy: options.confirmedBy ?? current.confirmedBy ?? null,
      status,
    };
    this.records.set(id, next);
    this.updateCalls.push({
      id,
      options: { ...options },
      status,
    });

    return next;
  }

  async searchStudentScopes(input) {
    this.searchCalls.push({ ...input });
    return this.studentScopes;
  }

  findByStudentAndStatus(input, status) {
    return (
      [...this.records.values()].find((record) => {
        return (
          record.status === status &&
          record.studentPersonId === input.studentPersonId &&
          record.studentProfileId === input.studentProfileId &&
          record.unitId === input.unitId
        );
      }) || null
    );
  }
}
