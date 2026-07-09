class ChampionshipStatistics {
  constructor(input = {}) {
    this.id = input.id || null;
    this.championshipId = input.championshipId || null;
    this.matchesPlayed = normalizeInteger(input.matchesPlayed);
    this.finishedMatches = normalizeInteger(input.finishedMatches);
    this.goalsScored = normalizeInteger(input.goalsScored);
    this.goalsAverage = normalizeDecimal(input.goalsAverage);
    this.yellowCards = normalizeInteger(input.yellowCards);
    this.redCards = normalizeInteger(input.redCards);
    this.walkovers = normalizeInteger(input.walkovers);
    this.calculatedAt = input.calculatedAt || null;
    this.updatedAt = input.updatedAt || null;
  }

  static fromPersistence(row = {}) {
    return new ChampionshipStatistics({
      calculatedAt: row.calculated_at || row.calculatedAt || null,
      championshipId: row.championship_id || row.championshipId || null,
      finishedMatches: row.finished_matches ?? row.finishedMatches,
      goalsAverage: row.goals_average ?? row.goalsAverage,
      goalsScored: row.goals_scored ?? row.goalsScored,
      id: row.id || null,
      matchesPlayed: row.matches_played ?? row.matchesPlayed,
      redCards: row.red_cards ?? row.redCards,
      updatedAt: row.updated_at || row.updatedAt || null,
      walkovers: row.walkovers,
      yellowCards: row.yellow_cards ?? row.yellowCards,
    });
  }

  toJSON() {
    return {
      calculatedAt: this.calculatedAt,
      championshipId: this.championshipId,
      finishedMatches: this.finishedMatches,
      goalsAverage: this.goalsAverage,
      goalsScored: this.goalsScored,
      id: this.id,
      matchesPlayed: this.matchesPlayed,
      redCards: this.redCards,
      updatedAt: this.updatedAt,
      walkovers: this.walkovers,
      yellowCards: this.yellowCards,
    };
  }
}

class ChampionshipTeamStatistics {
  constructor(input = {}) {
    this.id = input.id || null;
    this.championshipId = input.championshipId || null;
    this.registrationId = input.registrationId || null;
    this.teamId = input.teamId || null;
    this.teamName = input.teamName || null;
    this.teamAcronym = input.teamAcronym || null;
    this.matches = normalizeInteger(input.matches);
    this.wins = normalizeInteger(input.wins);
    this.draws = normalizeInteger(input.draws);
    this.losses = normalizeInteger(input.losses);
    this.goalsFor = normalizeInteger(input.goalsFor);
    this.goalsAgainst = normalizeInteger(input.goalsAgainst);
    this.goalDifference = normalizeInteger(input.goalDifference);
    this.points = normalizeInteger(input.points);
    this.performance = normalizeDecimal(input.performance);
    this.resultStreak = normalizeResultStreak(input.resultStreak);
    this.yellowCards = normalizeInteger(input.yellowCards);
    this.redCards = normalizeInteger(input.redCards);
    this.walkovers = normalizeInteger(input.walkovers);
    this.calculatedAt = input.calculatedAt || null;
    this.updatedAt = input.updatedAt || null;
  }

  static fromPersistence(row = {}) {
    return new ChampionshipTeamStatistics({
      calculatedAt: row.calculated_at || row.calculatedAt || null,
      championshipId: row.championship_id || row.championshipId || null,
      draws: row.draws,
      goalDifference: row.goal_difference ?? row.goalDifference,
      goalsAgainst: row.goals_against ?? row.goalsAgainst,
      goalsFor: row.goals_for ?? row.goalsFor,
      id: row.id || null,
      losses: row.losses,
      matches: row.matches_played ?? row.matches,
      performance: row.performance,
      points: row.points,
      redCards: row.red_cards ?? row.redCards,
      registrationId: row.registration_id || row.registrationId || null,
      resultStreak: row.result_streak_json || row.resultStreak,
      teamAcronym: row.team_acronym || row.teamAcronym || null,
      teamId: row.team_id || row.teamId || null,
      teamName: row.team_name || row.teamName || null,
      updatedAt: row.updated_at || row.updatedAt || null,
      walkovers: row.walkovers,
      wins: row.wins,
      yellowCards: row.yellow_cards ?? row.yellowCards,
    });
  }

  toJSON() {
    return {
      calculatedAt: this.calculatedAt,
      championshipId: this.championshipId,
      draws: this.draws,
      goalDifference: this.goalDifference,
      goalsAgainst: this.goalsAgainst,
      goalsFor: this.goalsFor,
      id: this.id,
      losses: this.losses,
      matches: this.matches,
      performance: this.performance,
      points: this.points,
      redCards: this.redCards,
      registrationId: this.registrationId,
      resultStreak: this.resultStreak,
      teamAcronym: this.teamAcronym,
      teamId: this.teamId,
      teamName: this.teamName,
      updatedAt: this.updatedAt,
      walkovers: this.walkovers,
      wins: this.wins,
      yellowCards: this.yellowCards,
    };
  }
}

class ChampionshipPlayerStatistics {
  constructor(input = {}) {
    this.id = input.id || null;
    this.championshipId = input.championshipId || null;
    this.registrationId = input.registrationId || null;
    this.teamId = input.teamId || null;
    this.teamName = input.teamName || null;
    this.teamAcronym = input.teamAcronym || null;
    this.playerId = input.playerId || null;
    this.playerName = input.playerName || null;
    this.shirtNumber = normalizeNullableInteger(input.shirtNumber);
    this.matches = normalizeInteger(input.matches);
    this.goals = normalizeInteger(input.goals);
    this.yellowCards = normalizeInteger(input.yellowCards);
    this.redCards = normalizeInteger(input.redCards);
    this.calculatedAt = input.calculatedAt || null;
    this.updatedAt = input.updatedAt || null;
  }

  static fromPersistence(row = {}) {
    return new ChampionshipPlayerStatistics({
      calculatedAt: row.calculated_at || row.calculatedAt || null,
      championshipId: row.championship_id || row.championshipId || null,
      goals: row.goals,
      id: row.id || null,
      matches: row.matches_played ?? row.matches,
      playerId: row.player_id || row.playerId || null,
      playerName: row.player_name || row.playerName || null,
      redCards: row.red_cards ?? row.redCards,
      registrationId: row.registration_id || row.registrationId || null,
      shirtNumber: row.shirt_number ?? row.shirtNumber ?? null,
      teamAcronym: row.team_acronym || row.teamAcronym || null,
      teamId: row.team_id || row.teamId || null,
      teamName: row.team_name || row.teamName || null,
      updatedAt: row.updated_at || row.updatedAt || null,
      yellowCards: row.yellow_cards ?? row.yellowCards,
    });
  }

  toJSON() {
    return {
      calculatedAt: this.calculatedAt,
      championshipId: this.championshipId,
      goals: this.goals,
      id: this.id,
      matches: this.matches,
      playerId: this.playerId,
      playerName: this.playerName,
      redCards: this.redCards,
      registrationId: this.registrationId,
      shirtNumber: this.shirtNumber,
      teamAcronym: this.teamAcronym,
      teamId: this.teamId,
      teamName: this.teamName,
      updatedAt: this.updatedAt,
      yellowCards: this.yellowCards,
    };
  }
}

function normalizeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function normalizeNullableInteger(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function normalizeDecimal(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function normalizeResultStreak(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (!value || typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeResultStreak(parsed) : [];
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

module.exports = {
  ChampionshipPlayerStatistics,
  ChampionshipStatistics,
  ChampionshipTeamStatistics,
};
