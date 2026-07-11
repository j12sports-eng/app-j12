const assert = require("node:assert/strict");
const test = require("node:test");

const { InterPaymentStatus } = require("../../../../inter/entities/inter-payment.entity.js");
const { PaymentProviderInter } = require("../payment-provider-inter.js");
const { WebhookService } = require("../services/webhook.service.js");

test("PaymentProviderInter creates Pix charge and persists local Inter payment", async () => {
  const repository = new FakeInterRepository();
  repository.seedCharge({
    amount: 250,
    chargeId: "cob-1",
    description: "Mensalidade",
    dueDate: "2026-07-10",
    mensalidadeId: "men-1",
    studentId: "aluno-1",
    studentName: "Aluno",
  });
  const provider = new PaymentProviderInter({
    pixService: new FakePixService(),
    repository,
  });

  const result = await provider.createPix({ cobrancaId: "cob-1" });

  assert.equal(result.provider, "banco_inter");
  assert.equal(result.txid, "TXID-1");
  assert.equal(result.cobrancaId, "cob-1");
  assert.equal(result.mensalidadeId, "men-1");
  assert.equal(result.bancoInter.pixCopiaCola, "pix-copy");
  assert.equal(repository.savedCharges.length, 1);
});

test("PaymentProviderInter consults Pix and reconciles paid charge", async () => {
  const repository = new FakeInterRepository();
  repository.seedPayment({
    amount: 250,
    chargeId: "cob-paid",
    mensalidadeId: "men-paid",
    status: InterPaymentStatus.PENDING,
    txid: "TXID-PAID",
  });
  const provider = new PaymentProviderInter({
    pixService: new FakePixService({
      remoteCharge: {
        pix: [
          {
            endToEndId: "E2E-PAID",
            horario: "2026-07-09T10:00:00Z",
            id: "inter-paid",
          },
        ],
        status: "CONCLUIDA",
      },
    }),
    repository,
  });

  const result = await provider.getPix({ txid: "TXID-PAID" });

  assert.equal(result.pagamento.status, InterPaymentStatus.PAID);
  assert.equal(repository.reconciliations.length, 1);
  assert.equal(repository.reconciliations[0].status, InterPaymentStatus.PAID);
});

test("PaymentProviderInter blocks a paid status with divergent amount", async () => {
  const repository = new FakeInterRepository();
  repository.seedPayment({ amount: 250, status: InterPaymentStatus.PENDING, txid: "TXID-PARTIAL" });
  const provider = new PaymentProviderInter({
    pixService: new FakePixService({
      remoteCharge: {
        pix: [{ endToEndId: "E2E-PARTIAL", valor: "125.00" }],
        status: "CONCLUIDA",
      },
    }),
    repository,
  });

  await assert.rejects(() => provider.getPix({ txid: "TXID-PARTIAL" }), {
    code: "INTER_PROVIDER_PAYMENT_AMOUNT_MISMATCH",
  });
  assert.equal(repository.reconciliations.length, 0);
});

test("PaymentProviderInter cancels Pix and synchronizes open payments", async () => {
  const repository = new FakeInterRepository();
  repository.seedPayment({ status: InterPaymentStatus.PENDING, txid: "TXID-CANCEL" });
  repository.seedPayment({ status: InterPaymentStatus.PENDING, txid: "TXID-SYNC" });
  const provider = new PaymentProviderInter({
    pixService: new FakePixService({
      remoteCharge: {
        status: "REMOVIDA_PELO_USUARIO_RECEBEDOR",
      },
    }),
    repository,
  });

  const cancelled = await provider.cancelPix({ reason: "cancelado", txid: "TXID-CANCEL" });
  const synced = await provider.sync({ limit: 5 });

  assert.equal(cancelled.pagamento.status, InterPaymentStatus.CANCELLED);
  assert.equal(synced.consultados, 2);
  assert.equal(synced.sincronizados, 2);
  assert.deepEqual(
    repository.reconciliations.map((item) => item.status),
    [InterPaymentStatus.CANCELLED, InterPaymentStatus.CANCELLED, InterPaymentStatus.CANCELLED],
  );
});

test("WebhookService validates signature, reconciles payment and keeps idempotency", async () => {
  const repository = new FakeInterRepository();
  repository.seedPayment({ status: InterPaymentStatus.PENDING, txid: "TXID-WH" });
  const webhook = new WebhookService({
    repository,
    webhookSecret: "secret",
  });
  const input = {
    body: {
      pix: [
        {
          endToEndId: "E2E-WH",
          horario: "2026-07-09T10:00:00Z",
          txid: "TXID-WH",
        },
      ],
    },
    headers: {
      "x-inter-token": "secret",
    },
  };

  const first = await webhook.processWebhook(input);
  const duplicate = await webhook.processWebhook(input);

  assert.equal(first.processados, 1);
  assert.equal(first.erros, 0);
  assert.equal(duplicate.duplicados, 1);
  assert.equal(repository.reconciliations.length, 1);
  assert.equal(repository.reconciliations[0].status, InterPaymentStatus.PAID);
});

test("WebhookService rejects partial payment without marking the event processed", async () => {
  const repository = new FakeInterRepository();
  repository.seedPayment({ amount: 250, status: InterPaymentStatus.PENDING, txid: "TXID-WH-PART" });
  const webhook = new WebhookService({ repository, webhookSecret: "secret" });

  const result = await webhook.processWebhook({
    body: { pix: [{ txid: "TXID-WH-PART", valor: "200.00" }] },
    headers: { "x-inter-token": "secret" },
  });

  assert.equal(result.processados, 0);
  assert.equal(result.erros, 1);
  assert.equal(repository.reconciliations.length, 0);
});

class FakePixService {
  constructor(options = {}) {
    this.remoteCharge = options.remoteCharge || {
      pix: [{ endToEndId: "E2E-1", horario: "2026-07-09T10:00:00Z" }],
      status: "CONCLUIDA",
    };
  }

  async createPixCharge() {
    return {
      interCharge: { loc: { id: "LOC-1", location: "https://inter.test/pagar/TXID-1" } },
      paymentLink: "https://inter.test/pagar/TXID-1",
      pixCopyPaste: "pix-copy",
      qrCode: "data:image/png;base64,image",
      requestPayload: { request: true },
      responsePayload: { response: true },
      txid: "TXID-1",
    };
  }

  async getPixCharge() {
    return this.remoteCharge;
  }

  async cancelPixCharge() {
    return {
      status: "REMOVIDA_PELO_USUARIO_RECEBEDOR",
    };
  }
}

class FakeInterRepository {
  constructor() {
    this.charges = new Map();
    this.events = new Map();
    this.payments = new Map();
    this.reconciliations = [];
    this.savedCharges = [];
  }

  seedCharge(charge) {
    this.charges.set(charge.chargeId || charge.mensalidadeId || charge.id, charge);
  }

  seedPayment(payment) {
    this.payments.set(payment.txid, {
      amount: payment.amount || 250,
      chargeId: payment.chargeId || "cob-1",
      mensalidadeId: payment.mensalidadeId || "men-1",
      status: payment.status || InterPaymentStatus.PENDING,
      txid: payment.txid,
    });
  }

  async findChargeForInter(input) {
    return (
      this.charges.get(input.chargeId) ||
      this.charges.get(input.cobrancaId) ||
      this.charges.get(input.mensalidadeId) ||
      this.charges.get(input.id) ||
      null
    );
  }

  async saveIssuedCharge(input) {
    const payment = {
      amount: input.charge.amount,
      chargeId: input.charge.chargeId,
      mensalidadeId: input.charge.mensalidadeId,
      pixCopyPaste: input.pixCopyPaste,
      qrCode: input.qrCode,
      status: InterPaymentStatus.PENDING,
      txid: input.txid,
    };

    this.savedCharges.push(input);
    this.payments.set(payment.txid, payment);
    return payment;
  }

  async findPayment(input) {
    return this.findPaymentByTxid(input.id || input.txid);
  }

  async findPaymentByTxid(txid) {
    return this.payments.get(txid) || null;
  }

  async listOpenPayments() {
    return Array.from(this.payments.values());
  }

  async reconcilePayment(input) {
    this.reconciliations.push(input);
    const updated = {
      ...input.payment,
      e2eid: input.e2eid || input.payment.e2eid,
      paidAt: input.paidAt || input.payment.paidAt,
      status: input.status,
    };

    this.payments.set(updated.txid, updated);
    return updated;
  }

  async recordWebhookEvent(input) {
    const existing = this.events.get(input.eventHash);
    if (existing) return existing;

    const event = {
      ...input,
      processed: 0,
    };
    this.events.set(input.eventHash, event);
    return event;
  }

  async markWebhookEventProcessed(input) {
    const event = this.events.get(input.eventHash);
    if (!event) return;

    event.error = input.error || null;
    event.processed = input.error ? 0 : 1;
  }
}
