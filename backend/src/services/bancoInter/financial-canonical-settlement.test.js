const assert = require("node:assert/strict");
const test = require("node:test");

const { pagarMensalidade } = require("../../controllers/financeiro.controller.js");
const { markManualPaymentAsPaid, settleCanonicalPayment } = require("./financial.js");

function createHarness(options = {}) {
  let state = {
    bridge: options.missingBridge
      ? null
      : {
          charge_id: "charge-unified",
          installment_id: "installment-unified",
          legacy_student_id: "legacy-unified",
          obligation_amount: 250,
          obligation_id: "obligation-unified",
          obligation_status: options.obligationStatus || "PENDING",
          installment_amount: 250,
          data_vencimento: "2026-07-20",
        },
    financialPayment: null,
    history: new Map(),
    obligationStatus: options.obligationStatus || "PENDING",
  };
  let reconciliations = 0;
  let tail = Promise.resolve();

  const connection = {
    async execute(sql, params = []) {
      if (/FROM enrollment_financial_bridges/.test(sql)) {
        if (!state.bridge) return [[]];
        return [
          [
            {
              ...state.bridge,
              financial_payment_amount: state.financialPayment?.amount ?? null,
              financial_payment_id: state.financialPayment?.id ?? null,
              financial_payment_txid: state.financialPayment?.txid ?? null,
            },
          ],
        ];
      }
      if (/INSERT INTO financial_payments/.test(sql)) {
        state.financialPayment = {
          amount: params[5],
          chargeId: params[3],
          id: params[0],
          mensalidadeId: params[2],
          studentId: params[1],
          txid: params[4],
        };
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };

  const transactionRunner = (work) => {
    const execute = async () => {
      const snapshot = cloneState(state);
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

  const reconcilePayment = async (_connection, input) => {
    reconciliations += 1;
    if (options.reconcileFailure) throw new Error("canonical reconciliation failure");
    state.history.set(input.payment.txid, { amount: input.receivedAmount });
    state.obligationStatus = "PAID";
    return { ...input.payment, status: "PAGO" };
  };

  const dependencies = { reconcilePayment, transactionRunner };
  const manual = (input = {}) =>
    markManualPaymentAsPaid(
      {
        installmentId: "installment-unified",
        paidAmount: 250,
        paidAt: "2026-07-15",
        ...input,
      },
      dependencies,
    );
  const automatic = () =>
    settleCanonicalPayment(
      {
        paidAt: "2026-07-15",
        payment: {
          amount: 250,
          chargeId: "charge-unified",
          mensalidadeId: "installment-unified",
          txid: "AUTO-TXID",
        },
      },
      dependencies,
    );

  return { automatic, getReconciliations: () => reconciliations, getState: () => state, manual };
}

function cloneState(state) {
  return {
    bridge: state.bridge ? { ...state.bridge } : null,
    financialPayment: state.financialPayment ? { ...state.financialPayment } : null,
    history: new Map(state.history),
    obligationStatus: state.obligationStatus,
  };
}

test("manual settlement delegates without payment SQL in the controller", async () => {
  assert.match(pagarMensalidade.toString(), /markManualPaymentAsPaid/);
  assert.doesNotMatch(pagarMensalidade.toString(), /INSERT INTO j12_pagamentos/);
  const harness = createHarness();
  const result = await harness.manual();
  assert.equal(result.status, "PAGO");
  assert.equal(harness.getState().history.size, 1);
});

test("automatic settlement uses the same canonical reconciler", async () => {
  const harness = createHarness();
  const result = await harness.automatic();
  assert.equal(result.status, "PAGO");
  assert.equal(harness.getReconciliations(), 1);
});

test("manual retry reuses the deterministic financial payment", async () => {
  const harness = createHarness();
  const first = await harness.manual();
  const retry = await harness.manual();
  assert.equal(first.txid, retry.txid);
  assert.equal(harness.getState().history.size, 1);
});

test("reconciliation failure rolls manual preparation back", async () => {
  const harness = createHarness({ reconcileFailure: true });
  await assert.rejects(harness.manual, /canonical reconciliation failure/);
  assert.equal(harness.getState().financialPayment, null);
  assert.equal(harness.getState().history.size, 0);
});

test("duplicate manual requests converge to one history entry", async () => {
  const harness = createHarness();
  await harness.manual();
  await harness.manual();
  assert.equal(harness.getState().history.size, 1);
});

test("concurrent manual requests are retry-safe", async () => {
  const harness = createHarness();
  const results = await Promise.all(Array.from({ length: 8 }, () => harness.manual()));
  assert.equal(new Set(results.map((result) => result.txid)).size, 1);
  assert.equal(harness.getState().history.size, 1);
});

test("missing bridge fails before financial payment creation", async () => {
  const harness = createHarness({ missingBridge: true });
  await assert.rejects(harness.manual, { code: "CANONICAL_FINANCIAL_BRIDGE_NOT_FOUND" });
  assert.equal(harness.getState().financialPayment, null);
});

test("cancelled obligation cannot receive manual settlement", async () => {
  const harness = createHarness({ obligationStatus: "CANCELLED" });
  await assert.rejects(harness.manual, { code: "CANONICAL_FINANCIAL_OBLIGATION_CANCELLED" });
  assert.equal(harness.getState().history.size, 0);
});

test("partial manual payment is rejected", async () => {
  const harness = createHarness();
  await assert.rejects(() => harness.manual({ paidAmount: 100 }), {
    code: "CANONICAL_PARTIAL_PAYMENT_REJECTED",
  });
  assert.equal(harness.getState().financialPayment, null);
});

test("repeated unified settlement remains idempotent", async () => {
  const harness = createHarness();
  for (let index = 0; index < 5; index += 1) await harness.manual();
  assert.equal(harness.getState().history.size, 1);
  assert.equal(harness.getState().obligationStatus, "PAID");
});
