const { randomUUID } = require("node:crypto");

const {
  FinancialAutomationEventStatus,
  FinancialAutomationEventType,
  FinancialAutomationTargetType,
} = require("../../entities/financial-automation-event.entity.js");
const {
  toFinancialAutomationEventDto,
  toFinancialAutomationInstallmentDto,
  toFinancialAutomationListDto,
  toFinancialAutomationPaymentDto,
  toFinancialAutomationProcessDto,
} = require("../dtos/automation.dto.js");
const {
  validateOverdueInput,
  validatePaymentsInput,
  validateProcessInput,
  validateRecordEventInput,
  validateUpcomingInput,
} = require("../validators/automation.validators.js");

const FINANCIAL_AUTOMATION_REPOSITORY_INVALID_CODE = "FINANCIAL_AUTOMATION_REPOSITORY_INVALID";

class FinancialAutomationService {
  constructor(options = {}) {
    this.repository = options.repository || options.automationRepository || null;
    this.interSyncService = options.interSyncService || options.interProvider || null;
    this.now = typeof options.now === "function" ? options.now : () => new Date();
  }

  async listUpcomingInstallments(input = {}) {
    const values = validateUpcomingInput(input);
    const items = await this.getRepository().findUpcomingInstallments(values);
    const decorated = await this.decorateInstallments(items, {
      eventType: FinancialAutomationEventType.REMINDER_SENT,
      includeProcessed: values.includeProcessed,
      targetType: FinancialAutomationTargetType.INSTALLMENT,
    });

    return toFinancialAutomationListDto({
      items: decorated.map(toFinancialAutomationInstallmentDto),
      referenceDate: values.referenceDate,
      requestedWindows: values.days,
      type: "vencimentos",
    });
  }

  async listOverdueInstallments(input = {}) {
    const values = validateOverdueInput(input);
    const items = await this.getRepository().findOverdueInstallments(values);
    const decorated = await this.decorateInstallments(items, {
      eventType: FinancialAutomationEventType.CHARGE_SENT,
      includeProcessed: values.includeProcessed,
      targetType: FinancialAutomationTargetType.INSTALLMENT,
    });

    return toFinancialAutomationListDto({
      items: decorated.map(toFinancialAutomationInstallmentDto),
      referenceDate: values.referenceDate,
      requestedWindows: values.days,
      type: "inadimplentes",
    });
  }

  async listPayments(input = {}) {
    const values = validatePaymentsInput(input);
    const payments = await this.getRepository().findPayments(values);
    const decorated = await this.decoratePayments(payments, values);

    return toFinancialAutomationListDto({
      items: decorated.map(toFinancialAutomationPaymentDto),
      requestedWindows: values.groups,
      type: "pagamentos",
    });
  }

  async recordEvent(input = {}) {
    const values = validateRecordEventInput(input);
    const eventKey =
      values.eventKey ||
      buildFinancialAutomationEventKey({
        daysOffset: values.daysOffset,
        eventType: values.eventType,
        referenceDate: values.referenceDate,
        targetId: values.targetId,
        targetType: values.targetType,
      });
    const result = await this.getRepository().recordAutomationEvent({
      ...values,
      eventKey,
    });

    return {
      created: result.created === true,
      event: toFinancialAutomationEventDto(result.event),
      idempotent: true,
      reused: result.reused === true,
    };
  }

  async process(input = {}) {
    const values = validateProcessInput(input);
    const runId = `fauto-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const interSync = values.syncBancoInter
      ? await callInterSyncService(this.interSyncService, {
          id: values.paymentId,
          limit: values.limit,
        })
      : { skipped: true, reason: "sync_banco_inter_disabled" };
    const paidPayments = await this.getRepository().findPayments({
      limit: values.limit,
      statuses: ["PAGO"],
    });
    const completion = await this.getRepository().markPendingEventsCompletedForPaidPayments({
      payments: paidPayments,
      processRunId: runId,
    });
    const reprocess =
      values.reprocess && (values.eventId || values.idempotencyKey)
        ? await this.getRepository().resetEventForReprocess({
            eventId: values.eventId,
            idempotencyKey: values.idempotencyKey,
            processRunId: runId,
            requestedBy: values.requestedBy,
          })
        : null;

    return toFinancialAutomationProcessDto({
      completedPendingEvents: completion.completed || 0,
      interSync,
      paidPaymentsChecked: paidPayments.length,
      reprocess,
      runId,
      syncBancoInter: values.syncBancoInter,
    });
  }

  async decorateInstallments(items, options) {
    const normalized = (Array.isArray(items) ? items : []).map((item) => {
      const targetId = nullableText(item.mensalidadeId ?? item.id, 64);
      const eventKey = buildFinancialAutomationEventKey({
        daysOffset: item.daysOffset,
        eventType: options.eventType,
        referenceDate: item.dueDate,
        targetId,
        targetType: options.targetType,
      });

      return {
        ...item,
        automation: {
          eventKey,
          eventType: options.eventType,
        },
      };
    });
    const events = await this.loadEventsByKey(normalized.map((item) => item.automation.eventKey));

    return normalized
      .map((item) => attachAutomationEvent(item, events.get(item.automation.eventKey)))
      .filter((item) => shouldReturnAutomationItem(item, options.includeProcessed));
  }

  async decoratePayments(items, options) {
    const normalized = (Array.isArray(items) ? items : []).map((item) => {
      const eventType = resolvePaymentAutomationEventType(item.status);
      const targetId = nullableText(item.id, 64);
      const eventKey = eventType
        ? buildFinancialAutomationEventKey({
            eventType,
            referenceDate: dateOnly(item.paidAt ?? item.dueDate),
            targetId,
            targetType: FinancialAutomationTargetType.PAYMENT,
          })
        : null;

      return {
        ...item,
        automation: {
          canSend: Boolean(eventType),
          eventKey,
          eventType,
          reason: eventType ? null : "pagamento_sem_acao_de_automacao",
        },
      };
    });
    const events = await this.loadEventsByKey(
      normalized.map((item) => item.automation.eventKey).filter(Boolean),
    );

    return normalized
      .map((item) => attachAutomationEvent(item, events.get(item.automation.eventKey)))
      .filter((item) => shouldReturnAutomationItem(item, options.includeProcessed));
  }

  async loadEventsByKey(keys) {
    const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
    if (uniqueKeys.length === 0) return new Map();

    const events = await this.getRepository().findAutomationEventsByKeys(uniqueKeys);
    return new Map(
      (Array.isArray(events) ? events : []).map((event) => [
        nullableText(event.eventKey ?? event.event_key, 191),
        event,
      ]),
    );
  }

  getRepository() {
    const repository = this.repository;

    if (
      !repository ||
      typeof repository.findUpcomingInstallments !== "function" ||
      typeof repository.findOverdueInstallments !== "function" ||
      typeof repository.findPayments !== "function" ||
      typeof repository.findAutomationEventsByKeys !== "function" ||
      typeof repository.recordAutomationEvent !== "function" ||
      typeof repository.markPendingEventsCompletedForPaidPayments !== "function" ||
      typeof repository.resetEventForReprocess !== "function"
    ) {
      const error = new TypeError("FinancialAutomationService requires automation repository.");
      error.code = FINANCIAL_AUTOMATION_REPOSITORY_INVALID_CODE;
      throw error;
    }

    return repository;
  }
}

async function callInterSyncService(service, input = {}) {
  if (!service) {
    return {
      reason: "inter_sync_service_not_configured",
      skipped: true,
    };
  }

  for (const method of ["sync", "sincronizar", "listPayments"]) {
    if (typeof service[method] === "function") {
      return service[method](input);
    }
  }

  return {
    reason: "inter_sync_method_not_available",
    skipped: true,
  };
}

function attachAutomationEvent(item, event) {
  const completed = normalizeStatus(event?.status) === FinancialAutomationEventStatus.COMPLETED;
  const failed = normalizeStatus(event?.status) === FinancialAutomationEventStatus.FAILED;

  return {
    ...item,
    automation: {
      ...item.automation,
      canSend: item.automation.canSend !== false && !completed,
      event: event ? toFinancialAutomationEventDto(event) : null,
      previouslyProcessed: completed,
      reason: completed
        ? "evento_ja_concluido"
        : failed
          ? "evento_com_erro_permite_reprocessar"
          : null,
    },
  };
}

function shouldReturnAutomationItem(item, includeProcessed) {
  if (includeProcessed) return true;
  return item.automation.previouslyProcessed !== true;
}

function resolvePaymentAutomationEventType(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "PAGO") return FinancialAutomationEventType.THANK_YOU_SENT;
  if (["PENDENTE", "PROCESSANDO", "ATRASADO", "VENCIDO"].includes(normalized)) {
    return FinancialAutomationEventType.CHARGE_ATTEMPT;
  }

  return null;
}

function buildFinancialAutomationEventKey(input = {}) {
  return [
    "financeiro",
    "automation",
    normalizeToken(input.eventType),
    normalizeToken(input.targetType),
    nullableText(input.targetId, 64) || "sem-alvo",
    nullableText(input.referenceDate, 10) || "sem-data",
    input.daysOffset === null || input.daysOffset === undefined
      ? "sem-janela"
      : `d${input.daysOffset}`,
  ].join(":");
}

function normalizeStatus(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function normalizeToken(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function dateOnly(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return nullableText(value, 32)?.slice(0, 10) || null;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

module.exports = {
  FINANCIAL_AUTOMATION_REPOSITORY_INVALID_CODE,
  FinancialAutomationService,
  buildFinancialAutomationEventKey,
  callInterSyncService,
  resolvePaymentAutomationEventType,
};
