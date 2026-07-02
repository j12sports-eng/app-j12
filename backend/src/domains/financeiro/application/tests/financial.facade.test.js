const assert = require("node:assert/strict");
const test = require("node:test");

const { FinancialFacade } = require("../facades/financial.facade.js");

test("FinancialFacade delegates Enrollment billing contract preparation to the application service", async () => {
  const calls = [];
  const facade = new FinancialFacade({
    financialService: {
      async prepareEnrollmentBillingContract(input) {
        calls.push(input);
        return {
          delegated: true,
          input,
        };
      },
    },
  });

  const result = await facade.prepareEnrollmentBillingContract({
    classId: "class-1",
    enrollmentId: "enrollment-1",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.delegated, true);
  assert.deepEqual(calls, [
    {
      classId: "class-1",
      enrollmentId: "enrollment-1",
      requestedBy: "admin@j12.local",
    },
  ]);
});

test("FinancialFacade uses the default read-only application service when dependencies are injected", async () => {
  const facade = new FinancialFacade({
    billingSourceReader: {
      async findByEnrollmentId() {
        return {
          amount: 199,
          billingCycle: "MONTHLY",
          currency: "BRL",
          dueDay: 10,
          firstDueDate: "2026-07-10",
          planId: "plan-default",
        };
      },
    },
    enrollmentReader: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-default",
          studentProfileId: "profile-default",
        };
      },
    },
  });

  const result = await facade.prepareEnrollmentBillingContract({
    enrollmentId: "enrollment-default",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.canCreateBilling, true);
  assert.equal(result.planId, "plan-default");
  assert.equal(result.noChargeCreated, true);
  assert.equal(result.noInstallmentCreated, true);
  assert.equal(result.noPaymentCreated, true);
});

test("FinancialFacade delegates initial Enrollment financial obligation creation", async () => {
  const calls = [];
  const facade = new FinancialFacade({
    financialService: {
      async createInitialEnrollmentFinancialObligation(input) {
        calls.push(input);
        return {
          delegated: true,
          input,
        };
      },
      async prepareEnrollmentBillingContract(input) {
        return input;
      },
    },
  });

  const result = await facade.createInitialEnrollmentFinancialObligation({
    enrollmentId: "enrollment-obligation-1",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.delegated, true);
  assert.deepEqual(calls, [
    {
      enrollmentId: "enrollment-obligation-1",
      requestedBy: "admin@j12.local",
    },
  ]);
});

test("FinancialFacade default service prepares initial obligation without writes", async () => {
  const facade = new FinancialFacade({
    enrollmentReader: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-obligation-default",
          studentProfileId: "profile-obligation-default",
        };
      },
    },
  });

  const result = await facade.createInitialEnrollmentFinancialObligation({
    enrollmentId: "enrollment-obligation-default",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.initialFinancialObligationPrepared, true);
  assert.equal(result.created, false);
  assert.equal(result.noChargeCreated, true);
  assert.equal(result.noInstallmentCreated, true);
  assert.equal(result.noPaymentCreated, true);
  assert.equal(result.noSchemaChange, true);
});

test("FinancialFacade default service persists initial obligation through injected repository", async () => {
  const createCalls = [];
  const facade = new FinancialFacade({
    billingSourceReader: {
      async findBillingContractForEnrollment() {
        return {
          amount: 320,
          billingCycle: "MONTHLY",
          currency: "BRL",
          dueDay: 12,
          firstDueDate: "2026-07-12",
          planId: "plan-facade-obligation",
        };
      },
    },
    enrollmentReader: {
      async findEnrollmentById(id) {
        return {
          id,
          status: "ACTIVE",
          studentPersonId: "person-facade-obligation",
          studentProfileId: "profile-facade-obligation",
        };
      },
    },
    financialObligationRepository: {
      async createEnrollmentFinancialObligationRecord(input) {
        createCalls.push(input);
        return {
          created: true,
          obligation: {
            amount: input.amount,
            currency: input.currency,
            dueDate: input.dueDate,
            enrollmentId: input.enrollmentId,
            id: "facade-obligation-created",
            obligationType: input.obligationType,
            planId: input.planId,
            status: input.status,
          },
          reused: false,
        };
      },
      async findEnrollmentFinancialObligation() {
        return null;
      },
    },
  });

  const result = await facade.createInitialEnrollmentFinancialObligation({
    enrollmentId: "enrollment-facade-obligation",
    requestedBy: "admin@j12.local",
  });

  assert.equal(result.initialFinancialObligationPersistenceEnabled, true);
  assert.equal(result.created, true);
  assert.equal(result.persisted, true);
  assert.equal(result.obligationId, "facade-obligation-created");
  assert.equal(result.noPaymentCreated, true);
  assert.equal(result.noGatewayIntegration, true);
  assert.equal(createCalls.length, 1);
  assert.equal(createCalls[0].status, "PREPARED");
  assert.equal(createCalls[0].source, "ENROLLMENT");
});

test("FinancialFacade delegates financial obligation repository methods through service", async () => {
  const calls = [];
  const facade = new FinancialFacade({
    financialService: {
      async createEnrollmentFinancialObligationRecord(input) {
        calls.push(["create", input]);
        return {
          created: true,
          input,
        };
      },
      async findEnrollmentFinancialObligation(input) {
        calls.push(["find", input]);
        return {
          found: true,
          input,
        };
      },
      async prepareEnrollmentBillingContract(input) {
        return input;
      },
    },
  });

  const found = await facade.findEnrollmentFinancialObligation({
    enrollmentId: "enrollment-facade",
    obligationType: "INITIAL_ENROLLMENT_OBLIGATION",
  });
  const created = await facade.createEnrollmentFinancialObligationRecord({
    enrollmentId: "enrollment-facade",
    obligationType: "INITIAL_ENROLLMENT_OBLIGATION",
    status: "PREPARED",
  });

  assert.equal(found.found, true);
  assert.equal(created.created, true);
  assert.deepEqual(calls, [
    [
      "find",
      {
        enrollmentId: "enrollment-facade",
        obligationType: "INITIAL_ENROLLMENT_OBLIGATION",
      },
    ],
    [
      "create",
      {
        enrollmentId: "enrollment-facade",
        obligationType: "INITIAL_ENROLLMENT_OBLIGATION",
        status: "PREPARED",
      },
    ],
  ]);
});

test("FinancialFacade delegates financial admin read methods", async () => {
  const calls = [];
  const facade = new FinancialFacade({
    financialService: {
      async getStudentFinancialSummary(input) {
        calls.push(["summary", input]);
        return {
          input,
          summaryReady: true,
        };
      },
      async listEnrollmentFinancialObligations(input) {
        calls.push(["list", input]);
        return {
          input,
          listReady: true,
        };
      },
      async prepareEnrollmentBillingContract(input) {
        return input;
      },
    },
  });

  const list = await facade.listEnrollmentFinancialObligations({
    enrollmentId: "enrollment-fin-admin",
  });
  const summary = await facade.getStudentFinancialSummary({
    studentPersonId: "person-fin-admin",
    studentProfileId: "profile-fin-admin",
  });

  assert.equal(list.listReady, true);
  assert.equal(summary.summaryReady, true);
  assert.deepEqual(calls, [
    [
      "list",
      {
        enrollmentId: "enrollment-fin-admin",
      },
    ],
    [
      "summary",
      {
        studentPersonId: "person-fin-admin",
        studentProfileId: "profile-fin-admin",
      },
    ],
  ]);
});

test("FinancialFacade delegates financial obligation status flow methods", async () => {
  const calls = [];
  const facade = new FinancialFacade({
    financialService: {
      async cancelEnrollmentFinancialObligation(input) {
        calls.push(["cancel", input]);
        return { cancelled: true, input };
      },
      async markEnrollmentFinancialObligationAsOverdue(input) {
        calls.push(["overdue", input]);
        return { input, overdue: true };
      },
      async markEnrollmentFinancialObligationAsPaid(input) {
        calls.push(["paid", input]);
        return { input, paid: true };
      },
      async prepareEnrollmentBillingContract(input) {
        return input;
      },
    },
  });

  const paid = await facade.markEnrollmentFinancialObligationAsPaid({
    obligationId: "obligation-facade-paid",
    paidAt: "2026-07-20 10:00:00",
    paidBy: "admin@j12.local",
  });
  const cancelled = await facade.cancelEnrollmentFinancialObligation({
    cancelledAt: "2026-07-21 10:00:00",
    cancelledBy: "admin@j12.local",
    obligationId: "obligation-facade-cancelled",
    reason: "manual-cancel",
  });
  const overdue = await facade.markEnrollmentFinancialObligationAsOverdue({
    checkedAt: "2026-07-22 10:00:00",
    obligationId: "obligation-facade-overdue",
  });

  assert.equal(paid.paid, true);
  assert.equal(cancelled.cancelled, true);
  assert.equal(overdue.overdue, true);
  assert.deepEqual(calls, [
    [
      "paid",
      {
        obligationId: "obligation-facade-paid",
        paidAt: "2026-07-20 10:00:00",
        paidBy: "admin@j12.local",
      },
    ],
    [
      "cancel",
      {
        cancelledAt: "2026-07-21 10:00:00",
        cancelledBy: "admin@j12.local",
        obligationId: "obligation-facade-cancelled",
        reason: "manual-cancel",
      },
    ],
    [
      "overdue",
      {
        checkedAt: "2026-07-22 10:00:00",
        obligationId: "obligation-facade-overdue",
      },
    ],
  ]);
});
