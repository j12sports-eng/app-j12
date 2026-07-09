const {
  ChampionshipPlayerStatistics,
  ChampionshipStatistics,
  ChampionshipTeamStatistics,
} = require("../../domain/entities/index.js");

function toChampionshipStatisticsAdminDto(value) {
  if (!value) return null;

  const statistics =
    value instanceof ChampionshipStatistics ? value : new ChampionshipStatistics(value);

  return {
    calculatedAt: statistics.calculatedAt,
    championshipId: statistics.championshipId,
    finishedMatches: statistics.finishedMatches,
    goalsAverage: statistics.goalsAverage,
    goalsScored: statistics.goalsScored,
    id: statistics.id,
    matchesPlayed: statistics.matchesPlayed,
    redCards: statistics.redCards,
    updatedAt: statistics.updatedAt,
    walkovers: statistics.walkovers,
    yellowCards: statistics.yellowCards,
  };
}

function toChampionshipTeamStatisticsAdminDto(value) {
  if (!value) return null;

  const statistics =
    value instanceof ChampionshipTeamStatistics ? value : new ChampionshipTeamStatistics(value);

  return {
    calculatedAt: statistics.calculatedAt,
    championshipId: statistics.championshipId,
    draws: statistics.draws,
    goalDifference: statistics.goalDifference,
    goalsAgainst: statistics.goalsAgainst,
    goalsFor: statistics.goalsFor,
    id: statistics.id,
    losses: statistics.losses,
    matches: statistics.matches,
    performance: statistics.performance,
    points: statistics.points,
    redCards: statistics.redCards,
    registrationId: statistics.registrationId,
    resultStreak: statistics.resultStreak,
    teamAcronym: statistics.teamAcronym,
    teamId: statistics.teamId,
    teamName: statistics.teamName,
    updatedAt: statistics.updatedAt,
    walkovers: statistics.walkovers,
    wins: statistics.wins,
    yellowCards: statistics.yellowCards,
  };
}

function toChampionshipPlayerStatisticsAdminDto(value) {
  if (!value) return null;

  const statistics =
    value instanceof ChampionshipPlayerStatistics ? value : new ChampionshipPlayerStatistics(value);

  return {
    calculatedAt: statistics.calculatedAt,
    championshipId: statistics.championshipId,
    goals: statistics.goals,
    id: statistics.id,
    matches: statistics.matches,
    playerId: statistics.playerId,
    playerName: statistics.playerName,
    redCards: statistics.redCards,
    registrationId: statistics.registrationId,
    shirtNumber: statistics.shirtNumber,
    teamAcronym: statistics.teamAcronym,
    teamId: statistics.teamId,
    teamName: statistics.teamName,
    updatedAt: statistics.updatedAt,
    yellowCards: statistics.yellowCards,
  };
}

function toChampionshipTeamStatisticsAdminListDto(values = []) {
  return values.map(toChampionshipTeamStatisticsAdminDto).filter(Boolean);
}

function toChampionshipPlayerStatisticsAdminListDto(values = []) {
  return values.map(toChampionshipPlayerStatisticsAdminDto).filter(Boolean);
}

function toChampionshipStatisticsAdminResponseDto(input = {}) {
  const championship = toChampionshipStatisticsAdminDto(input.championship || input.statistics);
  const teams = toChampionshipTeamStatisticsAdminListDto(input.teams || []);
  const athletes = toChampionshipPlayerStatisticsAdminListDto(
    input.players || input.athletes || [],
  );

  return {
    athletes,
    calculatedAt: championship?.calculatedAt || input.calculatedAt || null,
    championship,
    championshipId: championship?.championshipId || input.championshipId || null,
    rankings: normalizeRankings(input.rankings || {}),
    teams,
    totalAthletes: athletes.length,
    totalTeams: teams.length,
  };
}

function toChampionshipRankingsAdminResponseDto(input = {}) {
  return {
    calculatedAt: input.calculatedAt || input.championship?.calculatedAt || null,
    championshipId: input.championshipId || input.championship?.championshipId || null,
    limit: Number(input.limit || 20),
    rankings: normalizeRankings(input.rankings || {}),
  };
}

function toChampionshipTopScorersAdminResponseDto(input = {}) {
  return {
    calculatedAt: input.calculatedAt || input.championship?.calculatedAt || null,
    championshipId: input.championshipId || input.championship?.championshipId || null,
    items: (input.items || []).map(normalizeRankingItem),
    limit: Number(input.limit || 20),
    total: Number(input.total || input.items?.length || 0),
  };
}

function normalizeRankings(rankings = {}) {
  return {
    bestAttack: (rankings.bestAttack || []).map(normalizeRankingItem),
    bestDefense: (rankings.bestDefense || []).map(normalizeRankingItem),
    fairPlay: (rankings.fairPlay || []).map(normalizeRankingItem),
    topScorers: (rankings.topScorers || []).map(normalizeRankingItem),
  };
}

function normalizeRankingItem(item = {}) {
  return {
    ...item,
    position: Number(item.position || 0),
  };
}

module.exports = {
  toChampionshipPlayerStatisticsAdminDto,
  toChampionshipPlayerStatisticsAdminListDto,
  toChampionshipRankingsAdminResponseDto,
  toChampionshipStatisticsAdminDto,
  toChampionshipStatisticsAdminResponseDto,
  toChampionshipTeamStatisticsAdminDto,
  toChampionshipTeamStatisticsAdminListDto,
  toChampionshipTopScorersAdminResponseDto,
};
