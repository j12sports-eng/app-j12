const { ChampionshipBracket, ChampionshipBracketMatch } = require("../../domain/entities/index.js");
const { CHAMPIONSHIP_BRACKET_PHASE_ORDER } = require("../../shared/constants/index.js");

function toChampionshipBracketAdminDto(value) {
  if (!value) return null;

  const bracket = value instanceof ChampionshipBracket ? value : new ChampionshipBracket(value);
  const matches = toChampionshipBracketMatchAdminListDto(bracket.matches);

  return {
    championRegistrationId: bracket.championRegistrationId,
    championshipId: bracket.championshipId,
    createdAt: bracket.createdAt,
    createdBy: bracket.createdBy,
    displayOrder: bracket.displayOrder,
    id: bracket.id,
    includeThirdPlace: bracket.includeThirdPlace,
    initialPhase: bracket.initialPhase,
    matches,
    mode: bracket.mode,
    phases: toChampionshipBracketPhaseListDto(matches),
    runnerUpRegistrationId: bracket.runnerUpRegistrationId,
    status: bracket.status,
    teamCount: bracket.teamCount,
    thirdPlaceRegistrationId: bracket.thirdPlaceRegistrationId,
    updatedAt: bracket.updatedAt,
    updatedBy: bracket.updatedBy,
  };
}

function toChampionshipBracketMatchAdminDto(value) {
  if (!value) return null;

  const match =
    value instanceof ChampionshipBracketMatch ? value : new ChampionshipBracketMatch(value);

  return {
    awayRegistrationId: match.awayRegistrationId,
    awayScore: match.awayScore,
    awayTeamAcronym: match.awayTeamAcronym,
    awayTeamId: match.awayTeamId,
    awayTeamName: match.awayTeamName,
    bracketId: match.bracketId,
    championshipId: match.championshipId,
    court: match.court,
    createdAt: match.createdAt,
    createdBy: match.createdBy,
    displayOrder: match.displayOrder,
    homeRegistrationId: match.homeRegistrationId,
    homeScore: match.homeScore,
    homeTeamAcronym: match.homeTeamAcronym,
    homeTeamId: match.homeTeamId,
    homeTeamName: match.homeTeamName,
    id: match.id,
    matchDate: match.matchDate,
    nextMatchId: match.nextMatchId,
    nextMatchSlot: match.nextMatchSlot,
    phase: match.phase,
    resultUpdatedAt: match.resultUpdatedAt,
    resultUpdatedBy: match.resultUpdatedBy,
    roundOrder: match.roundOrder,
    startTime: match.startTime,
    status: match.status,
    thirdPlaceMatchId: match.thirdPlaceMatchId,
    thirdPlaceSlot: match.thirdPlaceSlot,
    updatedAt: match.updatedAt,
    updatedBy: match.updatedBy,
    winnerRegistrationId: match.winnerRegistrationId,
    winnerTeamAcronym: match.winnerTeamAcronym,
    winnerTeamId: match.winnerTeamId,
    winnerTeamName: match.winnerTeamName,
  };
}

function toChampionshipBracketMatchAdminListDto(values = []) {
  return values.map(toChampionshipBracketMatchAdminDto).filter(Boolean);
}

function toChampionshipBracketPhaseListDto(matches = []) {
  const grouped = new Map();

  for (const match of matches) {
    const item = grouped.get(match.phase) || {
      matches: [],
      phase: match.phase,
      total: 0,
    };
    item.matches.push(match);
    item.total += 1;
    grouped.set(match.phase, item);
  }

  return Array.from(grouped.values()).sort(
    (left, right) => phaseOrder(left.phase) - phaseOrder(right.phase),
  );
}

function phaseOrder(phase) {
  const index = CHAMPIONSHIP_BRACKET_PHASE_ORDER.indexOf(phase);
  return index >= 0 ? index : 999;
}

module.exports = {
  toChampionshipBracketAdminDto,
  toChampionshipBracketMatchAdminDto,
  toChampionshipBracketMatchAdminListDto,
  toChampionshipBracketPhaseListDto,
};
