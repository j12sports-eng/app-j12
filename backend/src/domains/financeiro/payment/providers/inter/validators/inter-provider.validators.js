const {
  normalizeAmount,
  nullableText,
  readObject,
} = require("../../../entities/payment.entity.js");

const INTER_PROVIDER_INPUT_REQUIRED_CODE = "INTER_PROVIDER_INPUT_REQUIRED";
const INTER_PROVIDER_TXID_REQUIRED_CODE = "INTER_PROVIDER_TXID_REQUIRED";
const INTER_PROVIDER_SYNC_INPUT_INVALID_CODE = "INTER_PROVIDER_SYNC_INPUT_INVALID";
const INTER_PROVIDER_WEBHOOK_INPUT_INVALID_CODE = "INTER_PROVIDER_WEBHOOK_INPUT_INVALID";
const INTER_PROVIDER_WEBHOOK_SIGNATURE_INVALID_CODE = "INTER_PROVIDER_WEBHOOK_SIGNATURE_INVALID";

function validateCreatePixInput(input = {}) {
  const normalized = {
    amount: normalizeAmount(input.amount ?? input.valor),
    chargeId: nullableText(input.chargeId ?? input.cobrancaId ?? input.legacyChargeId, 64),
    description: nullableText(input.description ?? input.descricao, 140),
    dueDate: nullableText(input.dueDate ?? input.vencimento, 10),
    expiresIn: normalizePositiveInteger(input.expiresIn ?? input.expiracao, 86400),
    id: nullableText(input.id, 64),
    mensalidadeId: nullableText(input.mensalidadeId ?? input.mensalidade_id, 64),
    pixKey: nullableText(input.pixKey ?? input.chavePix, 191),
    requestedBy: nullableText(input.requestedBy, 191),
    responsibleCpf: nullableText(input.responsibleCpf ?? input.responsavelCpf, 20),
    responsibleId: nullableText(input.responsibleId ?? input.responsavelId, 64),
    responsibleName: nullableText(input.responsibleName ?? input.responsavelNome, 191),
    studentId: nullableText(input.studentId ?? input.alunoId, 64),
    studentName: nullableText(input.studentName ?? input.alunoNome, 191),
    txid: nullableText(input.txid, 35),
  };

  if (!normalized.chargeId && !normalized.mensalidadeId && !normalized.id) {
    const missingFields =
      normalized.amount > 0 && normalized.studentId && normalized.description
        ? []
        : ["cobrancaId", "mensalidadeId", "id"];

    if (missingFields.length > 0) {
      throw controlledError(
        "Informe cobrancaId, mensalidadeId ou id para gerar PIX Banco Inter.",
        INTER_PROVIDER_INPUT_REQUIRED_CODE,
        { missingFields },
      );
    }
  }

  if (!normalized.chargeId && !normalized.mensalidadeId && !normalized.id) {
    const missingFields = [];
    if (!normalized.studentId) missingFields.push("studentId");
    if (!normalized.description) missingFields.push("description");
    if (normalized.amount <= 0) missingFields.push("amount");

    if (missingFields.length > 0) {
      throw controlledError(
        "Dados obrigatorios da cobranca PIX Banco Inter ausentes.",
        INTER_PROVIDER_INPUT_REQUIRED_CODE,
        { missingFields },
      );
    }
  }

  return normalized;
}

function validateTxidInput(input = {}) {
  const txid = nullableText(input.txid ?? input.id ?? input.chargeId ?? input.cobrancaId, 35);

  if (!txid) {
    throw controlledError("Informe o txid da cobranca PIX.", INTER_PROVIDER_TXID_REQUIRED_CODE, {
      missingFields: ["txid"],
    });
  }

  return {
    reason: nullableText(input.reason ?? input.motivo, 140),
    txid,
  };
}

function validateSyncInput(input = {}) {
  if (input.limit !== undefined && !Number.isFinite(Number(input.limit))) {
    throw controlledError(
      "Limit de sincronizacao Banco Inter invalido.",
      INTER_PROVIDER_SYNC_INPUT_INVALID_CODE,
      { field: "limit" },
    );
  }

  return {
    id: nullableText(input.id ?? input.txid ?? input.chargeId ?? input.cobrancaId, 64),
    limit: normalizeLimit(input.limit, 50),
  };
}

function validateWebhookInput(input = {}) {
  const headers = readObject(input.headers);
  const body = input.body && typeof input.body === "object" ? input.body : {};

  if (!body || Array.isArray(body)) {
    throw controlledError(
      "Webhook Banco Inter requer payload JSON valido.",
      INTER_PROVIDER_WEBHOOK_INPUT_INVALID_CODE,
      { field: "body" },
    );
  }

  return {
    body,
    headers,
  };
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.trunc(parsed);
}

function normalizeLimit(value, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(50, max);
  }

  return Math.min(Math.trunc(parsed), max);
}

function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;

  for (const [key, value] of Object.entries(details)) {
    error[key] = value;
  }

  return error;
}

module.exports = {
  INTER_PROVIDER_INPUT_REQUIRED_CODE,
  INTER_PROVIDER_SYNC_INPUT_INVALID_CODE,
  INTER_PROVIDER_TXID_REQUIRED_CODE,
  INTER_PROVIDER_WEBHOOK_INPUT_INVALID_CODE,
  INTER_PROVIDER_WEBHOOK_SIGNATURE_INVALID_CODE,
  controlledError,
  validateCreatePixInput,
  validateSyncInput,
  validateTxidInput,
  validateWebhookInput,
};
