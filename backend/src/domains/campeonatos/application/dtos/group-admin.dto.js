const {
  ChampionshipGroup,
  ChampionshipGroupRegistration,
} = require("../../domain/entities/index.js");

function toChampionshipGroupAdminDto(value) {
  if (!value) return null;

  const group = value instanceof ChampionshipGroup ? value : new ChampionshipGroup(value);

  return {
    championshipId: group.championshipId,
    createdAt: group.createdAt,
    createdBy: group.createdBy,
    displayOrder: group.displayOrder,
    id: group.id,
    name: group.name,
    registrations: toChampionshipGroupRegistrationAdminListDto(group.registrations),
    updatedAt: group.updatedAt,
    updatedBy: group.updatedBy,
  };
}

function toChampionshipGroupAdminListDto(values = []) {
  return values.map(toChampionshipGroupAdminDto).filter(Boolean);
}

function toChampionshipGroupRegistrationAdminDto(value) {
  if (!value) return null;

  const registration =
    value instanceof ChampionshipGroupRegistration
      ? value
      : new ChampionshipGroupRegistration(value);

  return {
    championshipId: registration.championshipId,
    createdAt: registration.createdAt,
    drawPosition: registration.drawPosition,
    groupId: registration.groupId,
    id: registration.id,
    registrationId: registration.registrationId,
    status: registration.status,
    teamAcronym: registration.teamAcronym,
    teamId: registration.teamId,
    teamName: registration.teamName,
    updatedAt: registration.updatedAt,
  };
}

function toChampionshipGroupRegistrationAdminListDto(values = []) {
  return values.map(toChampionshipGroupRegistrationAdminDto).filter(Boolean);
}

module.exports = {
  toChampionshipGroupAdminDto,
  toChampionshipGroupAdminListDto,
  toChampionshipGroupRegistrationAdminDto,
  toChampionshipGroupRegistrationAdminListDto,
};
