const assert = require("node:assert/strict");
const test = require("node:test");

const {
  FinancialAutomationEventStatus,
  FinancialAutomationEventType,
  FinancialAutomationTargetType,
} = require("../../entities/financial-automation-event.entity.js");
const {
  FinancialAutomationService,
  buildFinancialAutomationEventKey,
} = require("../services/financial-automation.service.js");

test("FinancialAutomationService lists upcoming installments and skips completed reminders", async () => {
  const sentKey = buildFinancialAutomationEventKey({
    daysOffset: 1,
    eventType: FinancialAutomationEventType.REMINDER_SENT,
    referenceDate: "2026-07-10",
    targetId: "men-sent",
    targetType: FinancialAutomationTargetType.INSTALLMENT,
  });
  const repository = new FakeAutomationRepository({
    events: [
      {
        eventKey: sentKey,
        eventType: FinancialAutomationEventType.REMINDER_SENT,
        status: FinancialAutomationEventStatus.COMPLETED,
        targetId: "men-sent",
        targetType: FinancialAutomationTargetType.INSTALLMENT,
      },
    ],
    upcoming: [
      installment({ daysOffset: 0, dueDate: "2026-07-09", mensalidadeId: "men-open" }),
      installment({ daysOffset: 1, dueDate: "2026-07-10", mensalidadeId: "men-sent" }),
    ],
  });
  const service = new FinancialAutomationService({ repository });

  const result = await service.listUpcomingInstallments({ referenceDate: "2026-07-09" });

  assert.equal(result.type, "vencimentos");
  assert.deepEqual(result.requestedWindows, [0, 1, 3, 7]);
  assert.equal(result.count, 1);
  assert.equal(result.items[0].mensalidadeId, "men-open");
  assert.equal(result.items[0].automation.eventType, FinancialAutomationEventType.REMINDER_SENT);
  assert.match(result.items[0].automation.eventKey, /LEMBRETE_ENVIADO/);
});

test("FinancialAutomationService lists overdue installments for fixed delinquency windows", async () => {
  const repository = new FakeAutomationRepository({
    overdue: [installment({ daysOffset: -3, dueDate: "2026-07-06", mensalidadeId: "men-late" })],
  });
  const service = new FinancialAutomationService({ repository });

  const result = await service.listOverdueInstallments({
    days: "3",
    referenceDate: "2026-07-09",
  });

  assert.equal(result.type, "inadimplentes");
  assert.deepEqual(result.requestedWindows, [3]);
  assert.equal(result.count, 1);
  assert.equal(result.items[0].mensalidadeId, "men-late");
  assert.equal(result.items[0].automation.eventType, FinancialAutomationEventType.CHARGE_SENT);
});

test("FinancialAutomationService lists confirmed, pending and cancelled payment groups", async () => {
  const repository = new FakeAutomationRepository({
    payments: [
      payment({ id: "pay-ok", status: "PAGO" }),
      payment({ id: "pay-pending", status: "PENDENTE" }),
      payment({ id: "pay-cancelled", status: "CANCELADO" }),
    ],
  });
  const service = new FinancialAutomationService({ repository });

  const result = await service.listPayments({ status: "confirmados,pendentes,cancelados" });
  const byId = new Map(result.items.map((item) => [item.id, item]));

  assert.equal(result.type, "pagamentos");
  assert.equal(result.count, 3);
  assert.equal(
    byId.get("pay-ok").automation.eventType,
    FinancialAutomationEventType.THANK_YOU_SENT,
  );
  assert.equal(
    byId.get("pay-pending").automation.eventType,
    FinancialAutomationEventType.CHARGE_ATTEMPT,
  );
  assert.equal(byId.get("pay-cancelled").automation.canSend, false);
});

test("FinancialAutomationService records events idempotently", async () => {
  const repository = new FakeAutomationRepository();
  const service = new FinancialAutomationService({ repository });
  const input = {
    eventType: "lembrete_enviado",
    referenceDate: "2026-07-09",
    targetId: "men-1",
    targetType: "mensalidade",
  };

  const first = await service.recordEvent(input);
  const duplicate = await service.recordEvent(input);

  assert.equal(first.created, true);
  assert.equal(first.reused, false);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.reused, true);
  assert.equal(repository.events.size, 1);
});

test("FinancialAutomationService stores send errors as failed events", async () => {
  const repository = new FakeAutomationRepository();
  const service = new FinancialAutomationService({ repository });

  const result = await service.recordEvent({
    errorMessage: "BotConversa indisponivel",
    eventType: "erro_envio",
    targetId: "men-erro",
    targetType: "mensalidade",
  });

  assert.equal(result.event.status, FinancialAutomationEventStatus.FAILED);
  assert.equal(result.event.errorMessage, "BotConversa indisponivel");
});

test("FinancialAutomationService processes Banco Inter sync and completes pending events", async () => {
  const repository = new FakeAutomationRepository({
    events: [
      {
        eventKey: "pending-payment",
        eventType: FinancialAutomationEventType.CHARGE_ATTEMPT,
        status: FinancialAutomationEventStatus.PENDING,
        targetId: "pay-paid",
        targetType: FinancialAutomationTargetType.PAYMENT,
      },
      {
        eventKey: "pending-charge",
        eventType: FinancialAutomationEventType.CHARGE_SENT,
        status: FinancialAutomationEventStatus.PENDING,
        targetId: "cob-paid",
        targetType: FinancialAutomationTargetType.CHARGE,
      },
    ],
    payments: [payment({ chargeId: "cob-paid", id: "pay-paid", status: "PAGO" })],
  });
  const interSyncService = new FakeInterSyncService();
  const service = new FinancialAutomationService({ interSyncService, repository });

  const result = await service.process({ limit: 10 });

  assert.equal(interSyncService.calls.length, 1);
  assert.equal(result.interSync.sincronizados, 1);
  assert.equal(result.paidPaymentsChecked, 1);
  assert.equal(result.completedPendingEvents, 2);
});

test("FinancialAutomationService supports manual reprocessing of automation events", async () => {
  const repository = new FakeAutomationRepository({
    events: [
      {
        eventKey: "event-to-reprocess",
        eventType: FinancialAutomationEventType.SEND_ERROR,
        id: "evt-1",
        status: FinancialAutomationEventStatus.FAILED,
        targetId: "men-1",
        targetType: FinancialAutomationTargetType.INSTALLMENT,
      },
    ],
  });
  const service = new FinancialAutomationService({
    interSyncService: new FakeInterSyncService(),
    repository,
  });

  const result = await service.process({
    idempotencyKey: "event-to-reprocess",
    reprocess: true,
  });

  assert.equal(result.reprocess.reset, true);
  assert.equal(result.reprocess.event.status, FinancialAutomationEventStatus.PENDING);
});

test("FinancialAutomationService rejects unsupported due windows", async () => {
  const service = new FinancialAutomationService({ repository: new FakeAutomationRepository() });

  await assert.rejects(() => service.listUpcomingInstallments({ days: "2" }), {
    code: "FINANCIAL_AUTOMATION_INVALID_DAYS",
  });
});

function installment(overrides = {}) {
  return {
    amount: 150,
    chargeId: overrides.chargeId || "cob-1",
    daysOffset: overrides.daysOffset ?? 0,
    dueDate: overrides.dueDate || "2026-07-09",
    mensalidadeId: overrides.mensalidadeId || "men-1",
    status: overrides.status || "pendente",
    studentId: "aluno-1",
    studentName: "Aluno Teste",
  };
}

function payment(overrides = {}) {
  return {
    amount: 150,
    chargeId: overrides.chargeId || "cob-1",
    dueDate: "2026-07-09",
    id: overrides.id || "pay-1",
    mensalidadeId: overrides.mensalidadeId || "men-1",
    paidAt: overrides.paidAt || "2026-07-09 10:00:00",
    status: overrides.status || "PAGO",
    studentId: "aluno-1",
    txid: overrides.txid || "TXID1",
  };
}

class FakeAutomationRepository {
  constructor(seed = {}) {
    this.upcoming = seed.upcoming || [];
    this.overdue = seed.overdue || [];
    this.payments = seed.payments || [];
    this.events = new Map();

    for (const event of seed.events || []) {
      this.events.set(event.eventKey, { ...event });
    }
  }

  async findUpcomingInstallments(input) {
    this.lastUpcomingInput = input;
    return this.upcoming;
  }

  async findOverdueInstallments(input) {
    this.lastOverdueInput = input;
    return this.overdue;
  }

  async findPayments(input) {
    this.lastPaymentsInput = input;
    const statuses = new Set(input.statuses || []);
    if (statuses.size === 0) return this.payments;
    return this.payments.filter((item) => statuses.has(item.status));
  }

  async findAutomationEventsByKeys(keys) {
    return keys.map((key) => this.events.get(key)).filter(Boolean);
  }

  async recordAutomationEvent(input) {
    if (this.events.has(input.eventKey)) {
      return {
        created: false,
        event: this.events.get(input.eventKey),
        reused: true,
      };
    }

    const event = {
      ...input,
      id: input.id || `evt-${this.events.size + 1}`,
    };
    this.events.set(input.eventKey, event);

    return {
      created: true,
      event,
      reused: false,
    };
  }

  async markPendingEventsCompletedForPaidPayments(input) {
    const ids = new Set();

    for (const item of input.payments || []) {
      for (const value of [item.id, item.chargeId, item.mensalidadeId]) {
        if (value) ids.add(value);
      }
    }

    let completed = 0;
    for (const event of this.events.values()) {
      if (event.status === FinancialAutomationEventStatus.PENDING && ids.has(event.targetId)) {
        event.status = FinancialAutomationEventStatus.COMPLETED;
        completed += 1;
      }
    }

    return { completed };
  }

  async resetEventForReprocess(input) {
    const event =
      this.events.get(input.idempotencyKey) ||
      Array.from(this.events.values()).find((item) => item.id === input.eventId) ||
      null;

    if (!event) return { event: null, reset: false };
    event.status = FinancialAutomationEventStatus.PENDING;
    return { event, reset: true };
  }
}

class FakeInterSyncService {
  constructor() {
    this.calls = [];
  }

  async sync(input) {
    this.calls.push(input);
    return {
      consultados: 1,
      sincronizados: 1,
    };
  }
}
