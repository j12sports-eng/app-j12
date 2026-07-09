const { CHAMPIONSHIP_RANKING_TYPES } = require("../../shared/constants/index.js");
const {
  controlledError,
  normalizeLimit,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

function validateChampionshipStatisticsInput(championshipId, input = {}) {
  return {
    championshipId: validateChampionshipStatisticsChampionshipId(championshipId),
    limit: normalizeLimit(readField(input, "limit", "limite"), 100),
  };
}

function validateChampionshipRankingsInput(championshipId, input = {}) {
  return {
    championshipId: validateChampionshipStatisticsChampionshipId(championshipId),
    limit: normalizeLimit(readField(input, "limit", "limite"), 20),
    type: normalizeRankingType(readField(input, "type", "tipo", "ranking")),
  };
}

function validateChampionshipTopScorersInput(championshipId, input = {}) {
  return {
    championshipId: validateChampionshipStatisticsChampionshipId(championshipId),
    limit: normalizeLimit(readField(input, "limit", "limite"), 20),
  };
}

function validateRecalculateChampionshipStatisticsInput(championshipId) {
  return {
    championshipId: validateChampionshipStatisticsChampionshipId(championshipId),
  };
}

function validateChampionshipStatisticsChampionshipId(id) {
  return requiredText(id, "championshipId", 64);
}

function normalizeRankingType(value) {
  const normalized = text(value, 80)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-\s]+/g, "_")
    .toUpperCase();

  if (!normalized) return null;

  const aliases = {
    ARTILHARIA: "topScorers",
    ATAQUE: "bestAttack",
    BEST_ATTACK: "bestAttack",
    BEST_DEFENSE: "bestDefense",
    DEFESA: "bestDefense",
    FAIR_PLAY: "fairPlay",
    FAIRPLAY: "fairPlay",
    MELHOR_ATAQUE: "bestAttack",
    MELHOR_DEFESA: "bestDefense",
    TOP_SCORERS: "topScorers",
  };
  const rankingType = aliases[normalized] || value;

  if (CHAMPIONSHIP_RANKING_TYPES.includes(rankingType)) return rankingType;

  throw controlledError("Ranking de campeonato invalido.", "CHAMPIONSHIP_RANKING_INVALID", 400, {
    ranking: value,
  });
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
  normalizeRankingType,
  validateChampionshipRankingsInput,
  validateChampionshipStatisticsChampionshipId,
  validateChampionshipStatisticsInput,
  validateChampionshipTopScorersInput,
  validateRecalculateChampionshipStatisticsInput,
};
