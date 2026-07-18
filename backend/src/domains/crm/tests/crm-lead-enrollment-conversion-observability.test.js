const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CrmLeadEnrollmentConversionObservabilityDecorator,
} = require("../application/crm-lead-enrollment-conversion-observability.decorator.js");

function auditSpy({ fail = false } = {}) {
  const calls = [];
  const audit = {
    calls,
    async recordStart(input) {
      if (fail) throw new Error("audit unavailable");
      calls.push({ method: "recordStart", input });
    },
    async recordSuccess(input) {
      if (fail) throw new Error("audit unavailable");
      calls.push({ method: "recordSuccess", input });
    },
    async recordFailure(input) {
      if (fail) throw new Error("audit unavailable");
      calls.push({ method: "recordFailure", input });
    },
  };
  return audit;
}

const context = Object.freeze({
  correlationId: "corr-1",
  unitId: "unit-1",
  userId: "user-1",
});

const input = Object.freeze({
  enrollmentData: { startDate: "2026-07-18" },
  idempotencyKey: "request-secret",
  leadId: "lead-1",
  studentData: {
    cpf: "52998224725",
    dataNascimento: "2012-03-04",
    email: "aluno@example.com",
    nome: "Aluno",
    sexo: "M",
    telefone: "+55 11 99999-9999",
  },
});

const result = Object.freeze({
  conversionStatus: "COMPLETED",
  enrollmentId: "enrollment-1",
  enrollmentStatus: "DRAFT",
  leadId: "lead-1",
  personId: "person-1",
  personProfileId: "profile-1",
  resolutions: { enrollment: "CREATED", person: "CREATED", profile: "CREATED" },
  reused: { enrollment: false, person: false, profile: false },
});

test("observability decorator preserves success result and records safe start/success metadata", async () => {
  const audit = auditSpy();
  const service = new CrmLeadEnrollmentConversionObservabilityDecorator({
    auditService: audit,
    conversionService: { convertLeadToDraftEnrollment: async () => result },
    now: (() => {
      const values = [0n, 8_500_000n];
      return () => values.shift();
    })(),
  });

  const returned = await service.convertLeadToDraftEnrollment(input, context);
  assert.equal(returned, result);
  assert.deepEqual(
    audit.calls.map((call) => call.method),
    ["recordStart", "recordSuccess"],
  );
  assert.equal(audit.calls[0].input.correlationId, "corr-1");
  assert.equal(audit.calls[0].input.unitId, "unit-1");
  assert.equal(audit.calls[0].input.userId, "user-1");
  assert.equal(audit.calls[0].input.leadId, "lead-1");
  assert.equal(audit.calls[0].input.idempotencyKeyFingerprint.length, 64);
  assert.equal(audit.calls[1].input.durationMs, 8);
  assert.equal(audit.calls[1].input.personId, "person-1");
  assert.equal(audit.calls[1].input.enrollmentStatus, "DRAFT");
  assert.equal("cpf" in audit.calls[0].input, false);
  assert.equal("email" in audit.calls[0].input, false);
  assert.equal("studentData" in audit.calls[0].input, false);
});

test("observability decorator records sanitized failure and rethrows the original error", async () => {
  const audit = auditSpy();
  const original = Object.assign(new Error("business failure"), {
    code: "PERSON_IDENTITY_CONFLICT",
    expose: true,
    statusCode: 409,
  });
  const service = new CrmLeadEnrollmentConversionObservabilityDecorator({
    auditService: audit,
    conversionService: {
      convertLeadToDraftEnrollment: async () => {
        throw original;
      },
    },
    now: (() => {
      const values = [10n, 15_500_000n];
      return () => values.shift();
    })(),
  });

  await assert.rejects(
    service.convertLeadToDraftEnrollment(input, context),
    (error) => error === original,
  );
  assert.deepEqual(
    audit.calls.map((call) => call.method),
    ["recordStart", "recordFailure"],
  );
  assert.equal(audit.calls[1].input.errorCode, "PERSON_IDENTITY_CONFLICT");
  assert.equal(audit.calls[1].input.errorCategory, "BUSINESS");
  assert.equal(audit.calls[1].input.durationMs, 15);
});

test("audit failure never blocks a successful or failed conversion", async () => {
  const successful = new CrmLeadEnrollmentConversionObservabilityDecorator({
    auditService: auditSpy({ fail: true }),
    conversionService: { convertLeadToDraftEnrollment: async () => result },
    now: () => 0n,
  });
  assert.equal(await successful.convertLeadToDraftEnrollment(input, context), result);

  const original = Object.assign(new Error("denied"), {
    code: "CRM_ACCESS_DENIED",
    statusCode: 403,
  });
  const failed = new CrmLeadEnrollmentConversionObservabilityDecorator({
    auditService: auditSpy({ fail: true }),
    conversionService: {
      convertLeadToDraftEnrollment: async () => {
        throw original;
      },
    },
    now: () => 0n,
  });
  await assert.rejects(
    failed.convertLeadToDraftEnrollment(input, context),
    (error) => error === original,
  );
});
