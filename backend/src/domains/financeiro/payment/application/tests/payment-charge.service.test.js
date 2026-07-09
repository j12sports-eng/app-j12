const assert = require("node:assert/strict");
const test = require("node:test");

const {
  PaymentChargeStatus,
  normalizePaymentChargeStatus,
} = require("../../entities/payment.entity.js");
const { PaymentGatewayFactory } = require("../services/payment-gateway.factory.js");
const {
  PAYMENT_CHARGE_INPUT_REQUIRED_CODE,
  PAYMENT_CHARGE_UPDATE_EMPTY_CODE,
  PAYMENT_PROVIDER_UNSUPPORTED_CODE,
} = require("../validators/payment.validators.js");
const { ChargeService } = require("../services/charge.service.js");

test("ChargeService creates a local gateway charge using selected provider interface", async () => {
  const repository = new FakePaymentRepository();
  const bancoInter = new FakeProvider("banco_inter");
  const service = createService(repository, [bancoInter]);

  const result = await service.createCharge({
    amount: "250.456",
    description: "Mensalidade Julho",
    dueDate: "2026-07-10",
    provider: "banco_inter",
    studentId: "aluno-1",
  });

  assert.equal(result.id, "fgc-1");
  assert.equal(result.amount, 250.46);
  assert.equal(result.currency, "BRL");
  assert.equal(result.provider, "banco_inter");
  assert.equal(result.status, PaymentChargeStatus.PENDING);
  assert.equal(result.gateway.providerIntegrated, false);
  assert.equal(result.gateway.status, "CREATECHARGE_PLANNED");
  assert.equal(bancoInter.calls.length, 1);
  assert.equal(repository.created[0].provider, "banco_inter");
});

test("PaymentChargeEntity normalizes removed Banco Inter charge as cancelled", () => {
  assert.equal(
    normalizePaymentChargeStatus("REMOVIDA_PELO_USUARIO_RECEBEDOR"),
    PaymentChargeStatus.CANCELLED,
  );
});

test("ChargeService updates charge data and keeps provider payload isolated", async () => {
  const repository = new FakePaymentRepository();
  const service = createService(repository, [new FakeProvider("banco_inter")]);
  const created = await service.createCharge({
    amount: 200,
    description: "Mensalidade",
    dueDate: "2026-07-10",
    provider: "banco_inter",
    studentId: "aluno-2",
  });

  const updated = await service.updateCharge({
    amount: 220,
    description: "Mensalidade atualizada",
    id: created.id,
    requestedBy: "admin@j12.local",
    status: "ISSUED",
  });

  assert.equal(updated.amount, 220);
  assert.equal(updated.description, "Mensalidade atualizada");
  assert.equal(updated.status, PaymentChargeStatus.ISSUED);
  assert.equal(updated.updatedBy, "admin@j12.local");
  assert.equal(updated.gateway.status, "UPDATECHARGE_PLANNED");
});

test("ChargeService cancels charges through the common provider interface", async () => {
  const repository = new FakePaymentRepository();
  const provider = new FakeProvider("asaas");
  const service = createService(repository, [provider]);
  const created = await service.createCharge({
    amount: 180,
    description: "Cobranca avulsa",
    dueDate: "2026-07-15",
    provider: "asaas",
    studentId: "aluno-3",
  });

  const cancelled = await service.cancelCharge({
    cancelledBy: "admin@j12.local",
    id: created.id,
    reason: "cancelamento solicitado",
  });

  assert.equal(cancelled.status, PaymentChargeStatus.CANCELLED);
  assert.equal(cancelled.cancelledBy, "admin@j12.local");
  assert.equal(cancelled.cancellationReason, "cancelamento solicitado");
  assert.deepEqual(
    provider.calls.map((call) => call.action),
    ["createCharge", "cancelCharge"],
  );
});

test("ChargeService supports switching providers without changing callers", async () => {
  const repository = new FakePaymentRepository();
  const bancoInter = new FakeProvider("banco_inter");
  const mercadoPago = new FakeProvider("mercado_pago");
  const service = createService(repository, [bancoInter, mercadoPago]);
  const created = await service.createCharge({
    amount: 190,
    description: "Mensalidade",
    dueDate: "2026-07-20",
    provider: "banco_inter",
    studentId: "aluno-4",
  });

  const updated = await service.updateCharge({
    id: created.id,
    provider: "mercado_pago",
  });

  assert.equal(updated.provider, "mercado_pago");
  assert.equal(bancoInter.calls.length, 1);
  assert.equal(mercadoPago.calls.length, 1);
  assert.equal(mercadoPago.calls[0].action, "updateCharge");
});

test("ChargeService validates required fields and provider support", async () => {
  const service = createService(new FakePaymentRepository(), [new FakeProvider("banco_inter")]);

  await assert.rejects(
    () =>
      service.createCharge({
        description: "Sem valor",
        dueDate: "2026-07-10",
        provider: "banco_inter",
        studentId: "aluno-5",
      }),
    { code: PAYMENT_CHARGE_INPUT_REQUIRED_CODE },
  );

  await assert.rejects(
    () =>
      service.createCharge({
        amount: 100,
        description: "Provider invalido",
        dueDate: "2026-07-10",
        provider: "stone",
        studentId: "aluno-5",
      }),
    { code: PAYMENT_PROVIDER_UNSUPPORTED_CODE },
  );

  await assert.rejects(
    () =>
      service.updateCharge({
        id: "fgc-empty",
      }),
    { code: PAYMENT_CHARGE_UPDATE_EMPTY_CODE },
  );
});

function createService(repository, providers) {
  return new ChargeService({
    gatewayFactory: new PaymentGatewayFactory({ providers }),
    repository,
  });
}

class FakeProvider {
  constructor(id) {
    this.id = id;
    this.calls = [];
  }

  async createCharge(input) {
    return this.record("createCharge", input);
  }

  async updateCharge(input) {
    return this.record("updateCharge", input);
  }

  async cancelCharge(input) {
    return this.record("cancelCharge", input);
  }

  async getCharge(input) {
    return this.record("getCharge", input);
  }

  async listPayments(input) {
    return {
      ...this.record("listPayments", input),
      items: [],
    };
  }

  record(action, input) {
    this.calls.push({ action, input });

    return {
      action,
      externalId: `${this.id}-${action}`,
      integrated: false,
      provider: this.id,
      status: `${action.toUpperCase()}_PLANNED`,
    };
  }
}

class FakePaymentRepository {
  constructor() {
    this.created = [];
    this.records = new Map();
    this.sequence = 0;
  }

  async createCharge(input) {
    this.sequence += 1;
    const record = {
      ...input,
      createdAt: "2026-07-09 10:00:00",
      id: input.id || `fgc-${this.sequence}`,
      updatedAt: "2026-07-09 10:00:00",
    };

    this.created.push(record);
    this.records.set(record.id, record);
    return record;
  }

  async listCharges() {
    return {
      items: Array.from(this.records.values()),
      total: this.records.size,
    };
  }

  async findChargeById(id) {
    return this.records.get(id) || null;
  }

  async updateCharge(input) {
    const existing = this.records.get(input.id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...input.patch,
      updatedBy: input.updatedBy,
    };

    this.records.set(input.id, updated);
    return updated;
  }

  async cancelCharge(input) {
    const existing = this.records.get(input.id);
    if (!existing) return null;

    const cancelled = {
      ...existing,
      cancelledBy: input.cancelledBy,
      cancellationReason: input.reason,
      providerPayload: input.providerPayload,
      status: PaymentChargeStatus.CANCELLED,
    };

    this.records.set(input.id, cancelled);
    return cancelled;
  }
}
