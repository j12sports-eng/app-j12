const { AppError } = require("../../errors/app-error.js");

const PERSON_IDENTITY_LIMITS = Object.freeze({ cpf: 20, email: 191, phone: 50 });
const PERSON_IDENTITY_ERROR_CODES = Object.freeze({
  CPF_INVALID: "PERSON_CPF_INVALID",
  EMAIL_INVALID: "PERSON_EMAIL_INVALID",
  PHONE_INVALID: "PERSON_PHONE_INVALID",
  VALUE_INVALID: "PERSON_IDENTITY_VALUE_INVALID",
  VALUE_TOO_LONG: "PERSON_IDENTITY_VALUE_TOO_LONG",
});

/** Safe error that never includes the received identity value or other PII. */
class PersonIdentityNormalizationError extends AppError {
  constructor(code, field) {
    super("Identificador de pessoa invalido.", {
      code,
      details: Object.freeze({ field }),
      expose: true,
      statusCode: 400,
    });
    this.name = "PersonIdentityNormalizationError";
    this.field = field;
  }
}

/**
 * Maps logical absence to null and enforces type/size before transformation.
 * @param {unknown} value
 * @param {{ field: string, maxLength: number }} options
 * @returns {string|null}
 */
function normalizeOptionalIdentityValue(value, { field, maxLength }) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw identityError(PERSON_IDENTITY_ERROR_CODES.VALUE_INVALID, field);
  }
  if (value.length > maxLength) {
    throw identityError(PERSON_IDENTITY_ERROR_CODES.VALUE_TOO_LONG, field);
  }
  const normalized = value.trim();
  return normalized || null;
}

/** Syntactic normalization only; CPF check digits are intentionally not validated. */
function normalizeCpf(value) {
  const input = normalizeOptionalIdentityValue(value, {
    field: "cpf",
    maxLength: PERSON_IDENTITY_LIMITS.cpf,
  });
  if (input === null) return null;
  if (!/^[0-9.\-\s]+$/u.test(input)) {
    throw identityError(PERSON_IDENTITY_ERROR_CODES.CPF_INVALID, "cpf");
  }
  const digits = input.replace(/[.\-\s]/gu, "");
  if (!/^\d{11}$/u.test(digits)) {
    throw identityError(PERSON_IDENTITY_ERROR_CODES.CPF_INVALID, "cpf");
  }
  return digits;
}

/** Trims/lowercases e-mail without provider-specific alias or dot rewriting. */
function normalizeEmail(value) {
  if (typeof value === "string" && /[\u0000-\u001F\u007F]/u.test(value)) {
    throw identityError(PERSON_IDENTITY_ERROR_CODES.EMAIL_INVALID, "email");
  }
  const input = normalizeOptionalIdentityValue(value, {
    field: "email",
    maxLength: PERSON_IDENTITY_LIMITS.email,
  });
  if (input === null) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(input)) {
    throw identityError(PERSON_IDENTITY_ERROR_CODES.EMAIL_INVALID, "email");
  }
  return input.toLowerCase();
}

/** Removes known visual formatting, preserving an explicit leading `+`. */
function normalizePhone(value) {
  const input = normalizeOptionalIdentityValue(value, {
    field: "phone",
    maxLength: PERSON_IDENTITY_LIMITS.phone,
  });
  if (input === null) return null;
  if (!/^\+?[0-9().\-\s]+$/u.test(input)) {
    throw identityError(PERSON_IDENTITY_ERROR_CODES.PHONE_INVALID, "phone");
  }
  const international = input.startsWith("+");
  const digits = input.replace(/[^0-9]/gu, "");
  if (!digits) throw identityError(PERSON_IDENTITY_ERROR_CODES.PHONE_INVALID, "phone");
  const normalized = international ? `+${digits}` : digits;
  if (normalized.length > PERSON_IDENTITY_LIMITS.phone) {
    throw identityError(PERSON_IDENTITY_ERROR_CODES.VALUE_TOO_LONG, "phone");
  }
  return normalized;
}

/** Normalizes only identity fields persisted by the current `people` model. */
function normalizePersonIdentityInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw identityError(PERSON_IDENTITY_ERROR_CODES.VALUE_INVALID, "identity");
  }
  return Object.freeze({
    celular: normalizePhone(input.celular),
    cpf: normalizeCpf(input.cpf),
    email: normalizeEmail(input.email),
    telefone: normalizePhone(input.telefone),
  });
}

function identityError(code, field) {
  return new PersonIdentityNormalizationError(code, field);
}

module.exports = Object.freeze({
  PERSON_IDENTITY_ERROR_CODES,
  PERSON_IDENTITY_LIMITS,
  PersonIdentityNormalizationError,
  normalizeCpf,
  normalizeEmail,
  normalizeOptionalIdentityValue,
  normalizePersonIdentityInput,
  normalizePhone,
});
