const assert = require("node:assert/strict");
const test = require("node:test");
const { EnrollmentApplicationService } = require("../services/enrollment-application.service.js");
const {
  STUDENT_ENROLLMENT_ERROR_CODES,
  StudentEnrollmentApplicationService,
} = require("../services/student-enrollment-application.service.js");

test("creates one canonical DRAFT and reuses it sequentially", async () => {
  const fixture = createFixture();
  const first = await fixture.service.resolveStudentAndCreateDraftEnrollment(
    validInput(),
    fixture.context,
  );
  const second = await fixture.service.resolveStudentAndCreateDraftEnrollment(
    validInput("2030-01-01"),
    fixture.context,
  );
  assert.deepEqual(first, {
    enrollmentId: "draft-1",
    enrollmentStatus: "DRAFT",
    personId: "person-1",
    personProfileId: "profile-1",
    resolutions: { enrollment: "CREATED", person: "CREATED", profile: "CREATED" },
    reused: { enrollment: false, person: false, profile: false },
  });
  assert.equal(second.enrollmentId, first.enrollmentId);
  assert.equal(second.resolutions.enrollment, "FOUND");
  assert.equal(second.reused.enrollment, true);
  assert.equal(fixture.repository.records.length, 1);
  assert.equal(fixture.repository.records[0].startDate, "2026-07-18");
  assert.equal(fixture.contexts[0], fixture.context);
  assert.equal("cpf" in first, false);
  assert.equal("studentId" in first, false);
});

test("reuses existing DRAFT without updating or creating", async () => {
  const fixture = createFixture();
  fixture.repository.seed("DRAFT", "existing", "2025-01-01");
  const result = await fixture.service.resolveStudentAndCreateDraftEnrollment(validInput());
  assert.equal(result.enrollmentId, "existing");
  assert.equal(result.reused.enrollment, true);
  assert.equal(fixture.repository.createCalls, 0);
  assert.equal(fixture.repository.records[0].startDate, "2025-01-01");
});

for (const [status, code] of [
  ["ACTIVE", "ENROLLMENT_ACTIVE_EXISTS"],
  ["CONFLICT", "ENROLLMENT_STATE_CONFLICT"],
]) {
  test(`${status} blocks DRAFT creation`, async () => {
    const fixture = createFixture();
    fixture.repository.seed("ACTIVE", "active");
    if (status === "CONFLICT") fixture.repository.seed("DRAFT", "draft");
    await assert.rejects(fixture.service.resolveStudentAndCreateDraftEnrollment(validInput()), {
      code,
    });
    assert.equal(fixture.repository.createCalls, 0);
  });
}

test("student failures stop before Enrollment and preserve canonical error", async () => {
  for (const code of [
    "PERSON_IDENTITY_CONFLICT",
    "STUDENT_PROFILE_CONFLICT",
    "STUDENT_DATA_INCOMPLETE",
    "CPF_INVALID",
  ]) {
    const fixture = createFixture({ studentError: code });
    await assert.rejects(fixture.service.resolveStudentAndCreateDraftEnrollment(validInput()), {
      code,
    });
    assert.equal(fixture.repository.readCalls, 0);
  }
});

test("missing startDate is explicit after student resolution", async () => {
  const fixture = createFixture();
  await assert.rejects(
    fixture.service.resolveStudentAndCreateDraftEnrollment({
      enrollment: {},
      student: validInput().student,
    }),
    (error) =>
      error.code === STUDENT_ENROLLMENT_ERROR_CODES.DATA_INCOMPLETE &&
      error.details.fields[0] === "startDate",
  );
  assert.equal(fixture.studentCalls, 1);
  assert.equal(fixture.repository.readCalls, 0);
});

test("read and write infrastructure failures are sanitized without PII", async () => {
  const read = createFixture({ readError: new Error("CPF 52998224725") });
  await assert.rejects(
    read.service.resolveStudentAndCreateDraftEnrollment(validInput()),
    (error) =>
      error.code === STUDENT_ENROLLMENT_ERROR_CODES.RESOLUTION_FAILED &&
      !error.message.includes("52998224725") &&
      error.details === null,
  );
  const write = createFixture({ createError: new Error("CPF 52998224725") });
  await assert.rejects(
    write.service.resolveStudentAndCreateDraftEnrollment(validInput()),
    (error) =>
      error.code === STUDENT_ENROLLMENT_ERROR_CODES.DRAFT_CREATION_FAILED &&
      !error.message.includes("52998224725") &&
      error.details === null,
  );
});

test("retry after write failure is safe and performs no compensation", async () => {
  const fixture = createFixture({ failOnce: true });
  await assert.rejects(fixture.service.resolveStudentAndCreateDraftEnrollment(validInput()), {
    code: "ENROLLMENT_DRAFT_CREATION_FAILED",
  });
  const result = await fixture.service.resolveStudentAndCreateDraftEnrollment(validInput());
  assert.equal(result.enrollmentId, "draft-1");
  assert.equal(fixture.studentCalls, 2);
  assert.deepEqual(fixture.destructiveCalls, []);
});

test("public exports remain additive", async () => {
  const boundary = require("../../index.js");
  assert.equal(boundary.StudentEnrollmentApplicationService, StudentEnrollmentApplicationService);
  assert.equal(
    typeof boundary.EnrollmentFacade.prototype.resolveStudentAndCreateDraftEnrollment,
    "function",
  );
  assert.equal(typeof boundary.EnrollmentFacade.prototype.confirmDraftEnrollment, "function");
});

function createFixture(options = {}) {
  const repository = new FakeEnrollmentRepository(options);
  const contexts = [];
  const fixture = {
    context: Object.freeze({
      authorization: Object.freeze({ allowed: true }),
      correlationId: "corr-1",
      unitId: "unit-1",
      userId: "user-1",
    }),
    contexts,
    destructiveCalls: [],
    repository,
    studentCalls: 0,
  };
  const studentApplicationService = {
    async resolveOrCreateStudent(student, context) {
      fixture.studentCalls += 1;
      contexts.push(context);
      if (options.studentError) {
        const error = new Error("Canonical student operation rejected.");
        error.code = options.studentError;
        throw error;
      }
      return {
        personId: "person-1",
        personProfileId: "profile-1",
        personResolution: "CREATED",
        profileResolution: "CREATED",
        reused: { person: false, profile: false },
      };
    },
  };
  fixture.service = new StudentEnrollmentApplicationService({
    enrollmentApplicationService: new EnrollmentApplicationService({
      enrollmentRepository: repository,
    }),
    studentApplicationService,
  });
  return fixture;
}

class FakeEnrollmentRepository {
  constructor(options = {}) {
    this.options = options;
    this.records = [];
    this.createCalls = 0;
    this.readCalls = 0;
  }
  seed(status, id, startDate = "2026-07-18") {
    this.records.push({
      id,
      startDate,
      status,
      studentPersonId: "person-1",
      studentProfileId: "profile-1",
    });
  }
  async findDraftByStudent() {
    this.readCalls += 1;
    if (this.options.readError) throw this.options.readError;
    return this.records.find((record) => record.status === "DRAFT") || null;
  }
  async findActiveByStudent() {
    this.readCalls += 1;
    return this.records.find((record) => record.status === "ACTIVE") || null;
  }
  async createDraftIfNotExists(enrollment) {
    this.createCalls += 1;
    if (this.options.createError) throw this.options.createError;
    if (this.options.failOnce) {
      this.options.failOnce = false;
      throw new Error("temporary");
    }
    const existing = this.records.find((record) => record.status === "DRAFT");
    if (existing) return { created: false, enrollment: existing, reused: true };
    const record = { ...enrollment, id: `draft-${this.records.length + 1}` };
    this.records.push(record);
    return { created: true, enrollment: record, reused: false };
  }
  async create(enrollment) {
    return enrollment;
  }
}

function validInput(startDate = "2026-07-18") {
  return {
    enrollment: { startDate },
    student: {
      cpf: "52998224725",
      dataNascimento: "2012-03-04",
      email: "shared@example.test",
      nome: "Aluno",
      sexo: "M",
      telefone: "11999999999",
    },
  };
}
