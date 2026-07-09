const {
  FinancialAutomationEventEntity,
} = require("../../entities/financial-automation-event.entity.js");

function toFinancialAutomationEventDto(event) {
  const entity =
    event instanceof FinancialAutomationEventEntity
      ? event
      : new FinancialAutomationEventEntity(event || {});

  return entity.toJSON();
}

function toFinancialAutomationInstallmentDto(item = {}) {
  return compactObject({
    aluno: compactObject({
      email: nullableText(item.email, 191),
      id: nullableText(item.studentId ?? item.alunoId, 64),
      nome: nullableText(item.studentName ?? item.alunoNome, 191),
      telefone: nullableText(item.phone ?? item.telefoneWhatsapp, 50),
    }),
    automation: toAutomationStateDto(item.automation),
    cobrancaId: nullableText(item.chargeId ?? item.cobrancaId, 64),
    competencia: nullableText(item.competencia ?? item.reference, 7),
    daysOffset: normalizeInteger(item.daysOffset),
    descricao: nullableText(item.description ?? item.descricao, 191),
    id: nullableText(item.id ?? item.mensalidadeId, 64),
    mensalidadeId: nullableText(item.mensalidadeId ?? item.id, 64),
    responsavel: compactObject({
      email: nullableText(item.responsibleEmail, 191),
      id: nullableText(item.responsibleId, 64),
      nome: nullableText(item.responsibleName, 191),
      telefone: nullableText(item.responsiblePhone, 50),
    }),
    status: nullableText(item.status, 32),
    valor: normalizeAmount(item.amount ?? item.valor),
    vencimento: nullableText(item.dueDate ?? item.vencimento, 10),
  });
}

function toFinancialAutomationPaymentDto(item = {}) {
  return compactObject({
    aluno: compactObject({
      email: nullableText(item.email, 191),
      id: nullableText(item.studentId, 64),
      nome: nullableText(item.studentName, 191),
      telefone: nullableText(item.phone, 50),
    }),
    amount: normalizeAmount(item.amount),
    automation: toAutomationStateDto(item.automation),
    cobrancaId: nullableText(item.chargeId, 64),
    dueDate: nullableText(item.dueDate, 10),
    id: nullableText(item.id, 64),
    mensalidadeId: nullableText(item.mensalidadeId, 64),
    paidAt: nullableText(item.paidAt, 19),
    paymentMethod: nullableText(item.paymentMethod, 50),
    responsavel: compactObject({
      email: nullableText(item.responsibleEmail, 191),
      id: nullableText(item.responsibleId, 64),
      nome: nullableText(item.responsibleName, 191),
      telefone: nullableText(item.responsiblePhone, 50),
    }),
    status: nullableText(item.status, 32),
    txid: nullableText(item.txid, 35),
  });
}

function toAutomationStateDto(automation = {}) {
  return compactObject({
    canSend: automation.canSend !== false,
    event: automation.event ? toFinancialAutomationEventDto(automation.event) : undefined,
    eventKey: nullableText(automation.eventKey, 191),
    eventType: nullableText(automation.eventType, 64),
    previouslyProcessed: automation.previouslyProcessed === true,
    reason: nullableText(automation.reason, 191),
  });
}

function toFinancialAutomationListDto(input = {}) {
  const type = nullableText(input.type, 32) || "items";
  const items = Array.isArray(input.items) ? input.items : [];

  return {
    count: items.length,
    generatedAt: input.generatedAt || new Date().toISOString(),
    items,
    referenceDate: nullableText(input.referenceDate, 10),
    requestedWindows: Array.isArray(input.requestedWindows) ? input.requestedWindows : [],
    type,
  };
}

function toFinancialAutomationProcessDto(input = {}) {
  return {
    completedPendingEvents: Number(input.completedPendingEvents || 0),
    generatedAt: input.generatedAt || new Date().toISOString(),
    interSync: input.interSync || null,
    paidPaymentsChecked: Number(input.paidPaymentsChecked || 0),
    reprocess: input.reprocess || null,
    runId: nullableText(input.runId, 64),
    syncBancoInter: input.syncBancoInter !== false,
  };
}

function compactObject(input = {}) {
  const output = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) {
      continue;
    }
    output[key] = value;
  }

  return output;
}

function normalizeAmount(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

function normalizeInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

module.exports = {
  compactObject,
  toAutomationStateDto,
  toFinancialAutomationEventDto,
  toFinancialAutomationInstallmentDto,
  toFinancialAutomationListDto,
  toFinancialAutomationPaymentDto,
  toFinancialAutomationProcessDto,
};
