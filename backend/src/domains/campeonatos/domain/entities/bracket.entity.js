class ChampionshipBracket {
  constructor(input = {}) {
    this.id = input.id || null;
    this.championshipId = input.championshipId || null;
    this.initialPhase = input.initialPhase || input.phase || "FINAL";
    this.displayOrder = normalizeNumber(input.displayOrder);
    this.status = input.status || "DRAFT";
    this.mode = input.mode || "AUTOMATIC";
    this.teamCount = normalizeNumber(input.teamCount);
    this.includeThirdPlace = Boolean(input.includeThirdPlace);
    this.championRegistrationId = input.championRegistrationId || null;
    this.runnerUpRegistrationId = input.runnerUpRegistrationId || null;
    this.thirdPlaceRegistrationId = input.thirdPlaceRegistrationId || null;
    this.matches = Array.isArray(input.matches) ? input.matches : [];
    this.createdBy = input.createdBy || null;
    this.updatedBy = input.updatedBy || null;
    this.createdAt = input.createdAt || null;
    this.updatedAt = input.updatedAt || null;
  }

  static fromPersistence(row = {}) {
    return new ChampionshipBracket({
      championRegistrationId: row.champion_registration_id || row.championRegistrationId || null,
      championshipId: row.championship_id || row.championshipId || null,
      createdAt: row.created_at || row.createdAt || null,
      createdBy: row.created_by || row.createdBy || null,
      displayOrder: row.display_order ?? row.displayOrder ?? 0,
      id: row.id || null,
      includeThirdPlace: row.include_third_place ?? row.includeThirdPlace ?? false,
      initialPhase: row.initial_phase || row.initialPhase || row.phase || null,
      matches: Array.isArray(row.matches) ? row.matches : [],
      mode: row.mode || null,
      runnerUpRegistrationId: row.runner_up_registration_id || row.runnerUpRegistrationId || null,
      status: row.status || null,
      teamCount: row.team_count ?? row.teamCount ?? 0,
      thirdPlaceRegistrationId:
        row.third_place_registration_id || row.thirdPlaceRegistrationId || null,
      updatedAt: row.updated_at || row.updatedAt || null,
      updatedBy: row.updated_by || row.updatedBy || null,
    });
  }

  toJSON() {
    return {
      championRegistrationId: this.championRegistrationId,
      championshipId: this.championshipId,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      displayOrder: this.displayOrder,
      id: this.id,
      includeThirdPlace: this.includeThirdPlace,
      initialPhase: this.initialPhase,
      matches: this.matches,
      mode: this.mode,
      runnerUpRegistrationId: this.runnerUpRegistrationId,
      status: this.status,
      teamCount: this.teamCount,
      thirdPlaceRegistrationId: this.thirdPlaceRegistrationId,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }
}

class ChampionshipBracketMatch {
  constructor(input = {}) {
    this.id = input.id || null;
    this.bracketId = input.bracketId || null;
    this.championshipId = input.championshipId || null;
    this.phase = input.phase || "FINAL";
    this.displayOrder = normalizeNumber(input.displayOrder);
    this.roundOrder = normalizeNumber(input.roundOrder);
    this.homeRegistrationId = input.homeRegistrationId || null;
    this.homeTeamId = input.homeTeamId || null;
    this.homeTeamName = input.homeTeamName || null;
    this.homeTeamAcronym = input.homeTeamAcronym || null;
    this.awayRegistrationId = input.awayRegistrationId || null;
    this.awayTeamId = input.awayTeamId || null;
    this.awayTeamName = input.awayTeamName || null;
    this.awayTeamAcronym = input.awayTeamAcronym || null;
    this.winnerRegistrationId = input.winnerRegistrationId || null;
    this.winnerTeamId = input.winnerTeamId || null;
    this.winnerTeamName = input.winnerTeamName || null;
    this.winnerTeamAcronym = input.winnerTeamAcronym || null;
    this.nextMatchId = input.nextMatchId || null;
    this.nextMatchSlot = input.nextMatchSlot || null;
    this.thirdPlaceMatchId = input.thirdPlaceMatchId || null;
    this.thirdPlaceSlot = input.thirdPlaceSlot || null;
    this.homeScore = normalizeScore(input.homeScore);
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
    return new ChampionshipBracketMatch({
      awayRegistrationId: row.away_registration_id || row.awayRegistrationId || null,
      awayScore: row.away_score ?? row.awayScore ?? null,
      awayTeamAcronym: row.away_team_acronym || row.awayTeamAcronym || null,
      awayTeamId: row.away_team_id || row.awayTeamId || null,
      awayTeamName: row.away_team_name || row.awayTeamName || null,
      bracketId: row.bracket_id || row.bracketId || null,
      championshipId: row.championship_id || row.championshipId || null,
      court: row.court || null,
      createdAt: row.created_at || row.createdAt || null,
      createdBy: row.created_by || row.createdBy || null,
      displayOrder: row.display_order ?? row.displayOrder ?? 0,
      homeRegistrationId: row.home_registration_id || row.homeRegistrationId || null,
      homeScore: row.home_score ?? row.homeScore ?? null,
      homeTeamAcronym: row.home_team_acronym || row.homeTeamAcronym || null,
      homeTeamId: row.home_team_id || row.homeTeamId || null,
      homeTeamName: row.home_team_name || row.homeTeamName || null,
      id: row.id || null,
      matchDate: row.match_date || row.matchDate || null,
      nextMatchId: row.next_match_id || row.nextMatchId || null,
      nextMatchSlot: row.next_match_slot || row.nextMatchSlot || null,
      phase: row.phase || null,
      resultUpdatedAt: row.result_updated_at || row.resultUpdatedAt || null,
      resultUpdatedBy: row.result_updated_by || row.resultUpdatedBy || null,
      roundOrder: row.round_order ?? row.roundOrder ?? 0,
      startTime: row.start_time || row.startTime || null,
      status: row.status || null,
      thirdPlaceMatchId: row.third_place_match_id || row.thirdPlaceMatchId || null,
      thirdPlaceSlot: row.third_place_slot || row.thirdPlaceSlot || null,
      updatedAt: row.updated_at || row.updatedAt || null,
      updatedBy: row.updated_by || row.updatedBy || null,
      winnerRegistrationId: row.winner_registration_id || row.winnerRegistrationId || null,
      winnerTeamAcronym: row.winner_team_acronym || row.winnerTeamAcronym || null,
      winnerTeamId: row.winner_team_id || row.winnerTeamId || null,
      winnerTeamName: row.winner_team_name || row.winnerTeamName || null,
    });
  }

  toJSON() {
    return {
      awayRegistrationId: this.awayRegistrationId,
      awayScore: this.awayScore,
      awayTeamAcronym: this.awayTeamAcronym,
      awayTeamId: this.awayTeamId,
      awayTeamName: this.awayTeamName,
      bracketId: this.bracketId,
      championshipId: this.championshipId,
      court: this.court,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      displayOrder: this.displayOrder,
      homeRegistrationId: this.homeRegistrationId,
      homeScore: this.homeScore,
      homeTeamAcronym: this.homeTeamAcronym,
      homeTeamId: this.homeTeamId,
      homeTeamName: this.homeTeamName,
      id: this.id,
      matchDate: this.matchDate,
      nextMatchId: this.nextMatchId,
      nextMatchSlot: this.nextMatchSlot,
      phase: this.phase,
      resultUpdatedAt: this.resultUpdatedAt,
      resultUpdatedBy: this.resultUpdatedBy,
      roundOrder: this.roundOrder,
      startTime: this.startTime,
      status: this.status,
      thirdPlaceMatchId: this.thirdPlaceMatchId,
      thirdPlaceSlot: this.thirdPlaceSlot,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
      winnerRegistrationId: this.winnerRegistrationId,
      winnerTeamAcronym: this.winnerTeamAcronym,
      winnerTeamId: this.winnerTeamId,
      winnerTeamName: this.winnerTeamName,
    };
  }
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function normalizeScore(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

module.exports = {
  ChampionshipBracket,
  ChampionshipBracketMatch,
};
