const InterPaymentStatus = Object.freeze({
  CANCELLED: "CANCELADO",
  EXPIRED: "VENCIDO",
  PAID: "PAGO",
  PENDING: "PENDENTE",
  PROCESSING: "PROCESSANDO",
  REFUNDED: "DEVOLVIDO",
});

const InterChargeType = Object.freeze({
  PIX: "PIX",
});

class InterPaymentEntity {
  constructor(data = {}) {
    this.id = nullableText(data.id, 64);
    this.studentId = nullableText(data.studentId ?? data.student_id, 64);
    this.responsibleId = nullableText(data.responsibleId ?? data.responsible_id, 64);
    this.mensalidadeId = nullableText(data.mensalidadeId ?? data.mensalidade_id, 64);
    this.chargeId = nullableText(data.chargeId ?? data.charge_id, 64);
    this.txid = nullableText(data.txid, 35);
    this.amount = normalizeAmount(data.amount);
    this.status = normalizeInterPaymentStatus(data.status);
    this.dueDate = nullableText(data.dueDate ?? data.due_date, 10);
    this.paidAt = nullableText(data.paidAt ?? data.paid_at, 19);
    this.paymentMethod = nullableText(data.paymentMethod ?? data.payment_method, 50);
    this.pixPayload = data.pixPayload ?? data.pix_payload ?? null;
    this.pixCopyPaste = nullableText(data.pixCopyPaste ?? data.pix_copy_paste, 4096);
    this.qrCode = nullableText(data.qrCode ?? data.qr_code, 5 * 1024 * 1024);
    this.e2eid = nullableText(data.e2eid, 191);
    this.interTransactionId = nullableText(
      data.interTransactionId ?? data.inter_transaction_id,
      191,
    );
    this.webhookPayload = data.webhookPayload ?? data.webhook_payload ?? null;
    this.createdAt = data.createdAt ?? data.created_at ?? null;
    this.updatedAt = data.updatedAt ?? data.updated_at ?? null;
  }

  isPaid() {
    return this.status === InterPaymentStatus.PAID;
  }

  isOpen() {
    return [
      InterPaymentStatus.PENDING,
      InterPaymentStatus.PROCESSING,
      InterPaymentStatus.EXPIRED,
    ].includes(this.status);
  }

  toJSON() {
    return {
      amount: this.amount,
      chargeId: this.chargeId,
      createdAt: this.createdAt,
      dueDate: this.dueDate,
      e2eid: this.e2eid,
      id: this.id,
      interTransactionId: this.interTransactionId,
      mensalidadeId: this.mensalidadeId,
      paidAt: this.paidAt,
      paymentMethod: this.paymentMethod,
      pixCopyPaste: this.pixCopyPaste,
      pixPayload: this.pixPayload,
      qrCode: this.qrCode,
      responsibleId: this.responsibleId,
      status: this.status,
      studentId: this.studentId,
      txid: this.txid,
      updatedAt: this.updatedAt,
      webhookPayload: this.webhookPayload,
    };
  }
}

function normalizeInterPaymentStatus(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

  if (["PAGO", "PAID", "CONCLUIDA", "CONCLUIDO", "LIQUIDADO", "RECEBIDO"].includes(normalized)) {
    return InterPaymentStatus.PAID;
  }

  if (["PROCESSANDO", "PROCESSING", "EM_PROCESSAMENTO"].includes(normalized)) {
    return InterPaymentStatus.PROCESSING;
  }

  if (["VENCIDO", "EXPIRADO", "EXPIRADA", "EXPIRED"].includes(normalized)) {
    return InterPaymentStatus.EXPIRED;
  }

  if (["DEVOLVIDO", "DEVOLVIDA", "REFUNDED", "REFUND"].includes(normalized)) {
    return InterPaymentStatus.REFUNDED;
  }

  if (
    [
      "CANCELADO",
      "CANCELADA",
      "CANCELED",
      "CANCELLED",
      "REMOVIDA",
      "REMOVIDA_PELO_USUARIO_RECEBEDOR",
    ].includes(normalized)
  ) {
    return InterPaymentStatus.CANCELLED;
  }

  return InterPaymentStatus.PENDING;
}

function normalizeAmount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

module.exports = {
  InterChargeType,
  InterPaymentEntity,
  InterPaymentStatus,
  normalizeInterPaymentStatus,
};
