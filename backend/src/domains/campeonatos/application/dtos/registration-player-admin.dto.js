const { ChampionshipRegistrationPlayer } = require("../../domain/entities/index.js");

function toRegistrationPlayerAdminDto(value) {
  if (!value) return null;

  const player =
    value instanceof ChampionshipRegistrationPlayer
      ? value
      : new ChampionshipRegistrationPlayer(value);

  return {
    active: player.active,
    athleteId: player.athleteId,
    birthDate: player.birthDate,
    captain: player.captain,
    createdAt: player.createdAt,
    document: player.document,
    id: player.id,
    name: player.name,
    position: player.position,
    registrationId: player.registrationId,
    shirtNumber: player.shirtNumber,
    updatedAt: player.updatedAt,
  };
}

function toRegistrationPlayerAdminListDto(values = []) {
  return values.map(toRegistrationPlayerAdminDto).filter(Boolean);
}

module.exports = {
  toRegistrationPlayerAdminDto,
  toRegistrationPlayerAdminListDto,
};
