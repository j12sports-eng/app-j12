const { ChampionshipRegistration } = require("../../domain/entities/index.js");

function toRegistrationAdminDto(value) {
  if (!value) return null;

  const registration =
    value instanceof ChampionshipRegistration ? value : new ChampionshipRegistration(value);

  return {
    cancelledAt: registration.cancelledAt,
    category: registration.category,
    championshipId: registration.championshipId,
    championshipName: registration.championshipName,
    confirmedAt: registration.confirmedAt,
    createdAt: registration.createdAt,
    createdBy: registration.createdBy,
    deletedAt: registration.deletedAt,
    id: registration.id,
    metadata: registration.metadata || {},
    modality: registration.modality,
    observations: registration.observations,
    refusedAt: registration.refusedAt,
    status: registration.status,
    teamAcronym: registration.teamAcronym,
    teamId: registration.teamId,
    teamName: registration.teamName,
    updatedAt: registration.updatedAt,
    updatedBy: registration.updatedBy,
  };
}

function toRegistrationAdminListDto(values = []) {
  return values.map(toRegistrationAdminDto).filter(Boolean);
}

module.exports = {
  toRegistrationAdminDto,
  toRegistrationAdminListDto,
};
