const assert = require("node:assert/strict");
const test = require("node:test");

const { MySqlInterRepository } = require("./mysql-inter.repository.js");

function createHarness(options = {}) {
  let state = {
    bridge: options.missingBridge
      ? null
      : { obligation_id: "obligation-canonical", status: "PENDING" },
    charge: { status: "pendente" },
    history: new Map(),
    installment: { status: "pendente" },
    obligation: { status: "PENDING" },
    payment: options.missingPayment
      ? null
      : {
          amount: "250.00",
          charge_id: "charge-canonical",
          id: "financial-payment-canonical",
          mensalidade_id: "installment-canonical",
          status: "PENDENTE",
          student_id: "legacy-student-canonical",
          txid: "TXID-CANONICAL",
        },
  };
  let tail = Promise.resolve();

  const query = async (sql, params = []) => {
    if (/SELECT \* FROM financial_payments.*FOR UPDATE/s.test(sql)) {
      return state.payment ? [state.payment] : [];
    }
    if (/FROM enrollment_financial_bridges/.test(sql)) {
      return state.bridge ? [state.bridge] : [];
    }
    if (/UPDATE financial_payments/.test(sql)) {
      state.payment.status = params[0];
      state.payment.paid_at = params[1];
      return { affectedRows: 1 };
    }
    if (/UPDATE j12_financeiro_cobrancas/.test(sql)) {
      state.charge.status = params[0];
      return { affectedRows: 1 };
    }
    if (/UPDATE j12_mensalidades/.test(sql)) {
      state.installment.status = params[0];
      return { affectedRows: 1 };
    }
    if (/INSERT INTO j12_pagamentos/.test(sql)) {
      state.history.set(params[1], { amount: params[4], id: params[0] });
      return { affectedRows: 1 };
    }
    if (/DELETE FROM j12_pagamentos/.test(sql)) {
      state.history.clear();
      return { affectedRows: 1 };
    }
    if (/UPDATE enrollment_financial_bridges/.test(sql)) {
      state.bridge.status = params[0];
      return { affectedRows: 1 };
    }
    if (/UPDATE enrollment_financial_obligations/.test(sql)) {
      if (options.failAtObligation) throw new Error("obligation update failure");
      state.obligation.status = params[0];
      return { affectedRows: 1 };
    }
    if (/SELECT \* FROM financial_payments/.test(sql)) {
      return state.payment ? [state.payment] : [];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const transactionRunner = (work) => {
    const execute = async () => {
      const snapshot = cloneState(state);
      try {
        return await work(query);
      } catch (error) {
        state = snapshot;
        throw error;
      }
    };
    const result = tail.then(execute, execute);
    tail = result.catch(() => undefined);
    return result;
  };

  const repository = new MySqlInterRepository({ queryRunner: query, transactionRunner });
  const reconcile = (input = {}) =>
    repository.reconcilePayment({
      paidAt: "2026-07-15T12:00:00Z",
      payment: { txid: "TXID-CANONICAL" },
      receivedAmount: 250,
      status: "PAID",
      ...input,
    });

  return { getState: () => state, reconcile };
}

function cloneState(state) {
  return {
    bridge: state.bridge ? { ...state.bridge } : null,
    charge: { ...state.charge },
    history: new Map(state.history),
    installment: { ...state.installment },
    obligation: { ...state.obligation },
    payment: state.payment ? { ...state.payment } : null,
  };
}

test("approved payment propagates PAID through all canonical records", async () => {
  const harness = createHarness();
  await harness.reconcile();
  const state = harness.getState();
  assert.equal(state.payment.status, "PAGO");
  assert.equal(state.history.size, 1);
  assert.equal(state.bridge.status, "PAID");
  assert.equal(state.obligation.status, "PAID");
});

test("retry reuses the same j12 payment", async () => {
  const harness = createHarness();
  await harness.reconcile();
  await harness.reconcile();
  assert.equal(harness.getState().history.size, 1);
});

test("duplicate confirmations converge to one payment history", async () => {
  const harness = createHarness();
  await Promise.all([harness.reconcile(), harness.reconcile()]);
  assert.equal(harness.getState().history.size, 1);
});

test("failure after intermediate writes rolls the transaction back", async () => {
  const harness = createHarness({ failAtObligation: true });
  await assert.rejects(harness.reconcile, /obligation update failure/);
  const state = harness.getState();
  assert.equal(state.payment.status, "PENDENTE");
  assert.equal(state.history.size, 0);
  assert.equal(state.bridge.status, "PENDING");
});

test("cancellation removes payment history and propagates CANCELLED", async () => {
  const harness = createHarness();
  await harness.reconcile();
  await harness.reconcile({ status: "CANCELLED" });
  const state = harness.getState();
  assert.equal(state.payment.status, "CANCELADO");
  assert.equal(state.history.size, 0);
  assert.equal(state.bridge.status, "CANCELLED");
  assert.equal(state.obligation.status, "CANCELLED");
});

test("partial payment is rejected before any write", async () => {
  const harness = createHarness();
  await assert.rejects(() => harness.reconcile({ receivedAmount: 100 }), {
    code: "CANONICAL_PARTIAL_PAYMENT_REJECTED",
  });
  assert.equal(harness.getState().payment.status, "PENDENTE");
  assert.equal(harness.getState().history.size, 0);
});

test("missing financial payment fails closed", async () => {
  const harness = createHarness({ missingPayment: true });
  await assert.rejects(harness.reconcile, { code: "CANONICAL_FINANCIAL_PAYMENT_NOT_FOUND" });
  assert.equal(harness.getState().history.size, 0);
});

test("missing bridge fails closed and rolls back", async () => {
  const harness = createHarness({ missingBridge: true });
  await assert.rejects(harness.reconcile, { code: "CANONICAL_FINANCIAL_BRIDGE_NOT_FOUND" });
  assert.equal(harness.getState().payment.status, "PENDENTE");
});

test("concurrent reconciliation is serialized and retry-safe", async () => {
  const harness = createHarness();
  const results = await Promise.all(Array.from({ length: 8 }, () => harness.reconcile()));
  assert.equal(results.length, 8);
  assert.equal(harness.getState().history.size, 1);
  assert.equal(harness.getState().obligation.status, "PAID");
});

test("PENDING, OVERDUE and FAILED propagation remains idempotent", async () => {
  const harness = createHarness();
  for (const status of ["PENDING", "OVERDUE", "FAILED", "FAILED"]) {
    await harness.reconcile({ receivedAmount: null, status });
  }
  const state = harness.getState();
  assert.equal(state.payment.status, "CANCELADO");
  assert.equal(state.history.size, 0);
  assert.equal(state.bridge.status, "FAILED");
  assert.equal(state.obligation.status, "FAILED");
});
