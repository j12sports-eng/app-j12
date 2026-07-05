const { ChampionshipTeam } = require("../../domain/entities/index.js");

function toTeamAdminDto(value) {
  if (!value) return null;

  const team = value instanceof ChampionshipTeam ? value : new ChampionshipTeam(value);

  return {
    acronym: team.acronym,
    activatedAt: team.activatedAt,
    assistantCoach: team.assistantCoach,
    category: team.category,
    championshipId: team.championshipId,
    championshipName: team.championshipName,
    city: team.city,
    coach: team.coach,
    createdAt: team.createdAt,
    createdBy: team.createdBy,
    deletedAt: team.deletedAt,
    disqualifiedAt: team.disqualifiedAt,
    id: team.id,
    inactivatedAt: team.inactivatedAt,
    logo: team.logo || team.shield || null,
    metadata: team.metadata || {},
    modality: team.modality,
    name: team.name,
    observations: team.observations,
    primaryColor: team.primaryColor,
    primaryUniform: team.primaryUniform,
    responsible: team.responsible,
    secondaryColor: team.secondaryColor,
    secondaryUniform: team.secondaryUniform,
    shield: team.shield || team.logo || null,
    state: team.state,
    status: team.status,
    technicalCommission: team.technicalCommission || [],
    updatedAt: team.updatedAt,
    updatedBy: team.updatedBy,
  };
}

function toTeamAdminListDto(values = []) {
  return values.map(toTeamAdminDto).filter(Boolean);
}

module.exports = {
  toTeamAdminDto,
  toTeamAdminListDto,
};
