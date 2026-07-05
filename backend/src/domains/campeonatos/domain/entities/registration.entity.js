const { RegistrationStatus } = require("../../shared/enums/index.js");

class ChampionshipRegistration {
  constructor(input = {}) {
    this.id = input.id || null;
    this.championshipId = input.championshipId || null;
    this.championshipName = input.championshipName || null;
    this.teamId = input.teamId || null;
    this.teamName = input.teamName || null;
    this.teamAcronym = input.teamAcronym || null;
    this.category = input.category || null;
    this.modality = input.modality || null;
    this.status = input.status || RegistrationStatus.PENDING;
    this.observations = input.observations || null;
    this.metadata = input.metadata || {};
    this.createdBy = input.createdBy || null;
    this.updatedBy = input.updatedBy || null;
    this.createdAt = input.createdAt || null;
    this.updatedAt = input.updatedAt || null;
    this.confirmedAt = input.confirmedAt || null;
    this.refusedAt = input.refusedAt || null;
    this.cancelledAt = input.cancelledAt || null;
    this.deletedAt = input.deletedAt || null;
  }

  static fromPersistence(row = {}) {
    return new ChampionshipRegistration({
      cancelledAt: row.cancelled_at || row.cancelledAt || null,
      category: row.category || row.team_category || row.championship_category || null,
      championshipId: row.championship_id || row.championshipId || null,
      championshipName: row.championship_name || row.championshipName || null,
      confirmedAt: row.confirmed_at || row.confirmedAt || null,
      createdAt: row.created_at || row.createdAt || null,
      createdBy: row.created_by || row.createdBy || null,
      deletedAt: row.deleted_at || row.deletedAt || null,
      id: row.id || null,
      metadata: row.metadata || {},
      modality: row.modality || row.team_modality || row.championship_modality || null,
      observations: row.observations || null,
      refusedAt: row.refused_at || row.refusedAt || null,
      status: row.status || RegistrationStatus.PENDING,
      teamAcronym: row.team_acronym || row.teamAcronym || null,
      teamId: row.team_id || row.teamId || null,
      teamName: row.team_name || row.teamName || null,
      updatedAt: row.updated_at || row.updatedAt || null,
      updatedBy: row.updated_by || row.updatedBy || null,
    });
  }

  toJSON() {
    return {
      cancelledAt: this.cancelledAt,
      category: this.category,
      championshipId: this.championshipId,
      championshipName: this.championshipName,
      confirmedAt: this.confirmedAt,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      deletedAt: this.deletedAt,
      id: this.id,
      metadata: this.metadata,
      modality: this.modality,
      observations: this.observations,
      refusedAt: this.refusedAt,
      status: this.status,
      teamAcronym: this.teamAcronym,
      teamId: this.teamId,
      teamName: this.teamName,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }
}

module.exports = {
  ChampionshipRegistration,
};
