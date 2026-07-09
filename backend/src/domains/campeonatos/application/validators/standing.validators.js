const {
  CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS,
  CHAMPIONSHIP_STANDING_TIE_BREAKERS,
  ChampionshipStandingTieBreaker,
} = require("../../shared/constants/index.js");
const {
  controlledError,
  normalizeLimit,
  nullableText,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

const STANDING_SORT_FIELDS = CHAMPIONSHIP_STANDING_TIE_BREAKERS;

function validateChampionshipStandingListInput(championshipId, input = {}) {
  const criteria = normalizeTieBreakers(
    readField(input, "criteria", "criterios", "tieBreakers", "tie_breakers"),
  );

  return {
    championshipId: validateChampionshipStandingChampionshipId(championshipId),
    criteria,
    groupId: nullableText(readField(input, "groupId", "group_id", "grupoId"), 64),
    limit: normalizeLimit(input.limit, 100),
    page: normalizePage(input.page),
    sortBy: normalizeSortField(readField(input, "sortBy", "sort_by", "ordenarPor"), criteria[0]),
    sortDirection: normalizeSortDirection(readField(input, "sortDirection", "sort_direction")),
  };
}

function validateChampionshipStandingGroupInput(championshipId, groupId, input = {}) {
  return {
    ...validateChampionshipStandingListInput(championshipId, input),
    groupId: validateChampionshipStandingGroupId(groupId),
  };
}

function validateRecalculateChampionshipStandingsInput(championshipId, input = {}) {
  return {
    championshipId: validateChampionshipStandingChampionshipId(championshipId),
    criteria: normalizeTieBreakers(
      readField(input, "criteria", "criterios", "tieBreakers", "tie_breakers"),
    ),
  };
}

function validateChampionshipStandingChampionshipId(id) {
  return requiredText(id, "championshipId", 64);
}

function validateChampionshipStandingGroupId(id) {
  return requiredText(id, "groupId", 64);
}

function normalizeTieBreakers(value) {
  const rawItems = Array.isArray(value)
    ? value
    : text(value, 500)
        .split(",")
        .map((item) => item.trim());
  const normalizedItems = rawItems.map(normalizeTieBreaker).filter(Boolean);
  const unique = Array.from(new Set(normalizedItems));

  if (unique.length === 0) return [...CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS];

  return unique;
}

function normalizeTieBreaker(value) {
  const normalized = text(value, 80)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-\s]+/g, "_")
    .toUpperCase();

  if (!normalized) return "";

  const aliases = {
    DERROTAS: ChampionshipStandingTieBreaker.LOSSES,
    DRAWS: ChampionshipStandingTieBreaker.DRAWS,
    EMPATES: ChampionshipStandingTieBreaker.DRAWS,
    GOALDIFFERENCE: ChampionshipStandingTieBreaker.GOAL_DIFFERENCE,
    GOAL_DIFFERENCE: ChampionshipStandingTieBreaker.GOAL_DIFFERENCE,
    GOALSAGAINST: ChampionshipStandingTieBreaker.GOALS_AGAINST,
    GOALS_AGAINST: ChampionshipStandingTieBreaker.GOALS_AGAINST,
    GOALSFOR: ChampionshipStandingTieBreaker.GOALS_FOR,
    GOALS_FOR: ChampionshipStandingTieBreaker.GOALS_FOR,
    GOLS_CONTRA: ChampionshipStandingTieBreaker.GOALS_AGAINST,
    GOLS_PRO: ChampionshipStandingTieBreaker.GOALS_FOR,
    JOGOS: ChampionshipStandingTieBreaker.PLAYED,
    LOSSES: ChampionshipStandingTieBreaker.LOSSES,
    PARTIDAS: ChampionshipStandingTieBreaker.PLAYED,
    PLAYED: ChampionshipStandingTieBreaker.PLAYED,
    POINTS: ChampionshipStandingTieBreaker.POINTS,
    PONTOS: ChampionshipStandingTieBreaker.POINTS,
    SALDO: ChampionshipStandingTieBreaker.GOAL_DIFFERENCE,
    SALDO_GOLS: ChampionshipStandingTieBreaker.GOAL_DIFFERENCE,
    TEAMNAME: ChampionshipStandingTieBreaker.TEAM_NAME,
    TEAM_NAME: ChampionshipStandingTieBreaker.TEAM_NAME,
    TIME: ChampionshipStandingTieBreaker.TEAM_NAME,
    VITORIAS: ChampionshipStandingTieBreaker.WINS,
    WINS: ChampionshipStandingTieBreaker.WINS,
  };
  const criterion = aliases[normalized] || value;

  if (CHAMPIONSHIP_STANDING_TIE_BREAKERS.includes(criterion)) return criterion;

  throw controlledError(
    "Criterio de classificacao invalido.",
    "CHAMPIONSHIP_STANDING_CRITERION_INVALID",
    400,
    { criterion: value },
  );
}

function normalizeSortDirection(value) {
  const normalized = text(value, 8).toUpperCase();
  return normalized === "ASC" ? "ASC" : "DESC";
}

function normalizeSortField(value, fallback) {
  const normalized = normalizeTieBreaker(value || fallback);
  return STANDING_SORT_FIELDS.includes(normalized) ? normalized : fallback;
}

function normalizePage(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.trunc(parsed);
}

function readField(source, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source || {}, key)) {
      return source[key];
    }
  }

  return undefined;
}

module.exports = {
  normalizeTieBreakers,
  validateChampionshipStandingChampionshipId,
  validateChampionshipStandingGroupId,
  validateChampionshipStandingGroupInput,
  validateChampionshipStandingListInput,
  validateRecalculateChampionshipStandingsInput,
};
