const {
  PaymentChargeStatus,
  PaymentProviderId,
  normalizeAmount,
  normalizeCurrency,
  normalizeDate,
  normalizePaymentChargeStatus,
  normalizePaymentMethod,
  normalizePaymentProviderId,
  nullableText,
  readObject,
} = require("../../entities/payment.entity.js");

const PAYMENT_CHARGE_INPUT_REQUIRED_CODE = "PAYMENT_CHARGE_INPUT_REQUIRED";
const PAYMENT_CHARGE_INVALID_STATUS_CODE = "PAYMENT_CHARGE_INVALID_STATUS";
const PAYMENT_CHARGE_LOOKUP_REQUIRED_CODE = "PAYMENT_CHARGE_LOOKUP_REQUIRED";
const PAYMENT_CHARGE_UPDATE_EMPTY_CODE = "PAYMENT_CHARGE_UPDATE_EMPTY";
const PAYMENT_PROVIDER_UNSUPPORTED_CODE = "PAYMENT_PROVIDER_UNSUPPORTED";

const SUPPORTED_PAYMENT_PROVIDERS = Object.freeze(Object.values(PaymentProviderId));
const SUPPORTED_PAYMENT_STATUSES = Object.freeze(Object.values(PaymentChargeStatus));

function validateCreatePaymentChargeInput(input = {}) {
  const metadata = readObject(input.metadata);
  const provider = validatePaymentProvider(input.provider ?? input.gateway);
  const normalized = {
    amount: normalizeAmount(input.amount ?? input.valor),
    createdBy: nullableText(input.createdBy ?? input.requestedBy, 191),
    currency: normalizeCurrency(input.currency),
    description: nullableText(input.description ?? input.descricao, 191),
    dueDate: normalizeDate(input.dueDate ?? input.vencimento),
    id: nullableText(input.id, 64),
    legacyChargeId: nullableText(
      input.legacyChargeId ?? input.legacy_charge_id ?? input.cobrancaId,
      64,
    ),
    mensalidadeId: nullableText(input.mensalidadeId ?? input.mensalidade_id, 64),
    metadata,
    paymentMethod: normalizePaymentMethod(input.paymentMethod ?? input.formaPagamento),
    provider,
    responsibleId: nullableText(input.responsibleId ?? input.responsavelId, 64),
    status: normalizePaymentChargeStatus(input.status),
    studentId: nullableText(input.studentId ?? input.alunoId, 64),
  };
  const missingFields = [];

  if (!normalized.studentId) missingFields.push("studentId");
  if (!normalized.description) missingFields.push("description");
  if (!normalized.dueDate || !isDateOnly(normalized.dueDate)) missingFields.push("dueDate");
  if (normalized.amount <= 0) missingFields.push("amount");

  if (missingFields.length > 0) {
    throw controlledError(
      "Dados obrigatorios da cobranca financeira ausentes.",
      PAYMENT_CHARGE_INPUT_REQUIRED_CODE,
      {
        missingFields,
      },
    );
  }

  validatePaymentStatus(normalized.status);
  return normalized;
}

function validateUpdatePaymentChargeInput(input = {}) {
  const id = requiredLookupId(input);
  const patch = {};

  if (hasOwn(input, "amount") || hasOwn(input, "valor")) {
    patch.amount = normalizeAmount(input.amount ?? input.valor);
    if (patch.amount <= 0) {
      throw controlledError(
        "Valor da cobranca deve ser maior que zero.",
        PAYMENT_CHARGE_INPUT_REQUIRED_CODE,
        {
          missingFields: ["amount"],
        },
      );
    }
  }

  if (hasOwn(input, "currency")) {
    patch.currency = normalizeCurrency(input.currency);
  }

  if (hasOwn(input, "description") || hasOwn(input, "descricao")) {
    patch.description = nullableText(input.description ?? input.descricao, 191);
    if (!patch.description) {
      throw controlledError(
        "Descricao da cobranca e obrigatoria.",
        PAYMENT_CHARGE_INPUT_REQUIRED_CODE,
        {
          missingFields: ["description"],
        },
      );
    }
  }

  if (hasOwn(input, "dueDate") || hasOwn(input, "vencimento")) {
    patch.dueDate = normalizeDate(input.dueDate ?? input.vencimento);
    if (!patch.dueDate || !isDateOnly(patch.dueDate)) {
      throw controlledError(
        "Vencimento da cobranca e obrigatorio.",
        PAYMENT_CHARGE_INPUT_REQUIRED_CODE,
        {
          missingFields: ["dueDate"],
        },
      );
    }
  }

  if (hasOwn(input, "provider") || hasOwn(input, "gateway")) {
    patch.provider = validatePaymentProvider(input.provider ?? input.gateway);
  }

  if (hasOwn(input, "status")) {
    patch.status = validatePaymentStatus(normalizePaymentChargeStatus(input.status));
  }

  if (hasOwn(input, "paymentMethod") || hasOwn(input, "formaPagamento")) {
    patch.paymentMethod = normalizePaymentMethod(input.paymentMethod ?? input.formaPagamento);
  }

  if (hasOwn(input, "metadata")) {
    patch.metadata = readObject(input.metadata);
  }

  if (hasOwn(input, "legacyChargeId") || hasOwn(input, "cobrancaId")) {
    patch.legacyChargeId = nullableText(input.legacyChargeId ?? input.cobrancaId, 64);
  }

  if (hasOwn(input, "mensalidadeId") || hasOwn(input, "mensalidade_id")) {
    patch.mensalidadeId = nullableText(input.mensalidadeId ?? input.mensalidade_id, 64);
  }

  if (hasOwn(input, "responsibleId") || hasOwn(input, "responsavelId")) {
    patch.responsibleId = nullableText(input.responsibleId ?? input.responsavelId, 64);
  }

  if (Object.keys(patch).length === 0) {
    throw controlledError(
      "Informe ao menos um campo para atualizar a cobranca.",
      PAYMENT_CHARGE_UPDATE_EMPTY_CODE,
    );
  }

  return {
    id,
    patch,
    updatedBy: nullableText(input.updatedBy ?? input.requestedBy, 191),
  };
}

function validateChargeLookupInput(input = {}) {
  return {
    id: requiredLookupId(input),
  };
}

function validateCancelPaymentChargeInput(input = {}) {
  return {
    cancelledBy: nullableText(input.cancelledBy ?? input.requestedBy, 191),
    id: requiredLookupId(input),
    reason: nullableText(input.reason ?? input.motivo, 65535),
  };
}

function validateListPaymentChargesInput(input = {}) {
  const provider = nullableText(input.provider ?? input.gateway, 50);
  const status = nullableText(input.status, 30);

  return {
    limit: normalizeLimit(input.limit, 100),
    provider: provider ? validatePaymentProvider(provider) : null,
    status: status ? validatePaymentStatus(normalizePaymentChargeStatus(status)) : null,
    studentId: nullableText(input.studentId ?? input.alunoId, 64),
  };
}

function validatePaymentProvider(value) {
  const provider = normalizePaymentProviderId(value);

  if (!SUPPORTED_PAYMENT_PROVIDERS.includes(provider)) {
    throw controlledError(
      `Provider de pagamento nao suportado: ${provider}.`,
      PAYMENT_PROVIDER_UNSUPPORTED_CODE,
      {
        provider,
        supportedProviders: SUPPORTED_PAYMENT_PROVIDERS,
      },
    );
  }

  return provider;
}

function validatePaymentStatus(status) {
  if (!SUPPORTED_PAYMENT_STATUSES.includes(status)) {
    throw controlledError(
      `Status de cobranca invalido: ${status}.`,
      PAYMENT_CHARGE_INVALID_STATUS_CODE,
      {
        status,
        supportedStatuses: SUPPORTED_PAYMENT_STATUSES,
      },
    );
  }

  return status;
}

function requiredLookupId(input = {}) {
  const id = nullableText(input.id ?? input.chargeId ?? input.cobrancaId, 64);

  if (!id) {
    throw controlledError("Informe o id da cobranca.", PAYMENT_CHARGE_LOOKUP_REQUIRED_CODE, {
      missingFields: ["id"],
    });
  }

  return id;
}

function normalizeLimit(value, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(50, max);
  }

  return Math.min(Math.trunc(parsed), max);
}

function isDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function hasOwn(input, key) {
  return Object.prototype.hasOwnProperty.call(input, key);
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
  PAYMENT_CHARGE_INPUT_REQUIRED_CODE,
  PAYMENT_CHARGE_INVALID_STATUS_CODE,
  PAYMENT_CHARGE_LOOKUP_REQUIRED_CODE,
  PAYMENT_CHARGE_UPDATE_EMPTY_CODE,
  PAYMENT_PROVIDER_UNSUPPORTED_CODE,
  SUPPORTED_PAYMENT_PROVIDERS,
  controlledError,
  validateCancelPaymentChargeInput,
  validateChargeLookupInput,
  validateCreatePaymentChargeInput,
  validateListPaymentChargesInput,
  validatePaymentProvider,
  validatePaymentStatus,
  validateUpdatePaymentChargeInput,
};
