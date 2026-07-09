const { ChampionshipMatch, ChampionshipRound } = require("../../domain/entities/index.js");

function toChampionshipRoundAdminDto(value) {
  if (!value) return null;

  const round = value instanceof ChampionshipRound ? value : new ChampionshipRound(value);

  return {
    championshipId: round.championshipId,
    createdAt: round.createdAt,
    createdBy: round.createdBy,
    id: round.id,
    matches: toChampionshipMatchAdminListDto(round.matches),
    name: round.name,
    phase: round.phase,
    roundNumber: round.roundNumber,
    updatedAt: round.updatedAt,
    updatedBy: round.updatedBy,
  };
}

function toChampionshipRoundAdminListDto(values = []) {
  return values.map(toChampionshipRoundAdminDto).filter(Boolean);
}

function toChampionshipMatchAdminDto(value) {
  if (!value) return null;

  const match = value instanceof ChampionshipMatch ? value : new ChampionshipMatch(value);

  return {
    awayRegistrationId: match.awayRegistrationId,
    awayScore: match.awayScore,
    awayTeamAcronym: match.awayTeamAcronym,
    awayTeamId: match.awayTeamId,
    awayTeamName: match.awayTeamName,
    championshipId: match.championshipId,
    court: match.court,
    createdAt: match.createdAt,
    createdBy: match.createdBy,
    groupId: match.groupId,
    groupName: match.groupName,
    homeRegistrationId: match.homeRegistrationId,
    homeScore: match.homeScore,
    homeTeamAcronym: match.homeTeamAcronym,
    homeTeamId: match.homeTeamId,
    homeTeamName: match.homeTeamName,
    id: match.id,
    matchDate: match.matchDate,
    phase: match.phase,
    roundId: match.roundId,
    roundName: match.roundName,
    roundNumber: match.roundNumber,
    resultUpdatedAt: match.resultUpdatedAt,
    resultUpdatedBy: match.resultUpdatedBy,
    startTime: match.startTime,
    status: match.status,
    updatedAt: match.updatedAt,
    updatedBy: match.updatedBy,
  };
}

function toChampionshipMatchAdminListDto(values = []) {
  return values.map(toChampionshipMatchAdminDto).filter(Boolean);
}

module.exports = {
  toChampionshipMatchAdminDto,
  toChampionshipMatchAdminListDto,
  toChampionshipRoundAdminDto,
  toChampionshipRoundAdminListDto,
};
