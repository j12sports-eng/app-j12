const assert = require("node:assert/strict");
const test = require("node:test");

const {
  FinancialApplicationService,
} = require("../../application/services/financial-application.service.js");
const {
  reconcileCanonicalPaymentState,
} = require("../../inter/infrastructure/repositories/mysql-inter.repository.js");
const {
  FinancialReportService,
} = require("../../reports/application/services/financial-report.service.js");
const { settleCanonicalPayment } = require("../../../../services/bancoInter/financial.js");

function createHarness(options = {}) {
  let state = emptyState();
  let tail = Promise.resolve();
  let materializations = 0;

  const transactionRunner = (work) => {
    const execute = async () => {
      const snapshot = structuredClone(state);
      try {
        return await work(connection);
      } catch (error) {
        state = snapshot;
        throw error;
      }
    };
    const result = tail.then(execute, execute);
    tail = result.catch(() => undefined);
    return result;
  };

  const connection = {
    async execute(sql, params = []) {
      if (/FROM enrollment_financial_bridges bridge/.test(sql)) {
        if (!state.bridge) return [[]];
        return [
          [
            {
              charge_id: state.bridge.chargeId,
              data_vencimento: state.installment.dueDate,
              financial_payment_amount: state.payment?.amount ?? null,
              financial_payment_id: state.payment?.id ?? null,
              financial_payment_txid: state.payment?.txid ?? null,
              installment_amount: state.installment.amount,
              installment_id: state.bridge.installmentId,
              legacy_student_id: state.bridge.legacyStudentId,
              obligation_amount: state.obligation.amount,
              obligation_id: state.obligation.id,
              obligation_status: state.obligation.status,
            },
          ],
        ];
      }
      if (/INSERT INTO financial_payments/.test(sql)) {
        state.payment = {
          amount: params[5],
          charge_id: params[3],
          id: params[0],
          mensalidade_id: params[2],
          status: "PENDENTE",
          student_id: params[1],
          txid: params[4],
        };
        return [{ affectedRows: 1 }];
      }
      if (/SELECT \* FROM financial_payments.*FOR UPDATE/s.test(sql))
        return [state.payment ? [state.payment] : []];
      if (/FROM enrollment_financial_bridges/.test(sql)) {
        return [state.bridge ? [{ obligation_id: state.bridge.obligationId }] : []];
      }
      if (/UPDATE financial_payments/.test(sql)) {
        state.payment.status = params[0];
        state.payment.paid_at = params[1];
        return [{ affectedRows: 1 }];
      }
      if (/UPDATE j12_financeiro_cobrancas/.test(sql)) {
        state.charge.status = params[0];
        state.charge.paidAt = params[1];
        return [{ affectedRows: 1 }];
      }
      if (/UPDATE j12_mensalidades/.test(sql)) {
        state.installment.status = params[0];
        state.installment.paidAt = params[1];
        return [{ affectedRows: 1 }];
      }
      if (/INSERT INTO j12_pagamentos/.test(sql)) {
        state.history[params[1]] = { amount: params[4], id: params[0] };
        return [{ affectedRows: 1 }];
      }
      if (/DELETE FROM j12_pagamentos/.test(sql)) {
        state.history = {};
        return [{ affectedRows: 1 }];
      }
      if (/UPDATE enrollment_financial_bridges/.test(sql)) {
        state.bridge.status = params[0];
        return [{ affectedRows: 1 }];
      }
      if (/UPDATE enrollment_financial_obligations/.test(sql)) {
        if (options.failReconciliation) throw new Error("integrated reconciliation failure");
        state.obligation.status = params[0];
        return [{ affectedRows: 1 }];
      }
      if (/SELECT \* FROM financial_payments/.test(sql))
        return [state.payment ? [state.payment] : []];
      throw new Error(`Unexpected integrated SQL: ${sql}`);
    },
  };

  const obligationRepository = {
    async createEnrollmentFinancialObligationRecord(input) {
      if (state.obligation) return { created: false, obligation: state.obligation, reused: true };
      state.obligation = { ...input, id: "obligation-integrated" };
      return { created: true, obligation: state.obligation, reused: false };
    },
    async findEnrollmentFinancialObligation() {
      return state.obligation;
    },
    runInTransaction(work) {
      return transactionRunner(() =>
        work({ connection, queryRunner: async () => [], repository: obligationRepository }),
      );
    },
  };

  const financialService = new FinancialApplicationService({
    billingSourceReader: async () => ({
      amount: 250,
      billingCycle: "MONTHLY",
      currency: "BRL",
      firstDueDate: "2026-07-20",
      planId: "plan-integrated",
    }),
    canonicalIdentityService: {
      async resolve() {
        return { legacy_student_id: "legacy-integrated" };
      },
    },
    enrollmentReader: {
      async findEnrollmentById() {
        return {
          id: "enrollment-integrated",
          status: "ACTIVE",
          studentPersonId: "person-integrated",
          studentProfileId: "profile-integrated",
        };
      },
    },
    financialBridgeRepositoryFactory: () => ({
      async findByObligationId() {
        return state.bridge;
      },
      async createBridge(input) {
        if (!state.bridge) state.bridge = { ...input };
        return { bridge: state.bridge, created: true, reused: false };
      },
    }),
    financialObligationRepository: obligationRepository,
    studentFinanceMaterializer: async () => {
      materializations += 1;
      state.charge = { amount: 250, id: "charge-integrated", status: "pendente" };
      state.installment = {
        amount: 250,
        dueDate: "2026-07-20",
        id: "installment-integrated",
        status: "pendente",
      };
      return { chargeId: state.charge.id, installmentId: state.installment.id };
    },
  });

  const enroll = () =>
    financialService.createInitialEnrollmentFinancialObligation({
      enrollmentId: "enrollment-integrated",
      legacyStudentId: "legacy-integrated",
      requestedBy: "admin@j12.local",
    });
  const settle = (input = {}) =>
    settleCanonicalPayment(
      {
        installmentId: "installment-integrated",
        manual: true,
        paidAmount: 250,
        paidAt: "2026-07-15",
        ...input,
      },
      { reconcilePayment: reconcileCanonicalPaymentState, transactionRunner },
    );
  const reconcile = (status) =>
    transactionRunner((tx) =>
      reconcileCanonicalPaymentState(tx, {
        payment: { txid: state.payment?.txid || "missing" },
        receivedAmount: 250,
        status,
      }),
    );

  const report = new FinancialReportService({
    now: () => new Date("2026-07-15T12:00:00Z"),
    repository: reportRepository(() => state),
  });

  return {
    enroll,
    getMaterializations: () => materializations,
    getState: () => state,
    reconcile,
    report,
    settle,
  };
}

function emptyState() {
  return {
    bridge: null,
    charge: null,
    history: {},
    installment: null,
    obligation: null,
    payment: null,
  };
}

function reportRepository(getState) {
  return {
    async getFinancialOverview() {
      const state = getState();
      return {
        categories: [],
        cashFlow: [],
        dimensions: [],
        totals: {
          despesas: 0,
          receitas: state.charge?.status === "pago" ? state.charge.amount : 0,
        },
      };
    },
    async getInstallmentsReport() {
      const state = getState();
      return {
        count: state.installment ? 1 : 0,
        items: [],
        summary: state.installment
          ? [{ quantidade: 1, status: state.installment.status, valor: state.installment.amount }]
          : [],
      };
    },
    async getDelinquencyReport() {
      return { count: 0, evolution: [], items: [], portfolioValue: 0, summary: {} };
    },
    async getPixReport() {
      const state = getState();
      return {
        count: state.payment ? 1 : 0,
        items: [],
        summary: state.payment
          ? [
              {
                conciliados: state.payment.status === "PAGO" ? 1 : 0,
                quantidade: 1,
                status: state.payment.status,
                valor: state.payment.amount,
              },
            ]
          : [],
      };
    },
    async getAutomationsReport() {
      return { evolution: [], summary: [] };
    },
  };
}

async function complete(harness) {
  await harness.enroll();
  return harness.settle();
}

test("complete Enrollment to BI happy path", async () => {
  const harness = createHarness();
  await complete(harness);
  const report = await harness.report.getConsolidated({ from: "2026-07-01", to: "2026-07-31" });
  assert.equal(harness.getState().obligation.status, "PAID");
  assert.equal(report.financeiro.receitas, 250);
  assert.equal(report.mensalidades.pagas.quantidade, 1);
  assert.equal(report.pix.pagos.quantidade, 1);
  assert.equal(report.pix.conciliacoes, 1);
});

test("complete flow retry reuses obligation, bridge and charge", async () => {
  const harness = createHarness();
  await harness.enroll();
  await harness.enroll();
  assert.equal(harness.getMaterializations(), 1);
  assert.equal(harness.getState().obligation.id, "obligation-integrated");
});

test("complete flow rolls back on reconciliation failure", async () => {
  const harness = createHarness({ failReconciliation: true });
  await harness.enroll();
  await assert.rejects(harness.settle, /integrated reconciliation failure/);
  assert.equal(harness.getState().payment, null);
  assert.equal(harness.getState().obligation.status, "PREPARED");
});

test("concurrent enrollment and settlement converge", async () => {
  const harness = createHarness();
  await Promise.all([harness.enroll(), harness.enroll()]);
  await Promise.all(Array.from({ length: 6 }, () => harness.settle()));
  assert.equal(harness.getMaterializations(), 1);
  assert.equal(Object.keys(harness.getState().history).length, 1);
});

test("duplicate settlements keep one payment", async () => {
  const harness = createHarness();
  await complete(harness);
  await harness.settle();
  assert.equal(Object.keys(harness.getState().history).length, 1);
});

test("partial payment fails without settlement", async () => {
  const harness = createHarness();
  await harness.enroll();
  await assert.rejects(() => harness.settle({ paidAmount: 100 }), {
    code: "CANONICAL_PARTIAL_PAYMENT_REJECTED",
  });
  assert.equal(harness.getState().payment, null);
});

test("cancellation propagates after issuance", async () => {
  const harness = createHarness();
  await complete(harness);
  await harness.reconcile("CANCELLED");
  assert.equal(harness.getState().obligation.status, "CANCELLED");
  assert.equal(Object.keys(harness.getState().history).length, 0);
});

test("missing bridge fails closed", async () => {
  const harness = createHarness();
  await harness.enroll();
  harness.getState().bridge = null;
  await assert.rejects(harness.settle, { code: "CANONICAL_FINANCIAL_BRIDGE_NOT_FOUND" });
});

test("cancelled obligation rejects settlement", async () => {
  const harness = createHarness();
  await harness.enroll();
  harness.getState().obligation.status = "CANCELLED";
  await assert.rejects(harness.settle, { code: "CANONICAL_FINANCIAL_OBLIGATION_CANCELLED" });
});

test("repeated reconciliation remains idempotent", async () => {
  const harness = createHarness();
  await complete(harness);
  await harness.reconcile("PAID");
  await harness.reconcile("PAID");
  assert.equal(Object.keys(harness.getState().history).length, 1);
});

test("repeated unified settlement remains idempotent", async () => {
  const harness = createHarness();
  await harness.enroll();
  for (let i = 0; i < 5; i += 1) await harness.settle();
  assert.equal(harness.getState().obligation.status, "PAID");
  assert.equal(Object.keys(harness.getState().history).length, 1);
});

test("BI reflects liquidation only after canonical settlement", async () => {
  const harness = createHarness();
  await harness.enroll();
  const before = await harness.report.getFinancial({ from: "2026-07-01", to: "2026-07-31" });
  await harness.settle();
  const after = await harness.report.getFinancial({ from: "2026-07-01", to: "2026-07-31" });
  assert.equal(before.receitas, 0);
  assert.equal(after.receitas, 250);
  assert.equal(after.saldo, 250);
});
