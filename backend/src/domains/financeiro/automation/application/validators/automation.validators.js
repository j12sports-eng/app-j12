const {
  FinancialAutomationEventStatus,
  FinancialAutomationEventType,
  FinancialAutomationTargetType,
  normalizeAutomationEventStatus,
  normalizeAutomationEventType,
  normalizeAutomationTargetType,
} = require("../../entities/financial-automation-event.entity.js");

const FINANCIAL_AUTOMATION_INPUT_REQUIRED_CODE = "FINANCIAL_AUTOMATION_INPUT_REQUIRED";
const FINANCIAL_AUTOMATION_INVALID_DAYS_CODE = "FINANCIAL_AUTOMATION_INVALID_DAYS";
const FINANCIAL_AUTOMATION_INVALID_EVENT_CODE = "FINANCIAL_AUTOMATION_INVALID_EVENT";
const FINANCIAL_AUTOMATION_INVALID_PAYMENT_STATUS_CODE =
  "FINANCIAL_AUTOMATION_INVALID_PAYMENT_STATUS";
const FINANCIAL_AUTOMATION_PROCESS_INPUT_INVALID_CODE =
  "FINANCIAL_AUTOMATION_PROCESS_INPUT_INVALID";

const UPCOMING_DAYS = Object.freeze([0, 1, 3, 7]);
const OVERDUE_DAYS = Object.freeze([1, 3, 7, 15, 30]);
const PAYMENT_STATUS_GROUPS = Object.freeze({
  cancelados: ["CANCELADO"],
  cancelled: ["CANCELADO"],
  canceled: ["CANCELADO"],
  confirmados: ["PAGO"],
  confirmed: ["PAGO"],
  paid: ["PAGO"],
  pendentes: ["PENDENTE", "PROCESSANDO", "ATRASADO", "VENCIDO"],
  pending: ["PENDENTE", "PROCESSANDO", "ATRASADO", "VENCIDO"],
});

function validateUpcomingInput(input = {}) {
  return {
    days: normalizeDays(input.days ?? input.janelas, UPCOMING_DAYS, UPCOMING_DAYS),
    includeProcessed: normalizeBoolean(input.includeProcessed ?? input.incluirProcessados, false),
    limit: normalizeLimit(input.limit, 200),
    referenceDate: normalizeDate(input.referenceDate ?? input.dataReferencia) || todayIso(),
  };
}

function validateOverdueInput(input = {}) {
  return {
    days: normalizeDays(input.days ?? input.janelas, OVERDUE_DAYS, OVERDUE_DAYS),
    includeProcessed: normalizeBoolean(input.includeProcessed ?? input.incluirProcessados, false),
    limit: normalizeLimit(input.limit, 200),
    referenceDate: normalizeDate(input.referenceDate ?? input.dataReferencia) || todayIso(),
  };
}

function validatePaymentsInput(input = {}) {
  const groups = normalizePaymentGroups(input.status ?? input.statuses ?? input.situacao);

  return {
    groups,
    includeProcessed: normalizeBoolean(input.includeProcessed ?? input.incluirProcessados, false),
    limit: normalizeLimit(input.limit, 200),
    statuses: Array.from(new Set(groups.flatMap((group) => PAYMENT_STATUS_GROUPS[group]))),
  };
}

function validateRecordEventInput(input = {}) {
  const eventType = normalizeAutomationEventType(input.eventType ?? input.tipo);
  const targetType = normalizeAutomationTargetType(input.targetType ?? input.alvoTipo);
  const targetId = nullableText(input.targetId ?? input.alvoId, 64);
  const status =
    input.status === undefined && eventType === FinancialAutomationEventType.SEND_ERROR
      ? FinancialAutomationEventStatus.FAILED
      : normalizeAutomationEventStatus(input.status);
  const missingFields = [];

  if (!eventType) missingFields.push("eventType");
  if (!targetType) missingFields.push("targetType");
  if (!targetId) missingFields.push("targetId");

  if (missingFields.length > 0) {
    throw controlledError(
      "Evento de automacao financeira requer tipo, alvo e identificador.",
      FINANCIAL_AUTOMATION_INPUT_REQUIRED_CODE,
      { missingFields },
    );
  }

  if (!Object.values(FinancialAutomationEventType).includes(eventType)) {
    throw controlledError(
      "Tipo de evento de automacao financeira invalido.",
      FINANCIAL_AUTOMATION_INVALID_EVENT_CODE,
      { eventType, supportedTypes: Object.values(FinancialAutomationEventType) },
    );
  }

  if (!Object.values(FinancialAutomationTargetType).includes(targetType)) {
    throw controlledError(
      "Tipo de alvo de automacao financeira invalido.",
      FINANCIAL_AUTOMATION_INVALID_EVENT_CODE,
      { supportedTargetTypes: Object.values(FinancialAutomationTargetType), targetType },
    );
  }

  if (!Object.values(FinancialAutomationEventStatus).includes(status)) {
    throw controlledError(
      "Status de evento de automacao financeira invalido.",
      FINANCIAL_AUTOMATION_INVALID_EVENT_CODE,
      { status, supportedStatuses: Object.values(FinancialAutomationEventStatus) },
    );
  }

  return {
    channel: nullableText(input.channel ?? input.canal, 32),
    daysOffset: normalizeInteger(input.daysOffset ?? input.days_offset),
    errorMessage: nullableText(input.errorMessage ?? input.erro, 1000),
    eventKey: nullableText(input.eventKey ?? input.idempotencyKey ?? input.chaveIdempotencia, 191),
    eventType,
    occurredAt: normalizeDateTime(input.occurredAt ?? input.ocorridoEm) || nowMysql(),
    payload: readObject(input.payload ?? input.metadata),
    processRunId: nullableText(input.processRunId ?? input.process_run_id, 64),
    provider: nullableText(input.provider ?? input.provedor, 64),
    referenceDate: normalizeDate(input.referenceDate ?? input.reference_date),
    requestedBy: nullableText(input.requestedBy ?? input.solicitadoPor, 191),
    status,
    targetId,
    targetType,
  };
}

function validateProcessInput(input = {}) {
  const limit = normalizeLimit(input.limit, 100);
  const reprocess = normalizeBoolean(input.reprocess ?? input.reprocessar, false);

  if (input.limit !== undefined && !Number.isFinite(Number(input.limit))) {
    throw controlledError(
      "Limit de processamento de automacao financeira invalido.",
      FINANCIAL_AUTOMATION_PROCESS_INPUT_INVALID_CODE,
      { field: "limit" },
    );
  }

  return {
    eventId: nullableText(input.eventId ?? input.event_id, 64),
    idempotencyKey: nullableText(input.idempotencyKey ?? input.eventKey, 191),
    limit,
    paymentId: nullableText(input.paymentId ?? input.pagamentoId ?? input.id, 64),
    reprocess,
    requestedBy: nullableText(input.requestedBy ?? input.solicitadoPor, 191),
    syncBancoInter: normalizeBoolean(input.syncBancoInter ?? input.sincronizarBancoInter, true),
  };
}

function normalizePaymentGroups(value) {
  const rawValues = Array.isArray(value)
    ? value
    : String(value || "confirmados,pendentes,cancelados")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const groups = rawValues.map((item) => normalizeGroupKey(item)).filter(Boolean);

  for (const group of groups) {
    if (!PAYMENT_STATUS_GROUPS[group]) {
      throw controlledError(
        "Status de pagamento para automacao financeira invalido.",
        FINANCIAL_AUTOMATION_INVALID_PAYMENT_STATUS_CODE,
        { group, supportedGroups: Object.keys(PAYMENT_STATUS_GROUPS) },
      );
    }
  }

  return groups.length > 0
    ? Array.from(new Set(groups))
    : ["confirmados", "pendentes", "cancelados"];
}

function normalizeDays(value, defaults, allowedDays) {
  const rawValues = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const days = rawValues.length > 0 ? rawValues.map(Number) : defaults;

  if (days.some((day) => !Number.isSafeInteger(day) || day < 0 || !allowedDays.includes(day))) {
    throw controlledError(
      "Janela de dias da automacao financeira invalida.",
      FINANCIAL_AUTOMATION_INVALID_DAYS_CODE,
      { allowedDays, days },
    );
  }

  return Array.from(new Set(days)).sort((left, right) => left - right);
}

function normalizeGroupKey(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
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

  return null;
}

function normalizeInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function normalizeLimit(value, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return Math.min(50, max);
  return Math.min(Math.trunc(parsed), max);
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return fallback;
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function nowMysql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;

  for (const [key, detail] of Object.entries(details)) {
    error[key] = detail;
  }

  return error;
}

module.exports = {
  FINANCIAL_AUTOMATION_INPUT_REQUIRED_CODE,
  FINANCIAL_AUTOMATION_INVALID_DAYS_CODE,
  FINANCIAL_AUTOMATION_INVALID_EVENT_CODE,
  FINANCIAL_AUTOMATION_INVALID_PAYMENT_STATUS_CODE,
  FINANCIAL_AUTOMATION_PROCESS_INPUT_INVALID_CODE,
  OVERDUE_DAYS,
  PAYMENT_STATUS_GROUPS,
  UPCOMING_DAYS,
  controlledError,
  nullableText,
  validateOverdueInput,
  validatePaymentsInput,
  validateProcessInput,
  validateRecordEventInput,
  validateUpcomingInput,
};
