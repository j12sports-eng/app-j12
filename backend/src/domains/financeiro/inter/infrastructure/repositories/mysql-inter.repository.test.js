const assert = require("node:assert/strict");
const test = require("node:test");

const { MySqlInterRepository } = require("./mysql-inter.repository.js");
const { InterPaymentStatus } = require("../../entities/inter-payment.entity.js");

test("MySqlInterRepository loads charges from financial charge and mensalidade tables", async () => {
  const calls = [];
  const queryRunner = async (sql, params = []) => {
    calls.push({ params, sql });

    if (sql.includes("FROM j12_financeiro_cobrancas")) {
      return [
        {
          aluno_id: "aluno-1",
          id: "cob-1",
          nome_aluno: "Aluno",
          responsavel_cpf: "12345678909",
          responsavel_financeiro: "Responsavel",
          valor_final: "199.90",
          vencimento: "2026-07-10",
        },
      ];
    }

    return [];
  };
  const repository = new MySqlInterRepository({
    queryRunner,
    transactionRunner: createPassthroughTransaction(queryRunner),
  });

  const charge = await repository.findChargeForInter({ chargeId: "cob-1" });

  assert.equal(charge.chargeId, "cob-1");
  assert.equal(charge.amount, 199.9);
  assert.equal(charge.studentId, "aluno-1");
  assert.equal(calls[0].params[0], "cob-1");
});

test("MySqlInterRepository saves issued Pix payment using financial_payments mirror", async () => {
  const calls = [];
  const row = {
    amount: "150.00",
    charge_id: "cob-save",
    id: "fpi-fixed",
    mensalidade_id: "men-save",
    pix_copy_paste: "pix-copy",
    qr_code: "qr-code",
    status: "PENDENTE",
    txid: "TXID-SAVE",
  };
  const queryRunner = async (sql, params = []) => {
    calls.push({ params, sql });

    if (sql.includes("SELECT *") && sql.includes("WHERE txid = ?")) {
      return [row];
    }

    return { affectedRows: 1 };
  };
  const repository = new MySqlInterRepository({
    idGenerator: () => "fpi-fixed",
    queryRunner,
    transactionRunner: createPassthroughTransaction(queryRunner),
  });

  const payment = await repository.saveIssuedCharge({
    charge: {
      amount: 150,
      chargeId: "cob-save",
      dueDate: "2026-07-10",
      mensalidadeId: "men-save",
      studentId: "aluno-save",
    },
    interCharge: { status: "ATIVA" },
    pixCopyPaste: "pix-copy",
    qrCode: "qr-code",
    requestPayload: { request: true },
    txid: "TXID-SAVE",
  });

  assert.equal(payment.txid, "TXID-SAVE");
  assert.equal(payment.status, InterPaymentStatus.PENDING);
  assert.equal(
    calls.some((call) => call.sql.includes("INSERT INTO financial_payments")),
    true,
  );
  assert.equal(calls[0].params[0], "fpi-fixed");
});

test("MySqlInterRepository reconciles paid payment into payment, charge, mensalidade and history tables", async () => {
  const calls = [];
  const row = {
    amount: "120.00",
    charge_id: "cob-paid",
    e2eid: "E2E",
    id: "fpi-paid",
    mensalidade_id: "men-paid",
    paid_at: "2026-07-09 12:00:00",
    status: "PAGO",
    student_id: "aluno-paid",
    txid: "TXID-PAID",
  };
  const queryRunner = async (sql, params = []) => {
    calls.push({ params, sql });

    if (sql.includes("SELECT *") && sql.includes("WHERE txid = ?")) {
      return [row];
    }

    return { affectedRows: 1 };
  };
  const repository = new MySqlInterRepository({
    queryRunner,
    transactionRunner: createPassthroughTransaction(queryRunner),
  });

  const payment = await repository.reconcilePayment({
    e2eid: "E2E",
    paidAt: "2026-07-09T12:00:00Z",
    payment: {
      amount: 120,
      chargeId: "cob-paid",
      mensalidadeId: "men-paid",
      studentId: "aluno-paid",
      txid: "TXID-PAID",
    },
    status: InterPaymentStatus.PAID,
  });

  assert.equal(payment.status, InterPaymentStatus.PAID);
  assert.equal(
    calls.some((call) => /UPDATE financial_payments/.test(call.sql)),
    true,
  );
  assert.equal(
    calls.some((call) => /UPDATE j12_financeiro_cobrancas/.test(call.sql)),
    true,
  );
  assert.equal(
    calls.some((call) => /UPDATE j12_mensalidades/.test(call.sql)),
    true,
  );
  assert.equal(
    calls.some((call) => /INSERT INTO j12_pagamentos/.test(call.sql)),
    true,
  );
});

test("MySqlInterRepository records webhook events and marks failures without throwing", async () => {
  const rows = new Map();
  const queryRunner = async (sql, params = []) => {
    if (sql.includes("INSERT IGNORE INTO inter_webhook_events")) {
      rows.set(params[1], {
        error: null,
        event_hash: params[1],
        processed: 0,
      });
      return { affectedRows: 1 };
    }

    if (sql.includes("UPDATE inter_webhook_events")) {
      rows.set(params[2], {
        error: params[1],
        event_hash: params[2],
        processed: params[0],
      });
      return { affectedRows: 1 };
    }

    if (sql.includes("SELECT *")) {
      return [rows.get(params[0])].filter(Boolean);
    }

    return [];
  };
  const repository = new MySqlInterRepository({
    idGenerator: () => "iwe-fixed",
    queryRunner,
    transactionRunner: createPassthroughTransaction(queryRunner),
  });

  const event = await repository.recordWebhookEvent({
    eventHash: "hash-1",
    payload: { pix: [] },
    txid: "TXID",
  });
  await repository.markWebhookEventProcessed({
    error: "missing payment",
    eventHash: "hash-1",
  });
  const updated = await repository.findWebhookEvent("hash-1");

  assert.equal(event.event_hash, "hash-1");
  assert.equal(updated.processed, 0);
  assert.equal(updated.error, "missing payment");
});

function createPassthroughTransaction(queryRunner) {
  return async (work) => work(queryRunner);
}
