const PaymentProviderId = Object.freeze({
  ASAAS: "asaas",
  BANCO_INTER: "banco_inter",
  CORA: "cora",
  INFINITE_PAY: "infinitepay",
  MANUAL: "manual",
  MERCADO_PAGO: "mercado_pago",
});

const PaymentMethod = Object.freeze({
  BANK_SLIP: "boleto",
  CARD: "cartao",
  LINK: "link_pagamento",
  MANUAL: "manual",
  PIX: "pix",
});

const PaymentChargeStatus = Object.freeze({
  CANCELLED: "CANCELLED",
  DRAFT: "DRAFT",
  EXPIRED: "EXPIRED",
  FAILED: "FAILED",
  ISSUED: "ISSUED",
  PAID: "PAID",
  PENDING: "PENDING",
});

const OPEN_PAYMENT_CHARGE_STATUSES = Object.freeze([
  PaymentChargeStatus.DRAFT,
  PaymentChargeStatus.PENDING,
  PaymentChargeStatus.ISSUED,
]);

class PaymentChargeEntity {
  constructor(data = {}) {
    this.id = nullableText(data.id, 64);
    this.legacyChargeId = nullableText(
      data.legacyChargeId ?? data.legacy_charge_id ?? data.cobrancaId,
      64,
    );
    this.mensalidadeId = nullableText(data.mensalidadeId ?? data.mensalidade_id, 64);
    this.studentId = nullableText(data.studentId ?? data.student_id ?? data.alunoId, 64);
    this.responsibleId = nullableText(
      data.responsibleId ?? data.responsible_id ?? data.responsavelId,
      64,
    );
    this.provider = normalizePaymentProviderId(data.provider);
    this.status = normalizePaymentChargeStatus(data.status);
    this.amount = normalizeAmount(data.amount ?? data.valor);
    this.currency = normalizeCurrency(data.currency);
    this.description = nullableText(data.description ?? data.descricao, 191) || "Cobranca J12";
    this.dueDate = normalizeDate(data.dueDate ?? data.due_date ?? data.vencimento);
    this.paymentMethod = normalizePaymentMethod(data.paymentMethod ?? data.payment_method);
    this.externalId = nullableText(data.externalId ?? data.external_id, 191);
    this.checkoutUrl = nullableText(data.checkoutUrl ?? data.checkout_url, 1000);
    this.providerPayload = readObject(data.providerPayload ?? data.provider_payload);
    this.metadata = readObject(data.metadata ?? data.metadata_json);
    this.createdBy = nullableText(data.createdBy ?? data.created_by, 191);
    this.updatedBy = nullableText(data.updatedBy ?? data.updated_by, 191);
    this.cancelledBy = nullableText(data.cancelledBy ?? data.cancelled_by, 191);
    this.cancellationReason = nullableText(
      data.cancellationReason ?? data.cancellation_reason,
      65535,
    );
    this.cancelledAt = nullableText(data.cancelledAt ?? data.cancelled_at, 19);
    this.createdAt = data.createdAt ?? data.created_at ?? null;
    this.updatedAt = data.updatedAt ?? data.updated_at ?? null;
  }

  isOpen() {
    return OPEN_PAYMENT_CHARGE_STATUSES.includes(this.status);
  }

  toJSON() {
    return {
      amount: this.amount,
      cancelledAt: this.cancelledAt,
      cancelledBy: this.cancelledBy,
      cancellationReason: this.cancellationReason,
      checkoutUrl: this.checkoutUrl,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      currency: this.currency,
      description: this.description,
      dueDate: this.dueDate,
      externalId: this.externalId,
      id: this.id,
      legacyChargeId: this.legacyChargeId,
      mensalidadeId: this.mensalidadeId,
      metadata: this.metadata,
      paymentMethod: this.paymentMethod,
      provider: this.provider,
      providerPayload: this.providerPayload,
      responsibleId: this.responsibleId,
      status: this.status,
      studentId: this.studentId,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }
}

class PaymentEntity {
  constructor(data = {}) {
    this.id = nullableText(data.id, 64);
    this.chargeId = nullableText(data.chargeId ?? data.charge_id, 64);
    this.provider = normalizePaymentProviderId(data.provider);
    this.providerPaymentId = nullableText(data.providerPaymentId ?? data.provider_payment_id, 191);
    this.status = normalizePaymentChargeStatus(data.status);
    this.amount = normalizeAmount(data.amount ?? data.valor);
    this.currency = normalizeCurrency(data.currency);
    this.paymentMethod = normalizePaymentMethod(data.paymentMethod ?? data.payment_method);
    this.paidAt = nullableText(data.paidAt ?? data.paid_at, 19);
    this.metadata = readObject(data.metadata ?? data.metadata_json);
  }

  toJSON() {
    return {
      amount: this.amount,
      chargeId: this.chargeId,
      currency: this.currency,
      id: this.id,
      metadata: this.metadata,
      paidAt: this.paidAt,
      paymentMethod: this.paymentMethod,
      provider: this.provider,
      providerPaymentId: this.providerPaymentId,
      status: this.status,
    };
  }
}

function normalizePaymentProviderId(value) {
  const normalized = String(value ?? PaymentProviderId.BANCO_INTER)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "inter" || normalized === "bancointer") {
    return PaymentProviderId.BANCO_INTER;
  }

  if (normalized === "infinite_pay" || normalized === "infinitepay") {
    return PaymentProviderId.INFINITE_PAY;
  }

  if (Object.values(PaymentProviderId).includes(normalized)) {
    return normalized;
  }

  return normalized || PaymentProviderId.BANCO_INTER;
}

function normalizePaymentMethod(value) {
  const normalized = String(value ?? PaymentMethod.PIX)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "cartao_credito" || normalized === "card") {
    return PaymentMethod.CARD;
  }

  if (normalized === "payment_link" || normalized === "link") {
    return PaymentMethod.LINK;
  }

  if (Object.values(PaymentMethod).includes(normalized)) {
    return normalized;
  }

  return PaymentMethod.PIX;
}

function normalizePaymentChargeStatus(value) {
  const normalized = String(value ?? PaymentChargeStatus.PENDING)
    .trim()
    .toUpperCase();

  if (
    ["CANCELADO", "CANCELADA", "CANCELED", "CANCELLED", "REMOVIDA_PELO_USUARIO_RECEBEDOR"].includes(
      normalized,
    )
  ) {
    return PaymentChargeStatus.CANCELLED;
  }

  if (["PAGO", "PAID", "LIQUIDADO", "RECEBIDO"].includes(normalized)) {
    return PaymentChargeStatus.PAID;
  }

  if (["VENCIDO", "EXPIRADO", "EXPIRED"].includes(normalized)) {
    return PaymentChargeStatus.EXPIRED;
  }

  if (["EMITIDO", "ISSUED"].includes(normalized)) {
    return PaymentChargeStatus.ISSUED;
  }

  if (["RASCUNHO", "DRAFT"].includes(normalized)) {
    return PaymentChargeStatus.DRAFT;
  }

  if (["FALHOU", "FAILED", "ERROR"].includes(normalized)) {
    return PaymentChargeStatus.FAILED;
  }

  return PaymentChargeStatus.PENDING;
}

function normalizeAmount(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function normalizeCurrency(value) {
  const normalized = String(value ?? "BRL")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  return normalized.slice(0, 3) || "BRL";
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  const normalized = nullableText(value, 32);
  if (!normalized) return null;

  return normalized.slice(0, 10);
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
  OPEN_PAYMENT_CHARGE_STATUSES,
  PaymentChargeEntity,
  PaymentChargeStatus,
  PaymentEntity,
  PaymentMethod,
  PaymentProviderId,
  normalizeAmount,
  normalizeCurrency,
  normalizeDate,
  normalizePaymentChargeStatus,
  normalizePaymentMethod,
  normalizePaymentProviderId,
  nullableText,
  readObject,
};
