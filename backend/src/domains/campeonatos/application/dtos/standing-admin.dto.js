const { ChampionshipStanding } = require("../../domain/entities/index.js");

function toChampionshipStandingAdminDto(value) {
  if (!value) return null;

  const standing = value instanceof ChampionshipStanding ? value : new ChampionshipStanding(value);

  return {
    calculatedAt: standing.calculatedAt,
    championshipId: standing.championshipId,
    draws: standing.draws,
    goalDifference: standing.goalDifference,
    goalsAgainst: standing.goalsAgainst,
    goalsFor: standing.goalsFor,
    groupDisplayOrder: standing.groupDisplayOrder,
    groupId: standing.groupId,
    groupName: standing.groupName,
    groupPosition: standing.groupPosition,
    id: standing.id,
    losses: standing.losses,
    overallPosition: standing.overallPosition,
    played: standing.played,
    points: standing.points,
    position: standing.position,
    registrationId: standing.registrationId,
    teamAcronym: standing.teamAcronym,
    teamId: standing.teamId,
    teamName: standing.teamName,
    tieBreakers: standing.tieBreakers,
    updatedAt: standing.updatedAt,
    wins: standing.wins,
  };
}

function toChampionshipStandingAdminListDto(values = []) {
  return values.map(toChampionshipStandingAdminDto).filter(Boolean);
}

function toChampionshipStandingGroupDto(group = {}) {
  return {
    groupDisplayOrder: Number(group.groupDisplayOrder || 0),
    groupId: group.groupId || null,
    groupName: group.groupName || null,
    items: toChampionshipStandingAdminListDto(group.items || []),
    total: Array.isArray(group.items) ? group.items.length : 0,
  };
}

function toChampionshipStandingAdminResponseDto(input = {}) {
  const items = toChampionshipStandingAdminListDto(input.items || []);

  return {
    calculatedAt: input.calculatedAt || null,
    criteria: Array.isArray(input.criteria) ? input.criteria : [],
    groups: (input.groups || []).map(toChampionshipStandingGroupDto),
    items,
    limit: Number(input.limit || items.length || 100),
    page: Number(input.page || 1),
    total: Number(input.total || items.length),
  };
}

module.exports = {
  toChampionshipStandingAdminDto,
  toChampionshipStandingAdminListDto,
  toChampionshipStandingAdminResponseDto,
};
