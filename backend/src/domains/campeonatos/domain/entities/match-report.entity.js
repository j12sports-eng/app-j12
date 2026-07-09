const {
  ChampionshipMatchEventType,
  ChampionshipMatchReportStatus,
} = require("../../shared/constants/index.js");

class ChampionshipMatchReport {
  constructor(input = {}) {
    this.id = input.id || null;
    this.matchId = input.matchId || null;
    this.championshipId = input.championshipId || null;
    this.status = input.status || ChampionshipMatchReportStatus.DRAFT;
    this.referee = input.referee || null;
    this.assistantReferee = input.assistantReferee || null;
    this.scorer = input.scorer || null;
    this.observations = input.observations || null;
    this.homeScore = normalizeScore(input.homeScore);
    this.awayScore = normalizeScore(input.awayScore);
    this.startedAt = input.startedAt || null;
    this.finishedAt = input.finishedAt || null;
    this.createdBy = input.createdBy || null;
    this.updatedBy = input.updatedBy || null;
    this.createdAt = input.createdAt || null;
    this.updatedAt = input.updatedAt || null;
    this.match = input.match || null;
    this.events = Array.isArray(input.events) ? input.events : [];
  }

  static fromPersistence(row = {}) {
    return new ChampionshipMatchReport({
      assistantReferee: row.assistant_referee || row.assistantReferee || null,
      awayScore: row.away_score ?? row.awayScore ?? null,
      championshipId: row.championship_id || row.championshipId || null,
      createdAt: row.created_at || row.createdAt || null,
      createdBy: row.created_by || row.createdBy || null,
      events: Array.isArray(row.events) ? row.events : [],
      finishedAt: row.finished_at || row.finishedAt || null,
      homeScore: row.home_score ?? row.homeScore ?? null,
      id: row.id || null,
      match: row.match || null,
      matchId: row.match_id || row.matchId || null,
      observations: row.observations || null,
      referee: row.referee || null,
      scorer: row.scorer || null,
      startedAt: row.started_at || row.startedAt || null,
      status: row.status || ChampionshipMatchReportStatus.DRAFT,
      updatedAt: row.updated_at || row.updatedAt || null,
      updatedBy: row.updated_by || row.updatedBy || null,
    });
  }

  toJSON() {
    return {
      assistantReferee: this.assistantReferee,
      awayScore: this.awayScore,
      championshipId: this.championshipId,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      events: this.events,
      finishedAt: this.finishedAt,
      homeScore: this.homeScore,
      id: this.id,
      match: this.match,
      matchId: this.matchId,
      observations: this.observations,
      referee: this.referee,
      scorer: this.scorer,
      startedAt: this.startedAt,
      status: this.status,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }
}

class ChampionshipMatchEvent {
  constructor(input = {}) {
    this.id = input.id || null;
    this.reportId = input.reportId || null;
    this.matchId = input.matchId || null;
    this.championshipId = input.championshipId || null;
    this.teamRegistrationId = input.teamRegistrationId || null;
    this.playerId = input.playerId || null;
    this.relatedPlayerId = input.relatedPlayerId || null;
    this.eventType = input.eventType || ChampionshipMatchEventType.OBSERVATION;
    this.minute = normalizeMinute(input.minute);
    this.period = input.period || null;
    this.description = input.description || null;
    this.metadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};
    this.createdBy = input.createdBy || null;
    this.updatedBy = input.updatedBy || null;
    this.createdAt = input.createdAt || null;
    this.updatedAt = input.updatedAt || null;
    this.teamName = input.teamName || null;
    this.teamAcronym = input.teamAcronym || null;
    this.playerName = input.playerName || null;
    this.playerShirtNumber = normalizeNullableNumber(input.playerShirtNumber);
    this.relatedPlayerName = input.relatedPlayerName || null;
    this.relatedPlayerShirtNumber = normalizeNullableNumber(input.relatedPlayerShirtNumber);
  }

  static fromPersistence(row = {}) {
    return new ChampionshipMatchEvent({
      championshipId: row.championship_id || row.championshipId || null,
      createdAt: row.created_at || row.createdAt || null,
      createdBy: row.created_by || row.createdBy || null,
      description: row.description || null,
      eventType: row.event_type || row.eventType || ChampionshipMatchEventType.OBSERVATION,
      id: row.id || null,
      matchId: row.match_id || row.matchId || null,
      metadata: row.metadata || row.metadata_json || row.metadataJson || {},
      minute: row.minute ?? null,
      period: row.period || null,
      playerId: row.player_id || row.playerId || null,
      playerName: row.player_name || row.playerName || null,
      playerShirtNumber: row.player_shirt_number ?? row.playerShirtNumber ?? null,
      relatedPlayerId: row.related_player_id || row.relatedPlayerId || null,
      relatedPlayerName: row.related_player_name || row.relatedPlayerName || null,
      relatedPlayerShirtNumber:
        row.related_player_shirt_number ?? row.relatedPlayerShirtNumber ?? null,
      reportId: row.report_id || row.reportId || null,
      teamAcronym: row.team_acronym || row.teamAcronym || null,
      teamName: row.team_name || row.teamName || null,
      teamRegistrationId: row.team_registration_id || row.teamRegistrationId || null,
      updatedAt: row.updated_at || row.updatedAt || null,
      updatedBy: row.updated_by || row.updatedBy || null,
    });
  }

  toJSON() {
    return {
      championshipId: this.championshipId,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      description: this.description,
      eventType: this.eventType,
      id: this.id,
      matchId: this.matchId,
      metadata: this.metadata,
      minute: this.minute,
      period: this.period,
      playerId: this.playerId,
      playerName: this.playerName,
      playerShirtNumber: this.playerShirtNumber,
      relatedPlayerId: this.relatedPlayerId,
      relatedPlayerName: this.relatedPlayerName,
      relatedPlayerShirtNumber: this.relatedPlayerShirtNumber,
      reportId: this.reportId,
      teamAcronym: this.teamAcronym,
      teamName: this.teamName,
      teamRegistrationId: this.teamRegistrationId,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }
}

function normalizeScore(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function normalizeMinute(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function normalizeNullableNumber(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

module.exports = {
  ChampionshipMatchEvent,
  ChampionshipMatchReport,
};
