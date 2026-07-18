const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CrmLeadStudentConversionService,
} = require("../application/crm-lead-student-conversion.service.js");

test("WON Lead converts explicit student data and records canonical ids", async () => {
  const fixture = createFixture();
  const result = await fixture.service.convertLeadToStudent(input(), fixture.context);
  assert.deepEqual(result, {
    conversionStatus: "COMPLETED",
    leadId: "lead-1",
    personId: "person-1",
    personProfileId: "profile-1",
    resolutions: { person: "CREATED", profile: "CREATED" },
    reused: { person: false, profile: false },
  });
  assert.equal(fixture.studentCalls.length, 1);
  assert.deepEqual(fixture.studentCalls[0].data, input().studentData);
  assert.equal(fixture.studentCalls[0].context, fixture.context);
  assert.equal(fixture.conversionRepository.records.length, 1);
  assert.equal(JSON.stringify(result).includes("52998224725"), false);
  assert.equal("studentId" in result, false);
  assert.equal("enrollmentId" in result, false);
  assert.deepEqual(fixture.effects, []);
});

test("missing, open and LOST Leads are blocked before Pessoa", async () => {
  const missing = createFixture({ lead: null });
  await assert.rejects(missing.service.convertLeadToStudent(input(), missing.context), {
    code: "CRM_LEAD_NOT_FOUND",
  });
  for (const lead of [
    { stage: "NEW", status: "OPEN" },
    { stage: "LOST", status: "LOST" },
  ]) {
    const fixture = createFixture({ lead });
    await assert.rejects(fixture.service.convertLeadToStudent(input(), fixture.context), {
      code: "CRM_LEAD_NOT_CONVERTIBLE",
    });
    assert.equal(fixture.studentCalls.length, 0);
  }
});

test("unit mismatch and authorization denial are blocked", async () => {
  const mismatch = createFixture({ authorizeUnit: (_context, unitId) => unitId === "unit-2" });
  await assert.rejects(mismatch.service.convertLeadToStudent(input(), mismatch.context), {
    code: "CRM_ACCESS_DENIED",
  });
  const noUser = createFixture();
  await assert.rejects(noUser.service.convertLeadToStudent(input(), { unitId: "unit-1" }), {
    code: "CRM_ACCESS_DENIED",
  });
});

test("ambiguous Lead contact is never copied into student data", async () => {
  const fixture = createFixture({
    lead: {
      contactName: "Responsavel",
      contactEmail: "responsavel@example.test",
      contactPhone: "11999999999",
    },
  });
  await assert.rejects(
    fixture.service.convertLeadToStudent({ leadId: "lead-1", studentData: {} }, fixture.context),
    (error) =>
      error.code === "CRM_CONVERSION_DATA_INCOMPLETE" &&
      error.details.fields.join(",") ===
        "studentData.nome,studentData.dataNascimento,studentData.sexo",
  );
  assert.equal(fixture.studentCalls.length, 0);
});

test("personId is sufficient and arbitrary fields are rejected", async () => {
  const fixture = createFixture();
  await fixture.service.convertLeadToStudent(
    { leadId: "lead-1", studentData: { personId: "known-person" } },
    fixture.context,
  );
  assert.deepEqual(fixture.studentCalls[0].data, { personId: "known-person" });
  const invalid = createFixture();
  await assert.rejects(
    invalid.service.convertLeadToStudent(
      { leadId: "lead-1", studentData: { inventedBirthDate: "2000-01-01" } },
      invalid.context,
    ),
    (error) =>
      error.code === "CRM_INPUT_INVALID" &&
      error.details.fields[0] === "studentData.inventedBirthDate",
  );
});

test("CPF-less explicit student remains allowed and contacts are only forwarded", async () => {
  const fixture = createFixture();
  const studentData = {
    nome: "Aluno",
    dataNascimento: "2012-03-04",
    sexo: "M",
    cpf: null,
    email: "shared@example.test",
    telefone: "11999999999",
  };
  await fixture.service.convertLeadToStudent({ leadId: "lead-1", studentData }, fixture.context);
  assert.deepEqual(fixture.studentCalls[0].data, studentData);
});

test("canonical Pessoa/Profile errors stop conversion without sanitizing their codes", async () => {
  for (const code of [
    "PERSON_CPF_INVALID",
    "PERSON_IDENTITY_CONFLICT",
    "STUDENT_PROFILE_CONFLICT",
    "STUDENT_DATA_INCOMPLETE",
  ]) {
    const fixture = createFixture({ studentError: code });
    await assert.rejects(fixture.service.convertLeadToStudent(input(), fixture.context), { code });
    assert.equal(fixture.conversionRepository.records.length, 0);
  }
});

test("completed conversion is idempotent and skips student resolution", async () => {
  const fixture = createFixture();
  fixture.conversionRepository.records.push(conversion());
  const result = await fixture.service.convertLeadToStudent({ leadId: "lead-1" }, fixture.context);
  assert.equal(result.personId, "person-1");
  assert.deepEqual(result.resolutions, { person: "FOUND", profile: "FOUND" });
  assert.deepEqual(result.reused, { person: true, profile: true });
  assert.equal(fixture.studentCalls.length, 0);
  assert.equal(fixture.conversionRepository.records.length, 1);
});

test("duplicate compatible conversion is reused and divergent duplicate conflicts", async () => {
  const compatible = createFixture({ duplicate: conversion() });
  const result = await compatible.service.convertLeadToStudent(input(), compatible.context);
  assert.equal(result.personId, "person-1");
  const divergent = createFixture({ duplicate: conversion({ personId: "other-person" }) });
  await assert.rejects(divergent.service.convertLeadToStudent(input(), divergent.context), {
    code: "CRM_LEAD_STUDENT_CONVERSION_CONFLICT",
  });
});

test("persistence failure is PII-safe and retry reuses Pessoa/Profile without compensation", async () => {
  const fixture = createFixture({
    failOnce: true,
    studentResolution: {
      personResolution: "FOUND",
      profileResolution: "FOUND",
      reused: { person: true, profile: true },
    },
  });
  await assert.rejects(
    fixture.service.convertLeadToStudent(input(), fixture.context),
    (error) =>
      error.code === "CRM_LEAD_STUDENT_CONVERSION_FAILED" && !error.message.includes("52998224725"),
  );
  const result = await fixture.service.convertLeadToStudent(input(), fixture.context);
  assert.equal(result.personId, "person-1");
  assert.equal(fixture.studentCalls.length, 2);
  assert.deepEqual(fixture.destructiveCalls, []);
});

function createFixture(options = {}) {
  const lead =
    options.lead === null
      ? null
      : {
          id: "lead-1",
          unitId: "unit-1",
          stage: "WON",
          status: "CONVERTED",
          contactName: "Contato comercial",
          ...options.lead,
        };
  const studentCalls = [];
  const conversionRepository = new MemoryConversionRepository(options);
  const fixture = {
    context: Object.freeze({ correlationId: "correlation-1", unitId: "unit-1", userId: "user-1" }),
    conversionRepository,
    destructiveCalls: [],
    effects: [],
    studentCalls,
  };
  fixture.service = new CrmLeadStudentConversionService({
    authorizeUnit: options.authorizeUnit || (() => true),
    conversionRepository,
    leadRepository: {
      async findById({ id, unitId }) {
        return lead && lead.id === id && lead.unitId === unitId ? lead : null;
      },
    },
    now: () => new Date("2026-07-18T20:00:00.000Z"),
    studentApplicationService: {
      async resolveOrCreateStudent(data, context) {
        studentCalls.push({ context, data });
        if (options.studentError)
          throw Object.assign(new Error("canonical failure"), { code: options.studentError });
        return {
          personId: "person-1",
          personProfileId: "profile-1",
          personResolution: "CREATED",
          profileResolution: "CREATED",
          reused: { person: false, profile: false },
          ...options.studentResolution,
        };
      },
    },
  });
  return fixture;
}

class MemoryConversionRepository {
  constructor(options = {}) {
    this.options = options;
    this.records = [];
  }
  async findByLeadId({ leadId, unitId }) {
    return (
      this.records.find((record) => record.leadId === leadId && record.unitId === unitId) || null
    );
  }
  async create(input) {
    if (this.options.failOnce) {
      this.options.failOnce = false;
      throw new Error("database payload CPF 52998224725");
    }
    if (this.options.duplicate) {
      return { conversion: this.options.duplicate, created: false, reused: true };
    }
    const existing = await this.findByLeadId(input);
    if (existing) return { conversion: existing, created: false, reused: true };
    const record = conversion(input);
    this.records.push(record);
    return { conversion: record, created: true, reused: false };
  }
}

function input() {
  return {
    leadId: "lead-1",
    studentData: { cpf: "52998224725", nome: "Aluno", dataNascimento: "2012-03-04", sexo: "M" },
  };
}

function conversion(overrides = {}) {
  return {
    id: "conversion-1",
    leadId: "lead-1",
    unitId: "unit-1",
    personId: "person-1",
    personProfileId: "profile-1",
    status: "COMPLETED",
    convertedBy: "user-1",
    convertedAt: "2026-07-18T20:00:00.000Z",
    idempotencyKey: "crm-lead-student:lead-1",
    ...overrides,
  };
}
