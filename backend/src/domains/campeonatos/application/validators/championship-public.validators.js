const {
  controlledError,
  normalizeLimit,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

const PUBLIC_CHAMPIONSHIP_SORT_FIELDS = Object.freeze([
  "category",
  "modality",
  "name",
  "publishedAt",
  "startDate",
]);

function validatePublicChampionshipListInput(input = {}) {
  return {
    category: text(input.category || input.categoria, 120),
    limit: normalizePublicLimit(input.limit, 20),
    modality: text(input.modality || input.modalidade, 120),
    page: normalizePage(input.page),
    search: text(input.search || input.q, 100),
    sortBy: normalizePublicSortField(input.sortBy || input.sort_by, "publishedAt"),
    sortDirection: normalizeSortDirection(input.sortDirection || input.sort_direction, "DESC"),
  };
}

function validatePublicChampionshipId(championshipId) {
  return requiredText(championshipId, "championshipId", 64);
}

function validatePublicPaginationInput(input = {}, options = {}) {
  return {
    limit: normalizePublicLimit(input.limit, options.defaultLimit || 100),
    page: normalizePage(input.page),
  };
}

function normalizePublicLimit(value, fallback) {
  return Math.min(normalizeLimit(value, fallback), 100);
}

function normalizePage(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.trunc(parsed);
}

function normalizePublicSortField(value, fallback) {
  const normalized = text(value, 64);
  if (!normalized) return fallback;

  if (PUBLIC_CHAMPIONSHIP_SORT_FIELDS.includes(normalized)) {
    return normalized;
  }

  throw controlledError(
    "Ordenacao publica de campeonato invalida.",
    "CHAMPIONSHIP_PUBLIC_SORT_INVALID",
    400,
    { sortBy: value },
  );
}

function normalizeSortDirection(value, fallback = "ASC") {
  const normalized = text(value, 8).toUpperCase();
  if (!normalized) return fallback;
  return normalized === "ASC" ? "ASC" : "DESC";
}

module.exports = {
  PUBLIC_CHAMPIONSHIP_SORT_FIELDS,
  validatePublicChampionshipId,
  validatePublicChampionshipListInput,
  validatePublicPaginationInput,
};
