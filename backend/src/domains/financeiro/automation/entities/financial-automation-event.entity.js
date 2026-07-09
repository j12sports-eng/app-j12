const FinancialAutomationEventType = Object.freeze({
  CHARGE_ATTEMPT: "TENTATIVA_COBRANCA",
  CHARGE_SENT: "COBRANCA_ENVIADA",
  REMINDER_SENT: "LEMBRETE_ENVIADO",
  SEND_ERROR: "ERRO_ENVIO",
  THANK_YOU_SENT: "AGRADECIMENTO_ENVIADO",
});

const FinancialAutomationEventStatus = Object.freeze({
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  PENDING: "PENDING",
  SKIPPED: "SKIPPED",
});

const FinancialAutomationTargetType = Object.freeze({
  CHARGE: "COBRANCA",
  INSTALLMENT: "MENSALIDADE",
  PAYMENT: "PAGAMENTO",
  PROCESS: "PROCESSAMENTO",
});

class FinancialAutomationEventEntity {
  constructor(data = {}) {
    this.id = nullableText(data.id, 64);
    this.eventKey = nullableText(data.eventKey ?? data.event_key, 191);
    this.eventType = normalizeAutomationEventType(data.eventType ?? data.event_type);
    this.targetType = normalizeAutomationTargetType(data.targetType ?? data.target_type);
    this.targetId = nullableText(data.targetId ?? data.target_id, 64);
    this.status = normalizeAutomationEventStatus(data.status);
    this.channel = nullableText(data.channel ?? data.canal, 32);
    this.provider = nullableText(data.provider ?? data.provedor, 64);
    this.processRunId = nullableText(data.processRunId ?? data.process_run_id, 64);
    this.referenceDate = normalizeDate(data.referenceDate ?? data.reference_date);
    this.daysOffset = normalizeInteger(data.daysOffset ?? data.days_offset);
    this.occurredAt = normalizeDateTime(data.occurredAt ?? data.occurred_at);
    this.completedAt = normalizeDateTime(data.completedAt ?? data.completed_at);
    this.errorMessage = nullableText(data.errorMessage ?? data.error_message, 1000);
    this.payload = readObject(data.payload ?? data.payload_json);
    this.createdBy = nullableText(data.createdBy ?? data.created_by, 191);
    this.createdAt = data.createdAt ?? data.created_at ?? null;
    this.updatedAt = data.updatedAt ?? data.updated_at ?? null;
  }

  isCompleted() {
    return this.status === FinancialAutomationEventStatus.COMPLETED;
  }

  toJSON() {
    return {
      channel: this.channel,
      completedAt: this.completedAt,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      daysOffset: this.daysOffset,
      errorMessage: this.errorMessage,
      eventKey: this.eventKey,
      eventType: this.eventType,
      id: this.id,
      occurredAt: this.occurredAt,
      payload: this.payload,
      processRunId: this.processRunId,
      provider: this.provider,
      referenceDate: this.referenceDate,
      status: this.status,
      targetId: this.targetId,
      targetType: this.targetType,
      updatedAt: this.updatedAt,
    };
  }
}

function normalizeAutomationEventType(value) {
  const normalized = normalizeToken(value);
  const aliases = {
    AGRADECIMENTO: FinancialAutomationEventType.THANK_YOU_SENT,
    AGRADECIMENTO_ENVIADO: FinancialAutomationEventType.THANK_YOU_SENT,
    COBRANCA: FinancialAutomationEventType.CHARGE_SENT,
    COBRANCA_ENVIADA: FinancialAutomationEventType.CHARGE_SENT,
    ERRO: FinancialAutomationEventType.SEND_ERROR,
    ERRO_DE_ENVIO: FinancialAutomationEventType.SEND_ERROR,
    ERRO_ENVIO: FinancialAutomationEventType.SEND_ERROR,
    LEMBRETE: FinancialAutomationEventType.REMINDER_SENT,
    LEMBRETE_ENVIADO: FinancialAutomationEventType.REMINDER_SENT,
    TENTATIVA: FinancialAutomationEventType.CHARGE_ATTEMPT,
    TENTATIVA_COBRANCA: FinancialAutomationEventType.CHARGE_ATTEMPT,
  };

  return aliases[normalized] || normalized || null;
}

function normalizeAutomationEventStatus(value) {
  const normalized = normalizeToken(value);
  const aliases = {
    CONCLUIDO: FinancialAutomationEventStatus.COMPLETED,
    COMPLETED: FinancialAutomationEventStatus.COMPLETED,
    DONE: FinancialAutomationEventStatus.COMPLETED,
    ENVIADO: FinancialAutomationEventStatus.COMPLETED,
    ERRO: FinancialAutomationEventStatus.FAILED,
    FAILED: FinancialAutomationEventStatus.FAILED,
    FALHA: FinancialAutomationEventStatus.FAILED,
    IGNORADO: FinancialAutomationEventStatus.SKIPPED,
    PENDING: FinancialAutomationEventStatus.PENDING,
    PENDENTE: FinancialAutomationEventStatus.PENDING,
    SKIPPED: FinancialAutomationEventStatus.SKIPPED,
  };

  return aliases[normalized] || normalized || FinancialAutomationEventStatus.COMPLETED;
}

function normalizeAutomationTargetType(value) {
  const normalized = normalizeToken(value);
  const aliases = {
    CHARGE: FinancialAutomationTargetType.CHARGE,
    COBRANCA: FinancialAutomationTargetType.CHARGE,
    INSTALLMENT: FinancialAutomationTargetType.INSTALLMENT,
    MENSALIDADE: FinancialAutomationTargetType.INSTALLMENT,
    PAGAMENTO: FinancialAutomationTargetType.PAYMENT,
    PAYMENT: FinancialAutomationTargetType.PAYMENT,
    PROCESS: FinancialAutomationTargetType.PROCESS,
    PROCESSAMENTO: FinancialAutomationTargetType.PROCESS,
  };

  return aliases[normalized] || normalized || null;
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

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const normalized = nullableText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized || "") ? normalized : null;
}

function normalizeDateTime(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 19).replace("T", " ");
  }

  const normalized = nullableText(value, 32);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized || "")) return `${normalized} 00:00:00`;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(normalized || "")) {
    return normalized.replace("T", " ");
  }

  const parsed = new Date(normalized || "");
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function readObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

module.exports = {
  FinancialAutomationEventEntity,
  FinancialAutomationEventStatus,
  FinancialAutomationEventType,
  FinancialAutomationTargetType,
  normalizeAutomationEventStatus,
  normalizeAutomationEventType,
  normalizeAutomationTargetType,
  nullableText,
};
