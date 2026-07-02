const assert = require("node:assert/strict");
const test = require("node:test");

const {
  FINANCIAL_BILLING_CONTRACT_INPUT_REQUIRED_CODE,
  FinancialBillingContractBlocker,
  FinancialBillingContractStatus,
} = require("../contracts/enrollment-billing-contract.contract.js");
const {
  FINANCIAL_BILLING_CONTRACT_ENROLLMENT_NOT_FOUND_CODE,
  FINANCIAL_BILLING_CONTRACT_STUDENT_MISMATCH_CODE,
  FINANCIAL_OBLIGATION_INVALID_STATUS_TRANSITION_CODE,
  FINANCIAL_OBLIGATION_SCHEMA_OR_IDEMPOTENCY_GAP_CODE,
  FinancialObligationStatus,
  FinancialApplicationService,
  INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE,
} = require("../services/financial-application.service.js");

test("FinancialApplicationService returns blockers when ACTIVE Enrollment has no billing source", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "active-billing-1",
    status: "ACTIVE",
    studentPersonId: "person-billing-1",
    studentProfileId: "profile-billing-1",
  });
  const service = new FinancialApplicationService({ enrollmentReader: reader });

  const result = await service.prepareEnrollmentBillingContract({
    enrollmentId: "active-billing-1",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.prepared, true);
  assert.equal(result.billingContractReadOnly, true);
  assert.equal(result.enrollmentFound, true);
  assert.equal(result.canCreateBilling, false);
  assert.equal(result.status, FinancialBillingContractStatus.BLOCKED);
  assert.equal(result.planId, null);
  assert.equal(result.amount, null);
  assert.equal(result.dueDay, null);
  assert.equal(result.firstDueDate, null);
  assert.equal(result.chargeCreated, false);
  assert.equal(result.installmentCreated, false);
  assert.equal(result.paymentCreated, false);
  assert.equal(result.noChargeCreated, true);
  assert.equal(result.noInstallmentCreated, true);
  assert.equal(result.noPaymentCreated, true);
  assert.deepEqual(reader.calls, ["active-billing-1"]);

  const blockerCodes = result.blockers.map((blocker) => blocker.code);
  assert.equal(blockerCodes.includes(FinancialBillingContractBlocker.BILLING_PLAN_NOT_RESOLVED), true);
  assert.equal(blockerCodes.includes(FinancialBillingContractBlocker.BILLING_AMOUNT_NOT_RESOLVED), true);
  assert.equal(blockerCodes.includes(FinancialBillingContractBlocker.BILLING_DUE_DAY_NOT_RESOLVED), true);
  assert.equal(
    blockerCodes.includes(FinancialBillingContractBlocker.BILLING_FIRST_DUE_DATE_NOT_RESOLVED),
    true,
  );
  assert.equal(blockerCodes.includes(FinancialBillingContractBlocker.BILLING_CYCLE_NOT_RESOLVED), true);
  assert.equal(blockerCodes.includes(FinancialBillingContractBlocker.BILLING_CURRENCY_NOT_RESOLVED), true);
});

test("FinancialApplicationService blocks non-ACTIVE Enrollment through contract blockers", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "draft-billing-1",
    status: "DRAFT",
    studentPersonId: "person-billing-2",
    studentProfileId: "profile-billing-2",
  });
  const billingSourceReader = {
    async resolveEnrollmentBillingContract() {
      return {
        amount: 250,
        billingCycle: "mensal",
        currency: "BRL",
        dueDay: 10,
        firstDueDate: "2026-07-10",
        planId: "plan-1",
      };
    },
  };
  const service = new FinancialApplicationService({ billingSourceReader, enrollmentReader: reader });

  const result = await service.prepareEnrollmentBillingContract({
    enrollmentId: "draft-billing-1",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.canCreateBilling, false);
  assert.equal(result.status, FinancialBillingContractStatus.BLOCKED);
  assert.equal(result.chargeCreated, false);
  assert.equal(result.installmentCreated, false);
  assert.equal(result.paymentCreated, false);
  assert.equal(
    result.blockers.some(
      (blocker) => blocker.code === FinancialBillingContractBlocker.ENROLLMENT_NOT_ACTIVE,
    ),
    true,
  );
});

test("FinancialApplicationService returns READY when billing source resolves reliable contract data", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    classId: "class-1",
    id: "active-billing-2",
    status: "ACTIVE",
    studentPersonId: "person-billing-3",
    studentProfileId: "profile-billing-3",
  });
  const billingSourceReader = {
    async findBillingContractForEnrollment(input) {
      return {
        amount: "250.456",
        billingCycle: "mensal",
        currency: "brl",
        firstDueDate: "2026-07-10",
        metadata: {
          cpf: "hidden",
          source: "unit-test",
        },
        planId: "plan-2",
      };
    },
  };
  const service = new FinancialApplicationService({ billingSourceReader, enrollmentReader: reader });

  const result = await service.prepareEnrollmentBillingContract({
    enrollmentId: "active-billing-2",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.canCreateBilling, true);
  assert.equal(result.status, FinancialBillingContractStatus.READY);
  assert.equal(result.planId, "plan-2");
  assert.equal(result.amount, 250.46);
  assert.equal(result.dueDay, 10);
  assert.equal(result.firstDueDate, "2026-07-10");
  assert.equal(result.billingCycle, "MONTHLY");
  assert.equal(result.currency, "BRL");
  assert.equal(result.classId, "class-1");
  assert.deepEqual(result.blockers, []);
  assert.equal(result.metadata.source, "unit-test");
  assert.equal("cpf" in result.metadata, false);
});

test("FinancialApplicationService handles missing Enrollment as a controlled error", async () => {
  const service = new FinancialApplicationService({
    enrollmentReader: new FakeEnrollmentReader(),
  });

  await assert.rejects(
    () =>
      service.prepareEnrollmentBillingContract({
        enrollmentId: "missing-billing-1",
        requestedBy: "admin@j12.local",
      }),
    { code: FINANCIAL_BILLING_CONTRACT_ENROLLMENT_NOT_FOUND_CODE },
  );
});

test("FinancialApplicationService rejects missing required input before reading Enrollment", async () => {
  const reader = new FakeEnrollmentReader();
  const service = new FinancialApplicationService({ enrollmentReader: reader });

  await assert.rejects(
    () =>
      service.prepareEnrollmentBillingContract({
        enrollmentId: "active-billing-missing-requester",
      }),
    { code: FINANCIAL_BILLING_CONTRACT_INPUT_REQUIRED_CODE },
  );

  assert.deepEqual(reader.calls, []);
});

test("FinancialApplicationService rejects mismatched student identifiers", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "active-billing-3",
    status: "ACTIVE",
    studentPersonId: "person-billing-4",
    studentProfileId: "profile-billing-4",
  });
  const service = new FinancialApplicationService({ enrollmentReader: reader });

  await assert.rejects(
    () =>
      service.prepareEnrollmentBillingContract({
        enrollmentId: "active-billing-3",
        requestedBy: "admin@j12.local",
        studentPersonId: "wrong-person",
        studentProfileId: "profile-billing-4",
      }),
    { code: FINANCIAL_BILLING_CONTRACT_STUDENT_MISMATCH_CODE },
  );
});

test("FinancialApplicationService prepares and blocks initial obligation when billing contract has blockers", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "active-obligation-1",
    status: "ACTIVE",
    studentPersonId: "person-obligation-1",
    studentProfileId: "profile-obligation-1",
  });
  const service = new FinancialApplicationService({ enrollmentReader: reader });

  const first = await service.createInitialEnrollmentFinancialObligation({
    enrollmentId: "active-obligation-1",
    requestedBy: "admin@j12.local",
  });
  const repeated = await service.createInitialEnrollmentFinancialObligation({
    enrollmentId: "active-obligation-1",
    requestedBy: "admin@j12.local",
  });

  assert.equal(first.initialFinancialObligationPrepared, true);
  assert.equal(first.created, false);
  assert.equal(first.persisted, false);
  assert.equal(first.obligationCreated, false);
  assert.equal(first.obligationId, null);
  assert.equal(first.obligationType, INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE);
  assert.equal(first.blockedByBillingContract, true);
  assert.equal(first.blockedBySchemaOrRuleGap, false);
  assert.equal(first.canCreateInitialObligation, false);
  assert.equal(first.noChargeCreated, true);
  assert.equal(first.noInstallmentCreated, true);
  assert.equal(first.noPaymentCreated, true);
  assert.equal(first.noClassSideEffects, true);
  assert.equal(first.noScheduleSideEffects, true);
  assert.equal(first.noNotificationSideEffects, true);
  assert.equal(first.noSchemaChange, true);
  assert.equal(first.idempotency.safeToRetry, true);
  assert.equal(first.idempotency.supportedBySchema, false);
  assert.deepEqual(first.idempotency.fields, ["enrollment_id", "obligation_type"]);
  assert.equal(repeated.idempotency.key, first.idempotency.key);

  const blockerCodes = first.blockers.map((blocker) => blocker.code);
  assert.equal(blockerCodes.includes(FinancialBillingContractBlocker.BILLING_PLAN_NOT_RESOLVED), true);
  assert.equal(blockerCodes.includes(FinancialBillingContractBlocker.BILLING_AMOUNT_NOT_RESOLVED), true);
});

test("FinancialApplicationService blocks DRAFT initial obligation through billing contract", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "draft-obligation-1",
    status: "DRAFT",
    studentPersonId: "person-obligation-2",
    studentProfileId: "profile-obligation-2",
  });
  const service = new FinancialApplicationService({
    billingSourceReader: {
      async findBillingContractForEnrollment() {
        return {
          amount: 250,
          billingCycle: "MONTHLY",
          currency: "BRL",
          dueDay: 10,
          firstDueDate: "2026-07-10",
          planId: "plan-draft",
        };
      },
    },
    enrollmentReader: reader,
  });

  const result = await service.createInitialEnrollmentFinancialObligation({
    enrollmentId: "draft-obligation-1",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.created, false);
  assert.equal(result.blockedByBillingContract, true);
  assert.equal(result.noChargeCreated, true);
  assert.equal(result.noInstallmentCreated, true);
  assert.equal(result.noPaymentCreated, true);
  assert.equal(
    result.blockers.some(
      (blocker) => blocker.code === FinancialBillingContractBlocker.ENROLLMENT_NOT_ACTIVE,
    ),
    true,
  );
});

test("FinancialApplicationService blocks ready billing contract until idempotency schema exists", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "active-obligation-ready",
    status: "ACTIVE",
    studentPersonId: "person-obligation-3",
    studentProfileId: "profile-obligation-3",
  });
  const service = new FinancialApplicationService({
    billingSourceReader: {
      async findBillingContractForEnrollment() {
        return {
          amount: 300,
          billingCycle: "mensal",
          currency: "BRL",
          firstDueDate: "2026-07-10",
          planId: "plan-ready",
        };
      },
    },
    enrollmentReader: reader,
  });

  const result = await service.createInitialEnrollmentFinancialObligation({
    enrollmentId: "active-obligation-ready",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.billingContractCanCreateBilling, true);
  assert.equal(result.created, false);
  assert.equal(result.persisted, false);
  assert.equal(result.blockedByBillingContract, false);
  assert.equal(result.blockedBySchemaOrRuleGap, true);
  assert.equal(result.blockers[0].code, FINANCIAL_OBLIGATION_SCHEMA_OR_IDEMPOTENCY_GAP_CODE);
  assert.equal(result.noChargeCreated, true);
  assert.equal(result.noInstallmentCreated, true);
  assert.equal(result.noPaymentCreated, true);
});

test("FinancialApplicationService persists initial obligation when billing contract and repository are ready", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    classId: "class-obligation-ready",
    id: "active-obligation-persist",
    status: "ACTIVE",
    studentPersonId: "person-obligation-persist",
    studentProfileId: "profile-obligation-persist",
  });
  const repository = new FakeFinancialObligationRepository();
  const service = new FinancialApplicationService({
    billingSourceReader: {
      async findBillingContractForEnrollment() {
        return {
          amount: 450,
          billingCycle: "mensal",
          currency: "BRL",
          firstDueDate: "2026-07-15",
          planId: "plan-persist",
        };
      },
    },
    enrollmentReader: reader,
    financialObligationRepository: repository,
  });

  const result = await service.createInitialEnrollmentFinancialObligation({
    enrollmentId: "active-obligation-persist",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.initialFinancialObligationPersistenceEnabled, true);
  assert.equal(result.billingContractCanCreateBilling, true);
  assert.equal(result.blocked, false);
  assert.equal(result.created, true);
  assert.equal(result.reused, false);
  assert.equal(result.persisted, true);
  assert.equal(result.obligationCreated, true);
  assert.equal(result.obligationId, "fake-obligation-1");
  assert.equal(result.status, "PREPARED");
  assert.equal(result.amount, 450);
  assert.equal(result.currency, "BRL");
  assert.equal(result.planId, "plan-persist");
  assert.equal(result.firstDueDate, "2026-07-15");
  assert.equal(result.idempotency.duplicateCheckAvailable, true);
  assert.equal(result.idempotency.supportedBySchema, true);
  assert.equal(result.noChargeCreated, true);
  assert.equal(result.noInstallmentCreated, true);
  assert.equal(result.noPaymentCreated, true);
  assert.equal(result.noGatewayIntegration, true);
  assert.equal(result.noScheduleSideEffects, true);
  assert.equal(result.noNotificationSideEffects, true);

  assert.equal(repository.createCalls.length, 1);
  assert.deepEqual(repository.createCalls[0], {
    amount: 450,
    createdBy: "admin@j12.local",
    currency: "BRL",
    dueDate: "2026-07-15",
    enrollmentId: "active-obligation-persist",
    metadata: {
      billingContractVersion: "sprint-12.3",
      billingCycle: "MONTHLY",
      classId: "class-obligation-ready",
      dueDay: 15,
      noChargeCreated: true,
      noGatewayIntegration: true,
      noInstallmentCreated: true,
      noNotificationSideEffects: true,
      noPaymentCreated: true,
      noScheduleSideEffects: true,
      operation: "createInitialEnrollmentFinancialObligation",
    },
    obligationType: INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE,
    planId: "plan-persist",
    source: "ENROLLMENT",
    status: "PREPARED",
  });
});

test("FinancialApplicationService reuses duplicate initial obligation through repository idempotency", async () => {
  const reader = new FakeEnrollmentReader();
  reader.seed({
    id: "active-obligation-idempotent",
    status: "ACTIVE",
    studentPersonId: "person-obligation-idempotent",
    studentProfileId: "profile-obligation-idempotent",
  });
  const repository = new FakeFinancialObligationRepository();
  const service = new FinancialApplicationService({
    billingSourceReader: {
      async findBillingContractForEnrollment() {
        return {
          amount: "275.00",
          billingCycle: "MONTHLY",
          currency: "BRL",
          dueDay: 20,
          firstDueDate: "2026-07-20",
          planId: "plan-idempotent",
        };
      },
    },
    enrollmentReader: reader,
    financialObligationRepository: repository,
  });

  const first = await service.createInitialEnrollmentFinancialObligation({
    enrollmentId: "active-obligation-idempotent",
    requestedBy: "admin@j12.local",
  });
  const duplicate = await service.createInitialEnrollmentFinancialObligation({
    enrollmentId: "active-obligation-idempotent",
    requestedBy: "admin@j12.local",
  });

  assert.equal(first.created, true);
  assert.equal(first.reused, false);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.reused, true);
  assert.equal(duplicate.existing, true);
  assert.equal(duplicate.persisted, true);
  assert.equal(duplicate.obligationId, first.obligationId);
  assert.equal(duplicate.idempotency.key, first.idempotency.key);
  assert.equal(repository.createCalls.length, 2);
  assert.equal(repository.records.size, 1);
  assert.equal(duplicate.noPaymentCreated, true);
  assert.equal(duplicate.noGatewayIntegration, true);
});

test("FinancialApplicationService updates financial obligation status with safe audit", async () => {
  const repository = new FakeFinancialObligationRepository();
  repository.seedObligation({
    enrollmentId: "enrollment-status-paid",
    id: "obligation-status-paid",
    metadata: { source: "unit-test" },
    obligationType: INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE,
    status: FinancialObligationStatus.PENDING,
  });
  repository.seedObligation({
    enrollmentId: "enrollment-status-cancelled",
    id: "obligation-status-cancelled",
    obligationType: INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE,
    status: FinancialObligationStatus.PENDING,
  });
  repository.seedObligation({
    enrollmentId: "enrollment-status-overdue",
    id: "obligation-status-overdue",
    obligationType: INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE,
    status: FinancialObligationStatus.PENDING,
  });
  repository.seedObligation({
    enrollmentId: "enrollment-overdue-paid",
    id: "obligation-overdue-paid",
    obligationType: INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE,
    status: FinancialObligationStatus.OVERDUE,
  });
  const service = new FinancialApplicationService({
    enrollmentReader: new FakeEnrollmentReader(),
    financialObligationRepository: repository,
  });

  const paid = await service.markEnrollmentFinancialObligationAsPaid({
    obligationId: "obligation-status-paid",
    paidAt: "2026-07-20 10:30:00",
    paidBy: "admin@j12.local",
    paymentReference: "manual-audit-1",
  });
  const cancelled = await service.cancelEnrollmentFinancialObligation({
    cancelledAt: "2026-07-21 09:00:00",
    cancelledBy: "admin@j12.local",
    obligationId: "obligation-status-cancelled",
    reason: "administrative-test",
  });
  const overdue = await service.markEnrollmentFinancialObligationAsOverdue({
    checkedAt: "2026-07-22 08:00:00",
    obligationId: "obligation-status-overdue",
  });
  const overduePaid = await service.markEnrollmentFinancialObligationAsPaid({
    obligationId: "obligation-overdue-paid",
    paidAt: "2026-07-23 11:00:00",
    paidBy: "admin@j12.local",
  });

  assert.equal(paid.previousStatus, FinancialObligationStatus.PENDING);
  assert.equal(paid.status, FinancialObligationStatus.PAID);
  assert.equal(paid.paymentAuditPersistedIfAvailable, true);
  assert.equal(paid.noGatewayIntegration, true);
  assert.equal(paid.noPaymentCreated, true);
  assert.equal(paid.obligation.metadata.statusAudit[0].paymentReference, "manual-audit-1");
  assert.equal(paid.obligation.metadata.statusAudit[0].noPaymentCreated, true);

  assert.equal(cancelled.status, FinancialObligationStatus.CANCELLED);
  assert.equal(cancelled.obligation.cancelledAt, "2026-07-21 09:00:00");
  assert.equal(cancelled.obligation.cancelledBy, "admin@j12.local");
  assert.equal(cancelled.obligation.metadata.statusAudit[0].reason, "administrative-test");

  assert.equal(overdue.status, FinancialObligationStatus.OVERDUE);
  assert.equal(overdue.obligation.metadata.statusAudit[0].checkedAt, "2026-07-22 08:00:00");

  assert.equal(overduePaid.previousStatus, FinancialObligationStatus.OVERDUE);
  assert.equal(overduePaid.status, FinancialObligationStatus.PAID);
  assert.equal(repository.updateCalls.length, 4);
});

test("FinancialApplicationService blocks invalid financial obligation status transitions", async () => {
  const repository = new FakeFinancialObligationRepository();
  repository.seedObligation({
    enrollmentId: "enrollment-invalid-status",
    id: "obligation-invalid-status",
    obligationType: INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE,
    status: FinancialObligationStatus.PAID,
  });
  const service = new FinancialApplicationService({
    enrollmentReader: new FakeEnrollmentReader(),
    financialObligationRepository: repository,
  });

  await assert.rejects(
    () =>
      service.cancelEnrollmentFinancialObligation({
        cancelledAt: "2026-07-21 09:00:00",
        cancelledBy: "admin@j12.local",
        obligationId: "obligation-invalid-status",
        reason: "not-allowed",
      }),
    {
      code: FINANCIAL_OBLIGATION_INVALID_STATUS_TRANSITION_CODE,
    },
  );
  assert.equal(repository.updateCalls.length, 0);
});

test("FinancialApplicationService lists obligations and summarizes student financial scope", async () => {
  const repository = new FakeFinancialObligationRepository();
  repository.seedObligation({
    amount: 100,
    enrollmentId: "enrollment-admin-list",
    id: "obligation-admin-open",
    obligationType: INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE,
    status: FinancialObligationStatus.PENDING,
    studentPersonId: "person-admin-summary",
    studentProfileId: "profile-admin-summary",
  });
  repository.seedObligation({
    amount: 50,
    enrollmentId: "enrollment-admin-paid",
    id: "obligation-admin-paid",
    obligationType: INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE,
    status: FinancialObligationStatus.PAID,
    studentPersonId: "person-admin-summary",
    studentProfileId: "profile-admin-summary",
  });
  repository.seedObligation({
    amount: 25,
    enrollmentId: "enrollment-admin-overdue",
    id: "obligation-admin-overdue",
    obligationType: INITIAL_ENROLLMENT_FINANCIAL_OBLIGATION_TYPE,
    status: FinancialObligationStatus.OVERDUE,
    studentPersonId: "person-admin-summary",
    studentProfileId: "profile-admin-summary",
  });
  const service = new FinancialApplicationService({
    enrollmentReader: new FakeEnrollmentReader(),
    financialObligationRepository: repository,
  });

  const list = await service.listEnrollmentFinancialObligations({
    enrollmentId: "enrollment-admin-list",
  });
  const summary = await service.getStudentFinancialSummary({
    studentPersonId: "person-admin-summary",
    studentProfileId: "profile-admin-summary",
  });

  assert.equal(list.financialObligationsEndpointReady, true);
  assert.equal(list.count, 1);
  assert.equal(list.obligations[0].id, "obligation-admin-open");
  assert.equal(list.noGatewayIntegration, true);

  assert.equal(summary.financialSummaryEndpointReady, true);
  assert.equal(summary.count, 3);
  assert.equal(summary.summary.total, 3);
  assert.equal(summary.summary.open, 2);
  assert.equal(summary.summary.paid, 1);
  assert.equal(summary.summary.overdue, 1);
  assert.equal(summary.summary.amountTotal, 175);
  assert.equal(summary.summary.amountOpen, 125);
  assert.equal(summary.summary.amountPaid, 50);
});

test("FinancialApplicationService delegates financial obligation repository reads and creates", async () => {
  const calls = [];
  const repository = {
    async createEnrollmentFinancialObligationRecord(input) {
      calls.push(["create", input]);
      return {
        created: true,
        obligation: { id: "obligation-created" },
        reused: false,
      };
    },
    async findEnrollmentFinancialObligation(input) {
      calls.push(["find", input]);
      return { id: "obligation-found" };
    },
  };
  const service = new FinancialApplicationService({
    enrollmentReader: new FakeEnrollmentReader(),
    financialObligationRepository: repository,
  });

  const found = await service.findEnrollmentFinancialObligation({
    enrollmentId: "enrollment-repo",
    obligationType: "INITIAL_ENROLLMENT_OBLIGATION",
  });
  const created = await service.createEnrollmentFinancialObligationRecord({
    enrollmentId: "enrollment-repo",
    obligationType: "INITIAL_ENROLLMENT_OBLIGATION",
    status: "PREPARED",
  });

  assert.deepEqual(found, { id: "obligation-found" });
  assert.equal(created.created, true);
  assert.deepEqual(calls, [
    [
      "find",
      {
        enrollmentId: "enrollment-repo",
        obligationType: "INITIAL_ENROLLMENT_OBLIGATION",
      },
    ],
    [
      "create",
      {
        enrollmentId: "enrollment-repo",
        obligationType: "INITIAL_ENROLLMENT_OBLIGATION",
        status: "PREPARED",
      },
    ],
  ]);
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

class FakeFinancialObligationRepository {
  constructor() {
    this.createCalls = [];
    this.findCalls = [];
    this.records = new Map();
    this.updateCalls = [];
  }

  seedObligation(record) {
    const obligation = {
      amount: record.amount ?? null,
      cancelledAt: record.cancelledAt ?? null,
      cancelledBy: record.cancelledBy ?? null,
      createdBy: record.createdBy ?? null,
      currency: record.currency ?? null,
      dueDate: record.dueDate ?? null,
      enrollmentId: record.enrollmentId,
      id: record.id,
      metadata: record.metadata || {},
      obligationType: record.obligationType,
      planId: record.planId ?? null,
      source: record.source || "ENROLLMENT",
      status: record.status,
      studentPersonId: record.studentPersonId ?? null,
      studentProfileId: record.studentProfileId ?? null,
    };
    this.records.set(this.makeKey(obligation), obligation);
    return obligation;
  }

  async createEnrollmentFinancialObligationRecord(input) {
    this.createCalls.push(input);
    const key = `${input.enrollmentId}:${input.obligationType}`;

    if (this.records.has(key)) {
      return {
        created: false,
        obligation: this.records.get(key),
        reused: true,
      };
    }

    const obligation = {
      amount: input.amount,
      createdBy: input.createdBy,
      currency: input.currency,
      dueDate: input.dueDate,
      enrollmentId: input.enrollmentId,
      id: `fake-obligation-${this.records.size + 1}`,
      metadata: input.metadata,
      obligationType: input.obligationType,
      planId: input.planId,
      source: input.source,
      status: input.status,
    };
    this.records.set(key, obligation);

    return {
      created: true,
      obligation,
      reused: false,
    };
  }

  async findEnrollmentFinancialObligation(input) {
    this.findCalls.push(input);
    return this.records.get(`${input.enrollmentId}:${input.obligationType}`) || null;
  }

  async listEnrollmentFinancialObligations(input) {
    this.findCalls.push(["listByEnrollment", input]);
    return Array.from(this.records.values()).filter(
      (record) => record.enrollmentId === input.enrollmentId,
    );
  }

  async listEnrollmentFinancialObligationsByStudentScope(input) {
    this.findCalls.push(["listByStudentScope", input]);
    return Array.from(this.records.values()).filter(
      (record) =>
        record.studentPersonId === input.studentPersonId &&
        record.studentProfileId === input.studentProfileId,
    );
  }

  async findEnrollmentFinancialObligationById(input) {
    this.findCalls.push(["byId", input]);
    return this.findById(input.obligationId);
  }

  async updateEnrollmentFinancialObligationStatus(input) {
    this.updateCalls.push(input);
    const obligation = this.findById(input.obligationId);

    if (!obligation || !input.currentStatuses.includes(obligation.status)) {
      return {
        obligation,
        updated: false,
      };
    }

    obligation.status = input.status;
    obligation.cancelledAt = input.cancelledAt || null;
    obligation.cancelledBy = input.cancelledBy || null;
    obligation.metadata = input.metadata || {};

    return {
      obligation,
      updated: true,
    };
  }

  findById(id) {
    return Array.from(this.records.values()).find((record) => record.id === id) || null;
  }

  makeKey(record) {
    return `${record.enrollmentId}:${record.obligationType}`;
  }
}
