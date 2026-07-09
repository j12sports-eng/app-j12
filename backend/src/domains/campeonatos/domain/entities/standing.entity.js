class ChampionshipStanding {
  constructor(input = {}) {
    this.id = input.id || null;
    this.championshipId = input.championshipId || null;
    this.groupId = input.groupId || null;
    this.groupName = input.groupName || null;
    this.groupDisplayOrder = normalizeNumber(input.groupDisplayOrder);
    this.registrationId = input.registrationId || null;
    this.teamId = input.teamId || null;
    this.teamName = input.teamName || null;
    this.teamAcronym = input.teamAcronym || null;
    this.position = normalizeNumber(input.position, 1);
    this.groupPosition = normalizeNumber(input.groupPosition || input.position, 1);
    this.overallPosition = normalizeNumber(input.overallPosition || input.position, 1);
    this.played = normalizeNumber(input.played);
    this.wins = normalizeNumber(input.wins);
    this.draws = normalizeNumber(input.draws);
    this.losses = normalizeNumber(input.losses);
    this.goalsFor = normalizeNumber(input.goalsFor);
    this.goalsAgainst = normalizeNumber(input.goalsAgainst);
    this.goalDifference = normalizeNumber(input.goalDifference);
    this.points = normalizeNumber(input.points);
    this.tieBreakers = Array.isArray(input.tieBreakers) ? input.tieBreakers : [];
    this.calculatedAt = input.calculatedAt || null;
    this.updatedAt = input.updatedAt || null;
  }

  static fromPersistence(row = {}) {
    return new ChampionshipStanding({
      calculatedAt: row.calculated_at || row.calculatedAt || null,
      championshipId: row.championship_id || row.championshipId || null,
      draws: row.draws,
      goalDifference: row.goal_difference ?? row.goalDifference,
      goalsAgainst: row.goals_against ?? row.goalsAgainst,
      goalsFor: row.goals_for ?? row.goalsFor,
      groupDisplayOrder: row.group_display_order ?? row.groupDisplayOrder,
      groupId: row.group_id || row.groupId || null,
      groupName: row.group_name || row.groupName || null,
      groupPosition: row.group_position ?? row.groupPosition,
      id: row.id || null,
      losses: row.losses,
      overallPosition: row.overall_position ?? row.overallPosition,
      played: row.played,
      points: row.points,
      position: row.position,
      registrationId: row.registration_id || row.registrationId || null,
      teamAcronym: row.team_acronym || row.teamAcronym || null,
      teamId: row.team_id || row.teamId || null,
      teamName: row.team_name || row.teamName || null,
      tieBreakers: readTieBreakers(row.tie_breakers_json || row.tieBreakers),
      updatedAt: row.updated_at || row.updatedAt || null,
      wins: row.wins,
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
      groupDisplayOrder: this.groupDisplayOrder,
      groupId: this.groupId,
      groupName: this.groupName,
      groupPosition: this.groupPosition,
      id: this.id,
      losses: this.losses,
      overallPosition: this.overallPosition,
      played: this.played,
      points: this.points,
      position: this.position,
      registrationId: this.registrationId,
      teamAcronym: this.teamAcronym,
      teamId: this.teamId,
      teamName: this.teamName,
      tieBreakers: this.tieBreakers,
      updatedAt: this.updatedAt,
      wins: this.wins,
    };
  }
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function readTieBreakers(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = {
  ChampionshipStanding,
};
