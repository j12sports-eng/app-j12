const INTER_CHARGE_LOOKUP_REQUIRED_CODE = "INTER_CHARGE_LOOKUP_REQUIRED";
const INTER_CHARGE_INPUT_REQUIRED_CODE = "INTER_CHARGE_INPUT_REQUIRED";
const INTER_SYNC_INPUT_INVALID_CODE = "INTER_SYNC_INPUT_INVALID";
const INTER_WEBHOOK_INPUT_INVALID_CODE = "INTER_WEBHOOK_INPUT_INVALID";

function validateCreateInterChargeInput(input = {}) {
  const normalized = {
    amount: normalizeAmount(input.amount ?? input.valor),
    chargeId: nullableText(input.chargeId ?? input.cobrancaId ?? input.cobranca_id, 64),
    description: nullableText(input.description ?? input.descricao, 140),
    expiresIn: normalizePositiveInteger(input.expiresIn ?? input.expiracao, 86400),
    externalId: nullableText(input.externalId ?? input.idExterno, 64),
    id: nullableText(input.id, 64),
    mensalidadeId: nullableText(
      input.mensalidadeId ?? input.mensalidade_id ?? input.installmentId,
      64,
    ),
    pixKey: nullableText(input.pixKey ?? input.chavePix, 191),
    txid: nullableText(input.txid, 35),
  };

  if (!normalized.chargeId && !normalized.mensalidadeId && !normalized.id) {
    throw controlledError(
      "Informe cobrancaId, mensalidadeId ou id para emitir cobranca Banco Inter.",
      INTER_CHARGE_INPUT_REQUIRED_CODE,
      { fields: ["cobrancaId", "mensalidadeId", "id"] },
    );
  }

  return normalized;
}

function validateChargeLookupInput(input = {}) {
  const id = nullableText(input.id ?? input.txid ?? input.chargeId ?? input.cobrancaId, 64);

  if (!id) {
    throw controlledError(
      "Informe o id ou txid da cobranca Banco Inter.",
      INTER_CHARGE_LOOKUP_REQUIRED_CODE,
      { fields: ["id"] },
    );
  }

  return { id };
}

function validateSyncInput(input = {}) {
  const limit = normalizeLimit(input.limit, 50);
  const id = nullableText(input.id ?? input.txid ?? input.chargeId ?? input.cobrancaId, 64);

  if (input.limit !== undefined && !Number.isFinite(Number(input.limit))) {
    throw controlledError("Limit de sincronizacao invalido.", INTER_SYNC_INPUT_INVALID_CODE, {
      field: "limit",
    });
  }

  return {
    id,
    limit,
  };
}

function validateWebhookInput(input = {}) {
  const headers = readObject(input.headers);
  const body = input.body && typeof input.body === "object" ? input.body : {};

  if (!body || Array.isArray(body)) {
    throw controlledError(
      "Webhook Banco Inter requer payload JSON valido.",
      INTER_WEBHOOK_INPUT_INVALID_CODE,
      { field: "body" },
    );
  }

  return {
    body,
    headers,
  };
}

function normalizeAmount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Number(parsed.toFixed(2));
}

function normalizeLimit(value, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(50, max);
  }

  return Math.min(Math.trunc(parsed), max);
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.trunc(parsed);
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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

  for (const [key, value] of Object.entries(details)) {
    error[key] = value;
  }

  return error;
}

module.exports = {
  INTER_CHARGE_INPUT_REQUIRED_CODE,
  INTER_CHARGE_LOOKUP_REQUIRED_CODE,
  INTER_SYNC_INPUT_INVALID_CODE,
  INTER_WEBHOOK_INPUT_INVALID_CODE,
  controlledError,
  nullableText,
  validateChargeLookupInput,
  validateCreateInterChargeInput,
  validateSyncInput,
  validateWebhookInput,
};
