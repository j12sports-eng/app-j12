const assert = require("node:assert/strict");
const test = require("node:test");

const {
  INTER_CHARGE_NOT_FOUND_CODE,
  INTER_PAYMENT_NOT_FOUND_CODE,
  INTER_WEBHOOK_SIGNATURE_INVALID_CODE,
  InterApplicationService,
} = require("../services/inter-application.service.js");
const {
  InterPaymentStatus,
  normalizeInterPaymentStatus,
} = require("../../entities/inter-payment.entity.js");

test("InterPaymentEntity normalizes removed Banco Inter charge as cancelled", () => {
  assert.equal(
    normalizeInterPaymentStatus("REMOVIDA_PELO_USUARIO_RECEBEDOR"),
    InterPaymentStatus.CANCELLED,
  );
});

test("InterApplicationService issues Pix charge and stores local Inter payment", async () => {
  const repository = new FakeInterRepository();
  repository.seedCharge({
    amount: 250,
    chargeId: "cob-1",
    dueDate: "2026-07-10",
    mensalidadeId: "men-1",
    responsibleCpf: "12345678909",
    responsibleName: "Responsavel",
    studentId: "aluno-1",
    studentName: "Aluno J12",
  });
  const client = new FakeInterClient();
  const service = new InterApplicationService({ client, repository });

  const result = await service.emitirCobranca({
    cobrancaId: "cob-1",
  });

  assert.equal(result.cobrancaId, "cob-1");
  assert.equal(result.mensalidadeId, "men-1");
  assert.equal(result.bancoInter.txid, "TXID-1");
  assert.equal(result.bancoInter.pixCopiaCola, "pix-copy");
  assert.equal(result.bancoInter.linkPagamento, "https://inter.test/pagar/TXID-1");
  assert.equal(repository.savedCharges.length, 1);
  assert.equal(client.createdCharges[0].amount, 250);
});

test("InterApplicationService consults Inter charge and reconciles paid status", async () => {
  const repository = new FakeInterRepository();
  repository.seedPayment({
    amount: 250,
    chargeId: "cob-paid",
    mensalidadeId: "men-paid",
    status: InterPaymentStatus.PENDING,
    txid: "TXID-PAID",
  });
  const client = new FakeInterClient();
  client.seedRemoteCharge("TXID-PAID", {
    pix: [
      {
        endToEndId: "E2E-PAID",
        horario: "2026-07-09T10:00:00Z",
        id: "inter-paid",
      },
    ],
    status: "CONCLUIDA",
  });
  const service = new InterApplicationService({ client, repository });

  const result = await service.consultarCobranca({ id: "cob-paid" });

  assert.equal(result.pagamento.status, InterPaymentStatus.PAID);
  assert.equal(result.pagamento.e2eid, "E2E-PAID");
  assert.equal(repository.reconciliations.length, 1);
  assert.equal(repository.reconciliations[0].status, InterPaymentStatus.PAID);
});

test("InterApplicationService synchronizes open payments and records paid/cancelled/expired statuses", async () => {
  const repository = new FakeInterRepository();
  repository.seedPayment({ status: InterPaymentStatus.PENDING, txid: "TXID-SYNC-PAID" });
  repository.seedPayment({ status: InterPaymentStatus.PENDING, txid: "TXID-SYNC-CANCEL" });
  repository.seedPayment({ status: InterPaymentStatus.PENDING, txid: "TXID-SYNC-EXPIRED" });
  const client = new FakeInterClient();
  client.seedRemoteCharge("TXID-SYNC-PAID", { pix: [{ endToEndId: "E2E" }] });
  client.seedRemoteCharge("TXID-SYNC-CANCEL", { status: "REMOVIDA_PELO_USUARIO_RECEBEDOR" });
  client.seedRemoteCharge("TXID-SYNC-EXPIRED", { status: "EXPIRADA" });
  const service = new InterApplicationService({ client, repository });

  const result = await service.sincronizar({ limit: 10 });

  assert.equal(result.consultados, 3);
  assert.equal(result.sincronizados, 3);
  assert.equal(result.liquidados, 1);
  assert.deepEqual(
    repository.reconciliations.map((item) => item.status),
    [InterPaymentStatus.PAID, InterPaymentStatus.CANCELLED, InterPaymentStatus.EXPIRED],
  );
});

test("InterApplicationService processes webhook confirmations, cancellations, expirations and refunds", async () => {
  const repository = new FakeInterRepository();
  repository.seedPayment({ status: InterPaymentStatus.PENDING, txid: "TXID-WH-PAID" });
  repository.seedPayment({ status: InterPaymentStatus.PENDING, txid: "TXID-WH-CANCEL" });
  repository.seedPayment({ status: InterPaymentStatus.PENDING, txid: "TXID-WH-EXPIRED" });
  repository.seedPayment({ status: InterPaymentStatus.PAID, txid: "TXID-WH-REFUND" });
  const service = new InterApplicationService({
    client: new FakeInterClient(),
    repository,
    webhookSecret: "secret",
  });

  const result = await service.processarWebhook({
    body: {
      eventos: [
        { endToEndId: "E2E-1", txid: "TXID-WH-PAID" },
        { status: "REMOVIDA_PELO_USUARIO_RECEBEDOR", txid: "TXID-WH-CANCEL" },
        { status: "EXPIRADA", txid: "TXID-WH-EXPIRED" },
        { devolucoes: [{ id: "dev-1" }], txid: "TXID-WH-REFUND" },
      ],
    },
    headers: {
      "x-inter-token": "secret",
    },
  });

  assert.equal(result.validacao, "shared-secret");
  assert.equal(result.processados, 4);
  assert.equal(result.erros, 0);
  assert.deepEqual(
    repository.reconciliations.map((item) => item.status),
    [
      InterPaymentStatus.PAID,
      InterPaymentStatus.CANCELLED,
      InterPaymentStatus.EXPIRED,
      InterPaymentStatus.REFUNDED,
    ],
  );
});

test("InterApplicationService rejects invalid webhook signature and missing local records", async () => {
  const repository = new FakeInterRepository();
  const service = new InterApplicationService({
    client: new FakeInterClient(),
    repository,
    webhookSecret: "secret",
  });

  await assert.rejects(
    () =>
      service.processarWebhook({
        body: { pix: [{ txid: "TXID" }] },
        headers: { "x-inter-token": "wrong" },
      }),
    { code: INTER_WEBHOOK_SIGNATURE_INVALID_CODE },
  );

  const result = await service.processarWebhook({
    body: { pix: [{ txid: "missing" }] },
    headers: { "x-inter-token": "secret" },
  });

  assert.equal(result.erros, 1);
});

test("InterApplicationService exposes controlled errors for missing charge and payment", async () => {
  const service = new InterApplicationService({
    client: new FakeInterClient(),
    repository: new FakeInterRepository(),
  });

  await assert.rejects(() => service.emitirCobranca({ cobrancaId: "missing" }), {
    code: INTER_CHARGE_NOT_FOUND_CODE,
  });
  await assert.rejects(() => service.consultarCobranca({ id: "missing" }), {
    code: INTER_PAYMENT_NOT_FOUND_CODE,
  });
});

class FakeInterClient {
  constructor() {
    this.createdCharges = [];
    this.remoteCharges = new Map();
  }

  seedRemoteCharge(txid, payload) {
    this.remoteCharges.set(txid, payload);
  }

  async createPixCharge(input) {
    this.createdCharges.push(input);
    return {
      interCharge: { status: "ATIVA" },
      paymentLink: "https://inter.test/pagar/TXID-1",
      pixCopyPaste: "pix-copy",
      qrCode: "qr-code",
      requestPayload: { amount: input.amount },
      responsePayload: { status: "ATIVA" },
      txid: "TXID-1",
    };
  }

  async getPixCharge(txid) {
    return this.remoteCharges.get(txid) || { status: "ATIVA" };
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
    const record = {
      amount: payment.amount ?? 100,
      chargeId: payment.chargeId ?? null,
      e2eid: payment.e2eid ?? null,
      id: payment.id || payment.txid,
      mensalidadeId: payment.mensalidadeId ?? null,
      status: payment.status || InterPaymentStatus.PENDING,
      txid: payment.txid,
    };
    this.payments.set(record.txid, record);
    if (record.chargeId) this.payments.set(record.chargeId, record);
    if (record.id) this.payments.set(record.id, record);
  }

  async findChargeForInter(input) {
    return (
      this.charges.get(input.chargeId) ||
      this.charges.get(input.mensalidadeId) ||
      this.charges.get(input.id) ||
      null
    );
  }

  async saveIssuedCharge(input) {
    this.savedCharges.push(input);
    const payment = {
      amount: input.charge.amount,
      chargeId: input.charge.chargeId,
      id: input.txid,
      mensalidadeId: input.charge.mensalidadeId,
      pixCopyPaste: input.pixCopyPaste,
      qrCode: input.qrCode,
      status: InterPaymentStatus.PENDING,
      txid: input.txid,
    };
    this.seedPayment(payment);
    return payment;
  }

  async findPayment(input) {
    return this.payments.get(input.id) || this.payments.get(input.txid) || null;
  }

  async findPaymentByTxid(txid) {
    return this.payments.get(txid) || null;
  }

  async listOpenPayments() {
    return Array.from(new Set(this.payments.values())).filter((payment) =>
      [InterPaymentStatus.PENDING, InterPaymentStatus.PROCESSING].includes(payment.status),
    );
  }

  async recordWebhookEvent(input) {
    const event = this.events.get(input.eventHash) || {
      event_hash: input.eventHash,
      processed: 0,
    };
    this.events.set(input.eventHash, event);
    return event;
  }

  async markWebhookEventProcessed(input) {
    const event = this.events.get(input.eventHash) || {};
    event.processed = input.error ? 0 : 1;
    event.error = input.error || null;
    this.events.set(input.eventHash, event);
  }

  async reconcilePayment(input) {
    this.reconciliations.push(input);
    const payment = {
      ...input.payment,
      e2eid: input.e2eid || input.payment.e2eid || null,
      status: input.status,
    };
    this.seedPayment(payment);
    return payment;
  }
}
