const {
  ChampionshipMatchEvent,
  ChampionshipMatchReport,
} = require("../../domain/entities/index.js");

function toChampionshipMatchReportAdminDto(value) {
  if (!value) return null;

  const report =
    value instanceof ChampionshipMatchReport ? value : new ChampionshipMatchReport(value);
  const events = toChampionshipMatchEventAdminListDto(report.events);
  const score = calculateEventScore(report.match, events);

  return {
    assistantReferee: report.assistantReferee,
    awayScore: report.awayScore,
    calculatedAwayScore: score.awayScore,
    calculatedHomeScore: score.homeScore,
    championshipId: report.championshipId,
    createdAt: report.createdAt,
    createdBy: report.createdBy,
    events,
    finishedAt: report.finishedAt,
    hasWalkover: events.some((event) => event.eventType === "WALKOVER"),
    homeScore: report.homeScore,
    id: report.id,
    match: normalizeMatchDto(report.match),
    matchId: report.matchId,
    observations: report.observations,
    referee: report.referee,
    scorer: report.scorer,
    startedAt: report.startedAt,
    status: report.status,
    updatedAt: report.updatedAt,
    updatedBy: report.updatedBy,
  };
}

function toChampionshipMatchEventAdminDto(value) {
  if (!value) return null;

  const event = value instanceof ChampionshipMatchEvent ? value : new ChampionshipMatchEvent(value);

  return {
    championshipId: event.championshipId,
    createdAt: event.createdAt,
    createdBy: event.createdBy,
    description: event.description,
    eventType: event.eventType,
    id: event.id,
    matchId: event.matchId,
    metadata: event.metadata || {},
    minute: event.minute,
    period: event.period,
    playerId: event.playerId,
    playerName: event.playerName,
    playerShirtNumber: event.playerShirtNumber,
    relatedPlayerId: event.relatedPlayerId,
    relatedPlayerName: event.relatedPlayerName,
    relatedPlayerShirtNumber: event.relatedPlayerShirtNumber,
    reportId: event.reportId,
    teamAcronym: event.teamAcronym,
    teamName: event.teamName,
    teamRegistrationId: event.teamRegistrationId,
    updatedAt: event.updatedAt,
    updatedBy: event.updatedBy,
  };
}

function toChampionshipMatchEventAdminListDto(values = []) {
  return values.map(toChampionshipMatchEventAdminDto).filter(Boolean);
}

function normalizeMatchDto(match) {
  if (!match || typeof match !== "object") return null;

  return {
    awayRegistrationId: match.awayRegistrationId || null,
    awayScore: normalizeScore(match.awayScore),
    awayTeamAcronym: match.awayTeamAcronym || null,
    awayTeamId: match.awayTeamId || null,
    awayTeamName: match.awayTeamName || null,
    championshipId: match.championshipId || null,
    court: match.court || null,
    groupId: match.groupId || null,
    groupName: match.groupName || null,
    homeRegistrationId: match.homeRegistrationId || null,
    homeScore: normalizeScore(match.homeScore),
    homeTeamAcronym: match.homeTeamAcronym || null,
    homeTeamId: match.homeTeamId || null,
    homeTeamName: match.homeTeamName || null,
    id: match.id || null,
    matchDate: match.matchDate || null,
    phase: match.phase || null,
    roundId: match.roundId || null,
    roundName: match.roundName || null,
    roundNumber: Number.isFinite(Number(match.roundNumber)) ? Number(match.roundNumber) : 0,
    startTime: match.startTime || null,
    status: match.status || null,
  };
}

function calculateEventScore(match, events) {
  const score = {
    awayScore: 0,
    homeScore: 0,
  };

  const homeRegistrationId = match?.homeRegistrationId || null;
  const awayRegistrationId = match?.awayRegistrationId || null;

  for (const event of events) {
    if (event.eventType !== "GOAL") continue;

    if (event.teamRegistrationId === homeRegistrationId) {
      score.homeScore += 1;
    }

    if (event.teamRegistrationId === awayRegistrationId) {
      score.awayScore += 1;
    }
  }

  return score;
}

function normalizeScore(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

module.exports = {
  toChampionshipMatchEventAdminDto,
  toChampionshipMatchEventAdminListDto,
  toChampionshipMatchReportAdminDto,
};
