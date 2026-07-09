const FINANCIAL_STATUSES = Object.freeze({
  PENDING: "PENDENTE",
  PROCESSING: "PROCESSANDO",
  PAID: "PAGO",
  OVERDUE: "ATRASADO",
  EXPIRED: "VENCIDO",
  CANCELED: "CANCELADO",
});

const INTER_PIX_SCOPES = [
  "cob.write",
  "cob.read",
  "pix.write",
  "pix.read",
  "webhook.write",
  "webhook.read",
  "payloadlocation.write",
  "payloadlocation.read",
];

function normalizeFinancialStatus(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

  if (["PAGO", "PAID", "CONCLUIDA", "CONCLUIDO", "RECEBIDO"].includes(normalized)) {
    return FINANCIAL_STATUSES.PAID;
  }

  if (["PROCESSANDO", "PROCESSING", "EM_PROCESSAMENTO"].includes(normalized)) {
    return FINANCIAL_STATUSES.PROCESSING;
  }

  if (["ATRASADO", "OVERDUE"].includes(normalized)) {
    return FINANCIAL_STATUSES.OVERDUE;
  }

  if (["VENCIDO", "EXPIRED"].includes(normalized)) {
    return FINANCIAL_STATUSES.EXPIRED;
  }

  if (
    ["CANCELADO", "CANCELADA", "CANCELED", "CANCELLED", "REMOVIDA_PELO_USUARIO_RECEBEDOR"].includes(
      normalized,
    )
  ) {
    return FINANCIAL_STATUSES.CANCELED;
  }

  return FINANCIAL_STATUSES.PENDING;
}

module.exports = {
  FINANCIAL_STATUSES,
  INTER_PIX_SCOPES,
  normalizeFinancialStatus,
};
