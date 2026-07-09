const {
  controlledError,
  normalizeDate,
  normalizeLimit,
  nullableText,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

const REGISTRATION_PLAYER_SORT_FIELDS = Object.freeze([
  "createdAt",
  "name",
  "position",
  "shirtNumber",
  "updatedAt",
]);

function validateCreateRegistrationPlayerInput(input = {}) {
  return {
    active: normalizeBoolean(readField(input, "active", "ativo"), true),
    athleteId: nullableText(readField(input, "athleteId", "athlete_id", "atletaId"), 64),
    birthDate: normalizeOptionalDate(readField(input, "birthDate", "birth_date", "dataNascimento")),
    captain: normalizeBoolean(readField(input, "captain", "capitao"), false),
    document: nullableText(readField(input, "document", "documento"), 64),
    name: requiredText(readField(input, "name", "nome"), "name", 191),
    position: nullableText(readField(input, "position", "posicao"), 80),
    shirtNumber: normalizeShirtNumber(
      readField(input, "shirtNumber", "shirt_number", "numeroCamisa"),
    ),
  };
}

function validateUpdateRegistrationPlayerInput(input = {}) {
  const output = {};

  if (hasField(input, "active", "ativo")) {
    output.active = normalizeBoolean(input.active ?? input.ativo, true);
  }

  if (hasField(input, "athleteId", "athlete_id", "atletaId")) {
    output.athleteId = nullableText(readField(input, "athleteId", "athlete_id", "atletaId"), 64);
  }

  if (hasField(input, "birthDate", "birth_date", "dataNascimento")) {
    output.birthDate = normalizeOptionalDate(
      readField(input, "birthDate", "birth_date", "dataNascimento"),
    );
  }

  if (hasField(input, "captain", "capitao")) {
    output.captain = normalizeBoolean(input.captain ?? input.capitao, false);
  }

  if (hasField(input, "document", "documento")) {
    output.document = nullableText(readField(input, "document", "documento"), 64);
  }

  if (hasField(input, "name", "nome")) {
    output.name = requiredText(readField(input, "name", "nome"), "name", 191);
  }

  if (hasField(input, "position", "posicao")) {
    output.position = nullableText(readField(input, "position", "posicao"), 80);
  }

  if (hasField(input, "shirtNumber", "shirt_number", "numeroCamisa")) {
    output.shirtNumber = normalizeShirtNumber(
      readField(input, "shirtNumber", "shirt_number", "numeroCamisa"),
    );
  }

  return output;
}

function validateRegistrationPlayerListInput(input = {}) {
  return {
    active: normalizeActiveFilter(input.active ?? input.ativo ?? input.status),
    limit: normalizeLimit(input.limit, 20),
    page: normalizePage(input.page),
    position: nullableText(input.position || input.posicao, 80),
    search: text(input.search || input.q, 100),
    sortBy: normalizeSortField(
      input.sortBy || input.sort_by,
      REGISTRATION_PLAYER_SORT_FIELDS,
      "shirtNumber",
    ),
    sortDirection: normalizeSortDirection(input.sortDirection || input.sort_direction),
  };
}

function validateSetCaptainInput(input = {}) {
  return {
    captain: hasField(input, "captain", "capitao")
      ? normalizeBoolean(input.captain ?? input.capitao, true)
      : true,
  };
}

function validateRegistrationPlayerRegistrationId(id) {
  return requiredText(id, "registrationId", 64);
}

function validateRegistrationPlayerId(id) {
  return requiredText(id, "playerId", 64);
}

function normalizeShirtNumber(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 999) {
    throw controlledError(
      "Numero da camisa invalido.",
      "CHAMPIONSHIP_REGISTRATION_PLAYER_SHIRT_NUMBER_INVALID",
      400,
      { shirtNumber: value },
    );
  }

  return Math.trunc(parsed);
}

function normalizeOptionalDate(value) {
  return normalizeDate(value, "birthDate", { required: false });
}

function normalizeActiveFilter(value) {
  const normalized = text(value, 20)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-\s]+/g, "_")
    .toUpperCase();

  if (!normalized || ["ALL", "TODOS", "TODAS"].includes(normalized)) return null;
  if (["ACTIVE", "ATIVO", "ATIVA", "TRUE", "1"].includes(normalized)) return true;
  if (["INACTIVE", "INATIVO", "INATIVA", "FALSE", "0"].includes(normalized)) return false;

  throw controlledError(
    "Status do atleta invalido.",
    "CHAMPIONSHIP_REGISTRATION_PLAYER_STATUS_INVALID",
    400,
    { status: value },
  );
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = text(value, 20)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (!normalized) return fallback;
  if (["1", "SIM", "S", "TRUE", "YES", "Y", "ATIVO", "ATIVA"].includes(normalized)) {
    return true;
  }
  if (["0", "NAO", "N", "FALSE", "NO", "INATIVO", "INATIVA"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function normalizePage(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.trunc(parsed);
}

function normalizeSortDirection(value) {
  const normalized = text(value, 8).toUpperCase();
  return normalized === "DESC" ? "DESC" : "ASC";
}

function normalizeSortField(value, allowedFields, fallback) {
  const normalized = text(value, 64);
  return allowedFields.includes(normalized) ? normalized : fallback;
}

function hasField(source, ...keys) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(source, key));
}

function readField(source, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key];
    }
  }

  return undefined;
}

module.exports = {
  normalizeActiveFilter,
  validateCreateRegistrationPlayerInput,
  validateRegistrationPlayerId,
  validateRegistrationPlayerRegistrationId,
  validateRegistrationPlayerListInput,
  validateSetCaptainInput,
  validateUpdateRegistrationPlayerInput,
};
