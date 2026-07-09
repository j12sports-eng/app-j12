class ChampionshipGroup {
  constructor(input = {}) {
    this.id = input.id || null;
    this.championshipId = input.championshipId || null;
    this.name = input.name || null;
    this.displayOrder = Number.isFinite(Number(input.displayOrder))
      ? Number(input.displayOrder)
      : 0;
    this.registrations = Array.isArray(input.registrations) ? input.registrations : [];
    this.createdBy = input.createdBy || null;
    this.updatedBy = input.updatedBy || null;
    this.createdAt = input.createdAt || null;
    this.updatedAt = input.updatedAt || null;
  }

  static fromPersistence(row = {}) {
    return new ChampionshipGroup({
      championshipId: row.championship_id || row.championshipId || null,
      createdAt: row.created_at || row.createdAt || null,
      createdBy: row.created_by || row.createdBy || null,
      displayOrder: row.display_order ?? row.displayOrder ?? 0,
      id: row.id || null,
      name: row.name || null,
      registrations: Array.isArray(row.registrations) ? row.registrations : [],
      updatedAt: row.updated_at || row.updatedAt || null,
      updatedBy: row.updated_by || row.updatedBy || null,
    });
  }

  toJSON() {
    return {
      championshipId: this.championshipId,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      displayOrder: this.displayOrder,
      id: this.id,
      name: this.name,
      registrations: this.registrations,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }
}

class ChampionshipGroupRegistration {
  constructor(input = {}) {
    this.id = input.id || null;
    this.groupId = input.groupId || null;
    this.registrationId = input.registrationId || null;
    this.championshipId = input.championshipId || null;
    this.teamId = input.teamId || null;
    this.teamName = input.teamName || null;
    this.teamAcronym = input.teamAcronym || null;
    this.status = input.status || null;
    this.drawPosition = Number.isFinite(Number(input.drawPosition))
      ? Number(input.drawPosition)
      : 0;
    this.createdAt = input.createdAt || null;
    this.updatedAt = input.updatedAt || null;
  }

  static fromPersistence(row = {}) {
    return new ChampionshipGroupRegistration({
      championshipId: row.championship_id || row.championshipId || null,
      createdAt: row.created_at || row.createdAt || null,
      drawPosition: row.draw_position ?? row.drawPosition ?? 0,
      groupId: row.group_id || row.groupId || null,
      id: row.id || null,
      registrationId: row.registration_id || row.registrationId || null,
      status: row.status || null,
      teamAcronym: row.team_acronym || row.teamAcronym || null,
      teamId: row.team_id || row.teamId || null,
      teamName: row.team_name || row.teamName || null,
      updatedAt: row.updated_at || row.updatedAt || null,
    });
  }

  toJSON() {
    return {
      championshipId: this.championshipId,
      createdAt: this.createdAt,
      drawPosition: this.drawPosition,
      groupId: this.groupId,
      id: this.id,
      registrationId: this.registrationId,
      status: this.status,
      teamAcronym: this.teamAcronym,
      teamId: this.teamId,
      teamName: this.teamName,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = {
  ChampionshipGroup,
  ChampionshipGroupRegistration,
};
