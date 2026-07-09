const {
  toChampionshipRankingsAdminResponseDto,
  toChampionshipStatisticsAdminResponseDto,
  toChampionshipTopScorersAdminResponseDto,
} = require("../dtos/index.js");
const {
  validateChampionshipRankingsInput,
  validateChampionshipStatisticsInput,
  validateChampionshipTopScorersInput,
  validateRecalculateChampionshipStatisticsInput,
} = require("../validators/index.js");
const {
  ChampionshipMatchEventType,
  ChampionshipMatchReportStatus,
  ChampionshipMatchStatus,
} = require("../../shared/constants/index.js");
const { controlledError } = require("../../shared/utils/index.js");

const STATISTICS_CHAMPIONSHIP_REPOSITORY_REQUIRED_CODE =
  "CHAMPIONSHIP_STATISTICS_CHAMPIONSHIP_REPOSITORY_REQUIRED";
const STATISTICS_REPOSITORY_REQUIRED_CODE = "CHAMPIONSHIP_STATISTICS_REPOSITORY_REQUIRED";
const STATISTICS_CHAMPIONSHIP_NOT_FOUND_CODE = "CHAMPIONSHIP_STATISTICS_CHAMPIONSHIP_NOT_FOUND";

class ChampionshipStatisticsService {
  constructor(options = {}) {
    this.championshipRepository = options.championshipRepository || null;
    this.statisticsRepository =
      options.statisticsRepository || options.championshipStatisticsRepository || null;
  }

  async findStatistics(championshipId, input = {}) {
    const values = validateChampionshipStatisticsInput(championshipId, input);
    const snapshot = await this.calculateAndPersist(values.championshipId);
    const rankings = buildRankings(snapshot, values.limit);

    return toChampionshipStatisticsAdminResponseDto({
      ...snapshot,
      rankings,
    });
  }

  async findRankings(championshipId, input = {}) {
    const values = validateChampionshipRankingsInput(championshipId, input);
    const snapshot = await this.calculateAndPersist(values.championshipId);
    const allRankings = buildRankings(snapshot, values.limit);
    const rankings = values.type ? { [values.type]: allRankings[values.type] || [] } : allRankings;

    return toChampionshipRankingsAdminResponseDto({
      calculatedAt: snapshot.championship?.calculatedAt || null,
      championship: snapshot.championship,
      championshipId: values.championshipId,
      limit: values.limit,
      rankings,
    });
  }

  async findTopScorers(championshipId, input = {}) {
    const values = validateChampionshipTopScorersInput(championshipId, input);
    const snapshot = await this.calculateAndPersist(values.championshipId);
    const items = buildTopScorers(snapshot.players, values.limit);

    return toChampionshipTopScorersAdminResponseDto({
      calculatedAt: snapshot.championship?.calculatedAt || null,
      championship: snapshot.championship,
      championshipId: values.championshipId,
      items,
      limit: values.limit,
      total: items.length,
    });
  }

  async recalculate(championshipId) {
    const values = validateRecalculateChampionshipStatisticsInput(championshipId);
    const snapshot = await this.calculateAndPersist(values.championshipId);
    const rankings = buildRankings(snapshot);

    return toChampionshipStatisticsAdminResponseDto({
      ...snapshot,
      rankings,
    });
  }

  async calculateAndPersist(championshipId) {
    await this.requireChampionship(championshipId);

    const data = await this.getStatisticsRepository().fetchCalculationData(championshipId);
    const calculated = calculateChampionshipStatistics(championshipId, data);
    const persisted = await this.getStatisticsRepository().replaceByChampionship(
      championshipId,
      calculated,
    );

    return normalizeSnapshot(persisted || calculated);
  }

  async requireChampionship(championshipId) {
    const championship = await this.getChampionshipRepository().findById(championshipId);

    if (!championship) {
      throw controlledError(
        "Campeonato nao encontrado.",
        STATISTICS_CHAMPIONSHIP_NOT_FOUND_CODE,
        404,
        { championshipId },
      );
    }

    return championship;
  }

  getChampionshipRepository() {
    if (
      !this.championshipRepository ||
      typeof this.championshipRepository.findById !== "function"
    ) {
      throw controlledError(
        "Repositorio de campeonatos nao configurado.",
        STATISTICS_CHAMPIONSHIP_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.championshipRepository;
  }

  getStatisticsRepository() {
    if (!this.statisticsRepository) {
      throw controlledError(
        "Repositorio de estatisticas de campeonato nao configurado.",
        STATISTICS_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.statisticsRepository;
  }
}

function calculateChampionshipStatistics(championshipId, data = {}) {
  const reports = (data.reports || []).map(normalizeReport).filter(Boolean);
  const events = (data.events || []).map(normalizeEvent).filter(Boolean);
  const reportsById = new Map(reports.map((report) => [report.id, report]));
  const reportsByMatchId = new Map(reports.map((report) => [report.matchId, report]));
  const eventCountByReport = new Map();

  for (const event of events) {
    if (!event.reportId) continue;
    eventCountByReport.set(event.reportId, (eventCountByReport.get(event.reportId) || 0) + 1);
  }

  const calculatedAt = new Date().toISOString();
  const teamMap = new Map();
  const playerMap = new Map();
  const playerMatches = new Map();
  const championship = {
    calculatedAt,
    championshipId,
    finishedMatches: 0,
    goalsAverage: 0,
    goalsScored: 0,
    matchesPlayed: 0,
    redCards: 0,
    walkovers: 0,
    yellowCards: 0,
  };

  for (const report of reports) {
    upsertTeam(teamMap, {
      championshipId,
      registrationId: report.homeRegistrationId,
      teamAcronym: report.homeTeamAcronym,
      teamId: report.homeTeamId,
      teamName: report.homeTeamName,
    });
    upsertTeam(teamMap, {
      championshipId,
      registrationId: report.awayRegistrationId,
      teamAcronym: report.awayTeamAcronym,
      teamId: report.awayTeamId,
      teamName: report.awayTeamName,
    });

    if (isReportPlayed(report, eventCountByReport.get(report.id) || 0)) {
      championship.matchesPlayed += 1;
    }
  }

  for (const report of reports.filter(isFinishedReport).sort(compareReportOrder)) {
    const homeTeam = upsertTeam(teamMap, {
      championshipId,
      registrationId: report.homeRegistrationId,
      teamAcronym: report.homeTeamAcronym,
      teamId: report.homeTeamId,
      teamName: report.homeTeamName,
    });
    const awayTeam = upsertTeam(teamMap, {
      championshipId,
      registrationId: report.awayRegistrationId,
      teamAcronym: report.awayTeamAcronym,
      teamId: report.awayTeamId,
      teamName: report.awayTeamName,
    });

    if (!homeTeam || !awayTeam) continue;

    championship.finishedMatches += 1;
    applyMatchResult(homeTeam, report.homeScore, report.awayScore);
    applyMatchResult(awayTeam, report.awayScore, report.homeScore);
  }

  for (const event of events.sort(compareEventOrder)) {
    const report = reportsById.get(event.reportId) || reportsByMatchId.get(event.matchId) || null;

    if (!isEventEligible(report, event)) continue;

    const team = upsertTeam(teamMap, {
      championshipId,
      registrationId: event.teamRegistrationId,
      teamAcronym: event.teamAcronym,
      teamId: event.teamId,
      teamName: event.teamName,
    });

    recordPlayerMatch(playerMap, playerMatches, event, event.playerId, event.playerName, {
      championshipId,
      shirtNumber: event.playerShirtNumber,
      team,
    });
    recordPlayerMatch(
      playerMap,
      playerMatches,
      event,
      event.relatedPlayerId,
      event.relatedPlayerName,
      {
        championshipId,
        shirtNumber: event.relatedPlayerShirtNumber,
        team,
      },
    );

    if (event.eventType === ChampionshipMatchEventType.GOAL) {
      championship.goalsScored += 1;
      const player = upsertPlayer(playerMap, event, event.playerId, event.playerName, {
        championshipId,
        shirtNumber: event.playerShirtNumber,
        team,
      });
      if (player) player.goals += 1;
    }

    if (event.eventType === ChampionshipMatchEventType.YELLOW_CARD) {
      championship.yellowCards += 1;
      if (team) team.yellowCards += 1;
      const player = upsertPlayer(playerMap, event, event.playerId, event.playerName, {
        championshipId,
        shirtNumber: event.playerShirtNumber,
        team,
      });
      if (player) player.yellowCards += 1;
    }

    if (event.eventType === ChampionshipMatchEventType.RED_CARD) {
      championship.redCards += 1;
      if (team) team.redCards += 1;
      const player = upsertPlayer(playerMap, event, event.playerId, event.playerName, {
        championshipId,
        shirtNumber: event.playerShirtNumber,
        team,
      });
      if (player) player.redCards += 1;
    }

    if (event.eventType === ChampionshipMatchEventType.WALKOVER) {
      championship.walkovers += 1;
      if (team) team.walkovers += 1;
    }
  }

  championship.goalsAverage =
    championship.finishedMatches > 0
      ? roundDecimal(championship.goalsScored / championship.finishedMatches)
      : 0;

  const teams = Array.from(teamMap.values()).map(finalizeTeamStatistics).sort(compareTeamName);
  const players = Array.from(playerMap.values())
    .map((player) => ({
      ...player,
      matches: playerMatches.get(playerKey(player.registrationId, player.playerId))?.size || 0,
    }))
    .sort(comparePlayerStatistics);

  return {
    championship,
    players,
    teams,
  };
}

function buildRankings(snapshot = {}, limit = 20) {
  const teams = snapshot.teams || [];
  const players = snapshot.players || snapshot.athletes || [];

  return {
    bestAttack: buildBestAttack(teams, limit),
    bestDefense: buildBestDefense(teams, limit),
    fairPlay: buildFairPlayRanking(teams, limit),
    topScorers: buildTopScorers(players, limit),
  };
}

function buildTopScorers(players = [], limit = 20) {
  return withPositions(
    [...players]
      .filter((player) => Number(player.goals || 0) > 0)
      .sort(compareTopScorers)
      .slice(0, limit),
  );
}

function buildFairPlayRanking(teams = [], limit = 20) {
  return withPositions(
    [...teams]
      .map((team) => ({
        ...team,
        fairPlayScore:
          Number(team.yellowCards || 0) +
          Number(team.redCards || 0) * 3 +
          Number(team.walkovers || 0) * 5,
      }))
      .sort(compareFairPlay)
      .slice(0, limit),
  );
}

function buildBestAttack(teams = [], limit = 20) {
  return withPositions(
    [...teams]
      .filter((team) => Number(team.matches || 0) > 0)
      .sort(compareBestAttack)
      .slice(0, limit),
  );
}

function buildBestDefense(teams = [], limit = 20) {
  return withPositions(
    [...teams]
      .filter((team) => Number(team.matches || 0) > 0)
      .sort(compareBestDefense)
      .slice(0, limit),
  );
}

function withPositions(items = []) {
  return items.map((item, index) => ({
    ...item,
    position: index + 1,
  }));
}

function normalizeSnapshot(snapshot = {}) {
  return {
    championship: snapshot.championship || snapshot.statistics || null,
    players: snapshot.players || snapshot.athletes || [],
    teams: snapshot.teams || [],
  };
}

function normalizeReport(raw = {}) {
  const id = readText(raw, "id", "report_id", "reportId");
  const matchId = readText(raw, "matchId", "match_id");
  const homeRegistrationId = readText(raw, "homeRegistrationId", "home_registration_id");
  const awayRegistrationId = readText(raw, "awayRegistrationId", "away_registration_id");

  if (!id || !matchId) return null;

  return {
    awayRegistrationId,
    awayScore:
      readIntegerOrNull(raw, "awayScore", "away_score") ??
      readIntegerOrNull(raw, "matchAwayScore", "match_away_score"),
    awayTeamAcronym: readText(raw, "awayTeamAcronym", "away_team_acronym"),
    awayTeamId: readText(raw, "awayTeamId", "away_team_id"),
    awayTeamName: readText(raw, "awayTeamName", "away_team_name"),
    championshipId: readText(raw, "championshipId", "championship_id"),
    finishedAt: readText(raw, "finishedAt", "finished_at"),
    homeRegistrationId,
    homeScore:
      readIntegerOrNull(raw, "homeScore", "home_score") ??
      readIntegerOrNull(raw, "matchHomeScore", "match_home_score"),
    homeTeamAcronym: readText(raw, "homeTeamAcronym", "home_team_acronym"),
    homeTeamId: readText(raw, "homeTeamId", "home_team_id"),
    homeTeamName: readText(raw, "homeTeamName", "home_team_name"),
    id,
    matchDate: readText(raw, "matchDate", "match_date"),
    matchId,
    matchStatus: readText(raw, "matchStatus", "match_status"),
    roundNumber: readInteger(raw, "roundNumber", "round_number"),
    startTime: readText(raw, "startTime", "start_time"),
    status: readText(raw, "status", "reportStatus", "report_status"),
  };
}

function normalizeEvent(raw = {}) {
  const id = readText(raw, "id", "event_id", "eventId");
  const eventType = readText(raw, "eventType", "event_type");
  const reportId = readText(raw, "reportId", "report_id");
  const matchId = readText(raw, "matchId", "match_id");

  if (!id || !eventType || (!reportId && !matchId)) return null;

  return {
    championshipId: readText(raw, "championshipId", "championship_id"),
    eventType,
    id,
    matchId,
    minute: readIntegerOrNull(raw, "minute"),
    playerId: readText(raw, "playerId", "player_id"),
    playerName: readText(raw, "playerName", "player_name"),
    playerShirtNumber: readIntegerOrNull(raw, "playerShirtNumber", "player_shirt_number"),
    relatedPlayerId: readText(raw, "relatedPlayerId", "related_player_id"),
    relatedPlayerName: readText(raw, "relatedPlayerName", "related_player_name"),
    relatedPlayerShirtNumber: readIntegerOrNull(
      raw,
      "relatedPlayerShirtNumber",
      "related_player_shirt_number",
    ),
    reportId,
    teamAcronym: readText(raw, "teamAcronym", "team_acronym"),
    teamId: readText(raw, "teamId", "team_id"),
    teamName: readText(raw, "teamName", "team_name"),
    teamRegistrationId: readText(raw, "teamRegistrationId", "team_registration_id"),
  };
}

function upsertTeam(teamMap, input = {}) {
  if (!input.registrationId) return null;

  const existing = teamMap.get(input.registrationId) || {
    calculatedAt: input.calculatedAt || null,
    championshipId: input.championshipId || null,
    draws: 0,
    goalDifference: 0,
    goalsAgainst: 0,
    goalsFor: 0,
    losses: 0,
    matches: 0,
    performance: 0,
    points: 0,
    redCards: 0,
    registrationId: input.registrationId,
    resultStreak: [],
    teamAcronym: null,
    teamId: null,
    teamName: null,
    walkovers: 0,
    wins: 0,
    yellowCards: 0,
  };

  existing.championshipId = existing.championshipId || input.championshipId || null;
  existing.teamAcronym = existing.teamAcronym || input.teamAcronym || null;
  existing.teamId = existing.teamId || input.teamId || null;
  existing.teamName = existing.teamName || input.teamName || input.registrationId;
  teamMap.set(input.registrationId, existing);
  return existing;
}

function upsertPlayer(playerMap, event, playerId, playerName, options = {}) {
  if (!playerId) return null;

  const team = options.team || null;
  const registrationId = team?.registrationId || event.teamRegistrationId || null;
  const key = playerKey(registrationId, playerId);
  const existing = playerMap.get(key) || {
    calculatedAt: null,
    championshipId: options.championshipId || event.championshipId || null,
    goals: 0,
    matches: 0,
    playerId,
    playerName: playerName || playerId,
    redCards: 0,
    registrationId,
    shirtNumber: options.shirtNumber ?? null,
    teamAcronym: team?.teamAcronym || null,
    teamId: team?.teamId || null,
    teamName: team?.teamName || null,
    yellowCards: 0,
  };

  existing.playerName = existing.playerName || playerName || playerId;
  existing.registrationId = existing.registrationId || registrationId;
  existing.shirtNumber = existing.shirtNumber ?? options.shirtNumber ?? null;
  existing.teamAcronym = existing.teamAcronym || team?.teamAcronym || null;
  existing.teamId = existing.teamId || team?.teamId || null;
  existing.teamName = existing.teamName || team?.teamName || null;
  playerMap.set(key, existing);
  return existing;
}

function recordPlayerMatch(playerMap, playerMatches, event, playerId, playerName, options = {}) {
  const player = upsertPlayer(playerMap, event, playerId, playerName, options);
  if (!player || !event.matchId) return;

  const key = playerKey(player.registrationId, player.playerId);
  const matches = playerMatches.get(key) || new Set();
  matches.add(event.matchId);
  playerMatches.set(key, matches);
}

function applyMatchResult(team, goalsFor, goalsAgainst) {
  team.matches += 1;
  team.goalsFor += goalsFor;
  team.goalsAgainst += goalsAgainst;

  if (goalsFor > goalsAgainst) {
    team.wins += 1;
    team.points += 3;
    team.resultStreak.push("V");
    return;
  }

  if (goalsFor === goalsAgainst) {
    team.draws += 1;
    team.points += 1;
    team.resultStreak.push("E");
    return;
  }

  team.losses += 1;
  team.resultStreak.push("D");
}

function finalizeTeamStatistics(team) {
  const matches = Number(team.matches || 0);
  const points = Number(team.points || 0);

  return {
    ...team,
    goalDifference: Number(team.goalsFor || 0) - Number(team.goalsAgainst || 0),
    performance: matches > 0 ? roundDecimal((points / (matches * 3)) * 100) : 0,
  };
}

function isReportPlayed(report, eventCount = 0) {
  if (!report) return false;
  if (eventCount > 0) return true;
  if (report.status === ChampionshipMatchReportStatus.DRAFT) return false;
  if (
    [
      ChampionshipMatchReportStatus.FINISHED,
      ChampionshipMatchReportStatus.OPEN,
      ChampionshipMatchReportStatus.REOPENED,
    ].includes(report.status)
  ) {
    return true;
  }

  return report.matchStatus === ChampionshipMatchStatus.FINISHED;
}

function isFinishedReport(report) {
  if (!report || !hasCompleteScore(report)) return false;
  if (report.status) return report.status === ChampionshipMatchReportStatus.FINISHED;
  return report.matchStatus === ChampionshipMatchStatus.FINISHED;
}

function isEventEligible(report, event) {
  if (!event) return false;
  if (!report) return true;
  return report.status !== ChampionshipMatchReportStatus.DRAFT;
}

function hasCompleteScore(report) {
  return Number.isFinite(Number(report.homeScore)) && Number.isFinite(Number(report.awayScore));
}

function compareReportOrder(left, right) {
  return (
    String(left.matchDate || "").localeCompare(String(right.matchDate || "")) ||
    String(left.startTime || "").localeCompare(String(right.startTime || "")) ||
    Number(left.roundNumber || 0) - Number(right.roundNumber || 0) ||
    String(left.matchId || "").localeCompare(String(right.matchId || ""))
  );
}

function compareEventOrder(left, right) {
  return (
    String(left.matchId || "").localeCompare(String(right.matchId || "")) ||
    Number(left.minute ?? 9999) - Number(right.minute ?? 9999) ||
    String(left.id || "").localeCompare(String(right.id || ""))
  );
}

function compareTeamName(left, right) {
  return String(left.teamName || "").localeCompare(String(right.teamName || ""));
}

function comparePlayerStatistics(left, right) {
  return (
    String(left.teamName || "").localeCompare(String(right.teamName || "")) ||
    String(left.playerName || "").localeCompare(String(right.playerName || ""))
  );
}

function compareTopScorers(left, right) {
  return (
    Number(right.goals || 0) - Number(left.goals || 0) ||
    Number(left.redCards || 0) - Number(right.redCards || 0) ||
    Number(left.yellowCards || 0) - Number(right.yellowCards || 0) ||
    String(left.playerName || "").localeCompare(String(right.playerName || ""))
  );
}

function compareFairPlay(left, right) {
  return (
    Number(left.fairPlayScore || 0) - Number(right.fairPlayScore || 0) ||
    Number(left.redCards || 0) - Number(right.redCards || 0) ||
    Number(left.yellowCards || 0) - Number(right.yellowCards || 0) ||
    Number(left.walkovers || 0) - Number(right.walkovers || 0) ||
    String(left.teamName || "").localeCompare(String(right.teamName || ""))
  );
}

function compareBestAttack(left, right) {
  return (
    Number(right.goalsFor || 0) - Number(left.goalsFor || 0) ||
    Number(right.goalDifference || 0) - Number(left.goalDifference || 0) ||
    String(left.teamName || "").localeCompare(String(right.teamName || ""))
  );
}

function compareBestDefense(left, right) {
  return (
    Number(left.goalsAgainst || 0) - Number(right.goalsAgainst || 0) ||
    Number(right.matches || 0) - Number(left.matches || 0) ||
    String(left.teamName || "").localeCompare(String(right.teamName || ""))
  );
}

function readText(source, ...keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value === null || typeof value === "undefined") continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }

  return null;
}

function readInteger(source, ...keys) {
  return readIntegerOrNull(source, ...keys) || 0;
}

function readIntegerOrNull(source, ...keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value === null || typeof value === "undefined" || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }

  return null;
}

function playerKey(registrationId, playerId) {
  return `${registrationId || "sem-inscricao"}:${playerId || "sem-atleta"}`;
}

function roundDecimal(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

module.exports = {
  ChampionshipStatisticsService,
  calculateChampionshipStatistics,
};
