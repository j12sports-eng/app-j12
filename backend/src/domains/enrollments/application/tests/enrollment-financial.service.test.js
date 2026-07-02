const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ENROLLMENT_FINANCIAL_OBLIGATION_ENROLLMENT_NOT_FOUND_CODE,
  ENROLLMENT_FINANCIAL_OBLIGATION_INVALID_ENROLLMENT_STATUS_CODE,
  ENROLLMENT_FINANCIAL_OBLIGATION_STUDENT_MISMATCH_CODE,
  EnrollmentFinancialService,
} = require("../services/enrollment-financial.service.js");

test("EnrollmentFinancialService prepares a no-write financial obligation for ACTIVE Enrollment", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "active-financial-1",
    status: "ACTIVE",
    studentPersonId: "person-financial-1",
    studentProfileId: "profile-financial-1",
  });
  const service = new EnrollmentFinancialService({ enrollmentReader: reader });

  const result = await service.prepareEnrollmentFinancialObligation({
    amount: 250,
    competence: "2026-07",
    dueDate: "2026-07-10",
    enrollmentId: "active-financial-1",
    requestedBy: "admin@j12.local",
  });
  const repeated = await service.prepareEnrollmentFinancialObligation({
    enrollmentId: "active-financial-1",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.prepared, true);
  assert.equal(result.enrollmentFound, true);
  assert.equal(result.enrollmentStatus, "ACTIVE");
  assert.equal(result.studentPersonId, "person-financial-1");
  assert.equal(result.studentProfileId, "profile-financial-1");
  assert.equal(result.chargeCreated, false);
  assert.equal(result.installmentCreated, false);
  assert.equal(result.financialEntryCreated, false);
  assert.equal(result.noChargeCreated, true);
  assert.equal(result.noInstallmentCreated, true);
  assert.equal(result.noFinancialEntryCreated, true);
  assert.equal(result.financialGatewayCalled, false);
  assert.equal(result.financialCreationBlockedBySchemaOrModuleGap, true);
  assert.equal(result.idempotency.safeToRetry, true);
  assert.equal(repeated.idempotency.key, result.idempotency.key);
  assert.deepEqual(reader.calls, ["active-financial-1", "active-financial-1"]);
});

test("EnrollmentFinancialService blocks DRAFT Enrollment before financial preparation", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "draft-financial-1",
    status: "DRAFT",
    studentPersonId: "person-financial-2",
    studentProfileId: "profile-financial-2",
  });
  const service = new EnrollmentFinancialService({ enrollmentReader: reader });

  await assert.rejects(
    () =>
      service.prepareEnrollmentFinancialObligation({
        enrollmentId: "draft-financial-1",
        requestedBy: "admin@j12.local",
      }),
    { code: ENROLLMENT_FINANCIAL_OBLIGATION_INVALID_ENROLLMENT_STATUS_CODE },
  );
});

test("EnrollmentFinancialService handles missing Enrollment as a controlled error", async () => {
  const service = new EnrollmentFinancialService({
    enrollmentReader: new FakeEnrollmentReader(),
  });

  await assert.rejects(
    () =>
      service.prepareEnrollmentFinancialObligation({
        enrollmentId: "missing-financial-1",
        requestedBy: "admin@j12.local",
      }),
    { code: ENROLLMENT_FINANCIAL_OBLIGATION_ENROLLMENT_NOT_FOUND_CODE },
  );
});

test("EnrollmentFinancialService rejects mismatched student identifiers", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "active-financial-2",
    status: "ACTIVE",
    studentPersonId: "person-financial-3",
    studentProfileId: "profile-financial-3",
  });
  const service = new EnrollmentFinancialService({ enrollmentReader: reader });

  await assert.rejects(
    () =>
      service.prepareEnrollmentFinancialObligation({
        enrollmentId: "active-financial-2",
        requestedBy: "admin@j12.local",
        studentPersonId: "wrong-person",
        studentProfileId: "profile-financial-3",
      }),
    { code: ENROLLMENT_FINANCIAL_OBLIGATION_STUDENT_MISMATCH_CODE },
  );
});

test("EnrollmentFinancialService prepares an initial obligation contract without creating financial records", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "active-financial-3",
    status: "ACTIVE",
    studentPersonId: "person-financial-4",
    studentProfileId: "profile-financial-4",
  });
  const service = new EnrollmentFinancialService({ enrollmentReader: reader });

  const result = await service.createInitialFinancialObligationForEnrollment({
    enrollmentId: "active-financial-3",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.prepared, true);
  assert.equal(result.persisted, false);
  assert.equal(result.created, false);
  assert.equal(result.chargeCreated, false);
  assert.equal(result.installmentCreated, false);
  assert.equal(result.financialEntryCreated, false);
  assert.equal(result.preparationOnly, true);
  assert.equal(result.blockedBySchemaOrRuleGap, true);
  assert.equal(result.requirementsResolved, false);
});

test("EnrollmentFinancialService persists an initial obligation when a writer is available", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "active-financial-4",
    status: "ACTIVE",
    studentPersonId: "person-financial-5",
    studentProfileId: "profile-financial-5",
  });
  const writer = new FakeFinancialWriter();
  const service = new EnrollmentFinancialService({
    enrollmentReader: reader,
    financialWriter: writer.write.bind(writer),
  });

  const result = await service.createInitialFinancialObligationForEnrollment({
    enrollmentId: "active-financial-4",
    requestedBy: "admin@j12.local",
    persist: true,
  });

  assert.equal(result.persisted, true);
  assert.equal(result.created, true);
  assert.equal(result.chargeCreated, true);
  assert.equal(result.preparationOnly, false);
  assert.equal(result.obligationId, "charge-123");
  assert.equal(writer.calls.length, 1);
  assert.equal(writer.calls[0].enrollment.id, "active-financial-4");
  assert.equal(writer.calls[0].input.persist, true);
});

class FakeEnrollmentReader {
  constructor() {
    this.calls = [];
    this.records = new Map();
  }

  seed(record) {
    this.records.set(record.id, { ...record });
  }

  async findEnrollmentById(id) {
    this.calls.push(id);
    return this.records.get(id) || null;
  }
}

class FakeFinancialWriter {
  constructor() {
    this.calls = [];
  }

  async write(payload) {
    this.calls.push(payload);
    return {
      created: true,
      chargeCreated: true,
      persisted: true,
      obligationId: "charge-123",
    };
  }
}
