const { REGISTRATION_STATUSES, RegistrationStatus } = require("../../shared/enums/index.js");
const {
  controlledError,
  normalizeLimit,
  nullableText,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

const REGISTRATION_SORT_FIELDS = Object.freeze([
  "createdAt",
  "status",
  "teamName",
  "updatedAt",
]);
const AVAILABLE_TEAM_SORT_FIELDS = Object.freeze(["name", "category", "modality", "status"]);

function validateCreateRegistrationInput(input = {}) {
  return {
    championshipId: requiredText(
      input.championshipId || input.championship_id || input.campeonatoId,
      "championshipId",
      64,
    ),
    confirm: Boolean(input.confirm || input.confirmed || input.confirmar),
    observations: nullableText(input.observations || input.observacoes, 2000),
    teamId: requiredText(input.teamId || input.team_id || input.equipeId, "teamId", 64),
  };
}

function validateRegistrationListInput(input = {}) {
  return {
    championshipId: nullableText(
      input.championshipId || input.championship_id || input.campeonatoId,
      64,
    ),
    limit: normalizeLimit(input.limit, 20),
    page: normalizePage(input.page),
    search: text(input.search || input.q, 100),
    sortBy: normalizeSortField(input.sortBy || input.sort_by, REGISTRATION_SORT_FIELDS, "createdAt"),
    sortDirection: normalizeSortDirection(input.sortDirection || input.sort_direction),
    status: input.status ? normalizeRegistrationStatus(input.status) : null,
    teamId: nullableText(input.teamId || input.team_id || input.equipeId, 64),
  };
}

function validateAvailableTeamsInput(input = {}) {
  return {
    championshipId: requiredText(
      input.championshipId || input.championship_id || input.campeonatoId,
      "championshipId",
      64,
    ),
    limit: normalizeLimit(input.limit, 20),
    page: normalizePage(input.page),
    search: text(input.search || input.q, 100),
    sortBy: normalizeSortField(input.sortBy || input.sort_by, AVAILABLE_TEAM_SORT_FIELDS, "name"),
    sortDirection: normalizeSortDirection(input.sortDirection || input.sort_direction),
  };
}

function validateRegistrationId(id) {
  return requiredText(id, "registrationId", 64);
}

function validateUpdateRegistrationInput(input = {}) {
  const output = {};

  if (hasField(input, "observations", "observacoes")) {
    output.observations = nullableText(input.observations || input.observacoes, 2000);
  }

  if (hasField(input, "status")) {
    output.status = normalizeRegistrationStatus(input.status);
  }

  return output;
}

function validateUpdateRegistrationStatusInput(input = {}) {
  return {
    observations: hasField(input, "observations", "observacoes")
      ? nullableText(input.observations || input.observacoes, 2000)
      : undefined,
    status: normalizeRegistrationStatus(input.status),
  };
}

function normalizeRegistrationStatus(value, fallback = RegistrationStatus.PENDING) {
  const normalized = text(value, 32)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-\s]+/g, "_")
    .toUpperCase();

  if (!normalized) return fallback;
  if (["PENDENTE", "PENDING"].includes(normalized)) return RegistrationStatus.PENDING;
  if (["CONFIRMADA", "CONFIRMADO", "CONFIRMED"].includes(normalized)) {
    return RegistrationStatus.CONFIRMED;
  }
  if (["RECUSADA", "RECUSADO", "REFUSED", "REJECTED"].includes(normalized)) {
    return RegistrationStatus.REFUSED;
  }
  if (["CANCELADA", "CANCELADO", "CANCELED", "CANCELLED"].includes(normalized)) {
    return RegistrationStatus.CANCELLED;
  }

  if (REGISTRATION_STATUSES.includes(normalized)) return normalized;

  throw controlledError(
    "Status de inscricao invalido.",
    "CHAMPIONSHIP_REGISTRATION_STATUS_INVALID",
    400,
    { status: value },
  );
}

function normalizePage(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.trunc(parsed);
}

function normalizeSortDirection(value) {
  const normalized = text(value, 8).toUpperCase();
  return normalized === "ASC" ? "ASC" : "DESC";
}

function normalizeSortField(value, allowedFields, fallback) {
  const normalized = text(value, 64);
  return allowedFields.includes(normalized) ? normalized : fallback;
}

function hasField(source, ...keys) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(source, key));
}

module.exports = {
  normalizeRegistrationStatus,
  validateAvailableTeamsInput,
  validateCreateRegistrationInput,
  validateRegistrationId,
  validateRegistrationListInput,
  validateUpdateRegistrationInput,
  validateUpdateRegistrationStatusInput,
};
