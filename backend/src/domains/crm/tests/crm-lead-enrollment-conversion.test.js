const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CrmLeadEnrollmentConversionService,
} = require("../application/crm-lead-enrollment-conversion.service.js");

test("converts eligible Lead through A.9 and creates one DRAFT", async () => {
  const fixture = createFixture();
  const result = await fixture.service.convertLeadToDraftEnrollment(input(), fixture.context);
  assert.deepEqual(result, {
    conversionStatus: "COMPLETED",
    enrollmentId: "enrollment-1",
    enrollmentStatus: "DRAFT",
    leadId: "lead-1",
    personId: "person-1",
    personProfileId: "profile-1",
    resolutions: { enrollment: "CREATED", person: "CREATED", profile: "CREATED" },
    reused: { enrollment: false, person: false, profile: false },
  });
  assert.equal(fixture.studentCalls.length, 1);
  assert.equal(fixture.enrollmentCalls.length, 1);
  assert.equal(fixture.studentCalls[0].context, fixture.context);
  assert.equal(fixture.enrollmentCalls[0].context, fixture.context);
  assert.deepEqual(fixture.enrollmentCalls[0].data, {
    personId: "person-1",
    personProfileId: "profile-1",
    startDate: "2026-07-18",
  });
  assert.equal(fixture.repository.records.length, 1);
  assert.equal(JSON.stringify(result).includes("52998224725"), false);
  assert.deepEqual(fixture.destructiveCalls, []);
});

test("completed full conversion returns before A.9 and Enrollment", async () => {
  const fixture = createFixture();
  fixture.repository.records.push(conversion());
  const result = await fixture.service.convertLeadToDraftEnrollment(
    { leadId: "lead-1" },
    fixture.context,
  );
  assert.deepEqual(result.resolutions, { enrollment: "FOUND", person: "FOUND", profile: "FOUND" });
  assert.deepEqual(result.reused, { enrollment: true, person: true, profile: true });
  assert.equal(fixture.studentCalls.length, 0);
  assert.equal(fixture.enrollmentCalls.length, 0);
});

test("partial A.9 conversion is resumed and an existing DRAFT is reused", async () => {
  const fixture = createFixture({
    enrollmentResolution: { resolution: "FOUND", reused: true },
    studentResolution: {
      resolutions: { person: "FOUND", profile: "FOUND" },
      reused: { person: true, profile: true },
    },
  });
  const result = await fixture.service.convertLeadToDraftEnrollment(input(), fixture.context);
  assert.deepEqual(result.resolutions, { enrollment: "FOUND", person: "FOUND", profile: "FOUND" });
  assert.deepEqual(result.reused, { enrollment: true, person: true, profile: true });
  assert.equal(fixture.repository.records[0].enrollmentId, "enrollment-1");
});

test("A.9 eligibility and canonical identity errors are preserved", async () => {
  for (const code of [
    "CRM_LEAD_NOT_FOUND",
    "CRM_LEAD_NOT_CONVERTIBLE",
    "PERSON_IDENTITY_CONFLICT",
    "STUDENT_PROFILE_CONFLICT",
  ]) {
    const fixture = createFixture({ studentError: code });
    await assert.rejects(fixture.service.convertLeadToDraftEnrollment(input(), fixture.context), {
      code,
    });
    assert.equal(fixture.enrollmentCalls.length, 0);
    assert.equal(fixture.repository.records.length, 0);
  }
});

test("ACTIVE and CONFLICT Enrollment states stop before CRM persistence", async () => {
  for (const code of ["ENROLLMENT_ACTIVE_EXISTS", "ENROLLMENT_STATE_CONFLICT"]) {
    const fixture = createFixture({ enrollmentError: code });
    await assert.rejects(fixture.service.convertLeadToDraftEnrollment(input(), fixture.context), {
      code,
    });
    assert.equal(fixture.repository.records.length, 0);
  }
});

test("authorization and strict enrollment input validation run before effects", async () => {
  const denied = createFixture({ authorizeUnit: () => false });
  await assert.rejects(denied.service.convertLeadToDraftEnrollment(input(), denied.context), {
    code: "CRM_ACCESS_DENIED",
  });
  assert.equal(denied.repository.readCalls, 0);
  assert.equal(denied.studentCalls.length, 0);

  for (const invalid of [
    { ...input(), status: "ACTIVE" },
    { ...input(), enrollmentData: { startDate: "2026-07-18", classId: "class-1" } },
    { ...input(), enrollmentData: {} },
  ]) {
    const fixture = createFixture();
    await assert.rejects(fixture.service.convertLeadToDraftEnrollment(invalid, fixture.context), {
      code: invalid.enrollmentData.startDate
        ? "CRM_INPUT_INVALID"
        : "CRM_CONVERSION_DATA_INCOMPLETE",
    });
    assert.equal(fixture.studentCalls.length, 0);
  }
});

test("duplicate compatible full conversion is reused and divergence conflicts", async () => {
  const compatible = createFixture({ duplicate: conversion() });
  const result = await compatible.service.convertLeadToDraftEnrollment(input(), compatible.context);
  assert.equal(result.enrollmentId, "enrollment-1");

  const divergent = createFixture({
    duplicate: conversion({ enrollmentId: "another-enrollment" }),
  });
  await assert.rejects(divergent.service.convertLeadToDraftEnrollment(input(), divergent.context), {
    code: "CRM_LEAD_ENROLLMENT_CONFLICT",
  });
});

test("persistence failure is PII-safe and retry reuses prior work without compensation", async () => {
  const fixture = createFixture({ failOnce: true });
  await assert.rejects(
    fixture.service.convertLeadToDraftEnrollment(input(), fixture.context),
    (error) =>
      error.code === "CRM_LEAD_ENROLLMENT_CONVERSION_FAILED" &&
      !error.message.includes("52998224725") &&
      error.details === null,
  );
  const result = await fixture.service.convertLeadToDraftEnrollment(input(), fixture.context);
  assert.equal(result.enrollmentId, "enrollment-1");
  assert.equal(fixture.studentCalls.length, 2);
  assert.equal(fixture.enrollmentCalls.length, 2);
  assert.deepEqual(fixture.destructiveCalls, []);
});

test("read and Enrollment infrastructure failures are sanitized without PII", async () => {
  const read = createFixture({ readError: new Error("CPF 52998224725") });
  await assert.rejects(
    read.service.convertLeadToDraftEnrollment(input(), read.context),
    (error) =>
      error.code === "CRM_LEAD_ENROLLMENT_CONVERSION_FAILED" &&
      !error.message.includes("52998224725"),
  );
  const enrollment = createFixture({ enrollmentError: null, enrollmentInfrastructureError: true });
  await assert.rejects(
    enrollment.service.convertLeadToDraftEnrollment(input(), enrollment.context),
    (error) =>
      error.code === "CRM_LEAD_ENROLLMENT_CONVERSION_FAILED" &&
      !error.message.includes("52998224725"),
  );
});

function createFixture(options = {}) {
  const repository = new MemoryEnrollmentConversionRepository(options);
  const studentCalls = [];
  const enrollmentCalls = [];
  const fixture = {
    context: Object.freeze({ correlationId: "correlation-1", unitId: "unit-1", userId: "user-1" }),
    destructiveCalls: [],
    enrollmentCalls,
    repository,
    studentCalls,
  };
  fixture.service = new CrmLeadEnrollmentConversionService({
    authorizeUnit: options.authorizeUnit || (() => true),
    enrollmentBoundary: {
      async resolveOrCreateDraftEnrollmentForResolvedStudent(data, context) {
        enrollmentCalls.push({ context, data });
        if (options.enrollmentInfrastructureError) throw new Error("CPF 52998224725");
        if (options.enrollmentError) {
          throw Object.assign(new Error("Enrollment state rejected."), {
            code: options.enrollmentError,
          });
        }
        return {
          enrollmentId: "enrollment-1",
          enrollmentStatus: "DRAFT",
          resolution: "CREATED",
          reused: false,
          ...options.enrollmentResolution,
        };
      },
    },
    enrollmentConversionRepository: repository,
    leadStudentConversionService: {
      async convertLeadToStudent(data, context) {
        studentCalls.push({ context, data });
        if (options.studentError) {
          throw Object.assign(new Error("A.9 rejected conversion."), {
            code: options.studentError,
          });
        }
        return {
          leadId: "lead-1",
          personId: "person-1",
          personProfileId: "profile-1",
          resolutions: { person: "CREATED", profile: "CREATED" },
          reused: { person: false, profile: false },
          ...options.studentResolution,
        };
      },
    },
    now: () => new Date("2026-07-18T22:00:00.000Z"),
  });
  return fixture;
}

class MemoryEnrollmentConversionRepository {
  constructor(options = {}) {
    this.options = options;
    this.readCalls = 0;
    this.records = [];
  }
  async findByLeadId({ leadId, unitId }) {
    this.readCalls += 1;
    if (this.options.readError) throw this.options.readError;
    return (
      this.records.find((record) => record.leadId === leadId && record.unitId === unitId) || null
    );
  }
  async create(data) {
    if (this.options.failOnce) {
      this.options.failOnce = false;
      throw new Error("database payload CPF 52998224725");
    }
    if (this.options.duplicate) {
      return { conversion: this.options.duplicate, created: false, reused: true };
    }
    const record = conversion(data);
    this.records.push(record);
    return { conversion: record, created: true, reused: false };
  }
}

function input() {
  return {
    enrollmentData: { startDate: "2026-07-18" },
    idempotencyKey: "request-lead-1",
    leadId: "lead-1",
    studentData: {
      cpf: "52998224725",
      dataNascimento: "2012-03-04",
      nome: "Aluno",
      sexo: "M",
    },
  };
}

function conversion(overrides = {}) {
  return {
    convertedAt: "2026-07-18T22:00:00.000Z",
    convertedBy: "user-1",
    enrollmentId: "enrollment-1",
    enrollmentStatus: "DRAFT",
    id: "conversion-1",
    idempotencyKey: "request-lead-1",
    leadId: "lead-1",
    personId: "person-1",
    personProfileId: "profile-1",
    status: "COMPLETED",
    unitId: "unit-1",
    ...overrides,
  };
}
