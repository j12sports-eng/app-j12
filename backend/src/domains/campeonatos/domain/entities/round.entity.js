class Round {
  constructor(input = {}) {
    this.id = input.id || null;
    this.phaseId = input.phaseId || null;
    this.name = input.name || "";
    this.order = Number.isFinite(Number(input.order)) ? Number(input.order) : 0;
    this.status = input.status || "DRAFT";
  }
}

class ChampionshipRound {
  constructor(input = {}) {
    this.id = input.id || null;
    this.championshipId = input.championshipId || null;
    this.name = input.name || null;
    this.roundNumber = Number.isFinite(Number(input.roundNumber)) ? Number(input.roundNumber) : 0;
    this.phase = input.phase || "GROUP_STAGE";
    this.matches = Array.isArray(input.matches) ? input.matches : [];
    this.createdBy = input.createdBy || null;
    this.updatedBy = input.updatedBy || null;
    this.createdAt = input.createdAt || null;
    this.updatedAt = input.updatedAt || null;
  }

  static fromPersistence(row = {}) {
    return new ChampionshipRound({
      championshipId: row.championship_id || row.championshipId || null,
      createdAt: row.created_at || row.createdAt || null,
      createdBy: row.created_by || row.createdBy || null,
      id: row.id || null,
      matches: Array.isArray(row.matches) ? row.matches : [],
      name: row.name || null,
      phase: row.phase || null,
      roundNumber: row.round_number ?? row.roundNumber ?? 0,
      updatedAt: row.updated_at || row.updatedAt || null,
      updatedBy: row.updated_by || row.updatedBy || null,
    });
  }

  toJSON() {
    return {
      championshipId: this.championshipId,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      id: this.id,
      matches: this.matches,
      name: this.name,
      phase: this.phase,
      roundNumber: this.roundNumber,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }
}

class ChampionshipMatch {
  constructor(input = {}) {
    this.id = input.id || null;
    this.championshipId = input.championshipId || null;
    this.roundId = input.roundId || null;
    this.roundName = input.roundName || null;
    this.roundNumber = Number.isFinite(Number(input.roundNumber)) ? Number(input.roundNumber) : 0;
    this.phase = input.phase || "GROUP_STAGE";
    this.groupId = input.groupId || null;
    this.groupName = input.groupName || null;
    this.homeRegistrationId = input.homeRegistrationId || null;
    this.homeTeamId = input.homeTeamId || null;
    this.homeTeamName = input.homeTeamName || null;
    this.homeTeamAcronym = input.homeTeamAcronym || null;
    this.homeScore = normalizeScore(input.homeScore);
    this.awayRegistrationId = input.awayRegistrationId || null;
    this.awayTeamId = input.awayTeamId || null;
    this.awayTeamName = input.awayTeamName || null;
    this.awayTeamAcronym = input.awayTeamAcronym || null;
    this.awayScore = normalizeScore(input.awayScore);
    this.matchDate = input.matchDate || null;
    this.startTime = input.startTime || null;
    this.court = input.court || null;
    this.status = input.status || "SCHEDULED";
    this.resultUpdatedAt = input.resultUpdatedAt || null;
    this.resultUpdatedBy = input.resultUpdatedBy || null;
    this.createdBy = input.createdBy || null;
    this.updatedBy = input.updatedBy || null;
    this.createdAt = input.createdAt || null;
    this.updatedAt = input.updatedAt || null;
  }

  static fromPersistence(row = {}) {
    return new ChampionshipMatch({
      awayRegistrationId: row.away_registration_id || row.awayRegistrationId || null,
      awayScore: row.away_score ?? row.awayScore ?? null,
      awayTeamAcronym: row.away_team_acronym || row.awayTeamAcronym || null,
      awayTeamId: row.away_team_id || row.awayTeamId || null,
      awayTeamName: row.away_team_name || row.awayTeamName || null,
      championshipId: row.championship_id || row.championshipId || null,
      court: row.court || null,
      createdAt: row.created_at || row.createdAt || null,
      createdBy: row.created_by || row.createdBy || null,
      groupId: row.group_id || row.groupId || null,
      groupName: row.group_name || row.groupName || null,
      homeRegistrationId: row.home_registration_id || row.homeRegistrationId || null,
      homeScore: row.home_score ?? row.homeScore ?? null,
      homeTeamAcronym: row.home_team_acronym || row.homeTeamAcronym || null,
      homeTeamId: row.home_team_id || row.homeTeamId || null,
      homeTeamName: row.home_team_name || row.homeTeamName || null,
      id: row.id || null,
      matchDate: row.match_date || row.matchDate || null,
      phase: row.phase || null,
      roundId: row.round_id || row.roundId || null,
      roundName: row.round_name || row.roundName || null,
      roundNumber: row.round_number ?? row.roundNumber ?? 0,
      resultUpdatedAt: row.result_updated_at || row.resultUpdatedAt || null,
      resultUpdatedBy: row.result_updated_by || row.resultUpdatedBy || null,
      startTime: row.start_time || row.startTime || null,
      status: row.status || null,
      updatedAt: row.updated_at || row.updatedAt || null,
      updatedBy: row.updated_by || row.updatedBy || null,
    });
  }

  toJSON() {
    return {
      awayRegistrationId: this.awayRegistrationId,
      awayScore: this.awayScore,
      awayTeamAcronym: this.awayTeamAcronym,
      awayTeamId: this.awayTeamId,
      awayTeamName: this.awayTeamName,
      championshipId: this.championshipId,
      court: this.court,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      groupId: this.groupId,
      groupName: this.groupName,
      homeRegistrationId: this.homeRegistrationId,
      homeScore: this.homeScore,
      homeTeamAcronym: this.homeTeamAcronym,
      homeTeamId: this.homeTeamId,
      homeTeamName: this.homeTeamName,
      id: this.id,
      matchDate: this.matchDate,
      phase: this.phase,
      roundId: this.roundId,
      roundName: this.roundName,
      roundNumber: this.roundNumber,
      resultUpdatedAt: this.resultUpdatedAt,
      resultUpdatedBy: this.resultUpdatedBy,
      startTime: this.startTime,
      status: this.status,
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

module.exports = {
  ChampionshipMatch,
  ChampionshipRound,
  Round,
};
