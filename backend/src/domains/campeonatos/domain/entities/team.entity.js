const { TeamStatus } = require("../../shared/enums/index.js");

class ChampionshipTeam {
  constructor(input = {}) {
    this.id = input.id || null;
    this.championshipId = input.championshipId || null;
    this.championshipName = input.championshipName || null;
    this.name = input.name || "";
    this.nameKey = input.nameKey || "";
    this.acronym = input.acronym || null;
    this.category = input.category || "";
    this.modality = input.modality || null;
    this.city = input.city || null;
    this.state = input.state || null;
    this.responsible = input.responsible || null;
    this.coach = input.coach || null;
    this.assistantCoach = input.assistantCoach || null;
    this.technicalCommission = Array.isArray(input.technicalCommission)
      ? input.technicalCommission
      : [];
    this.primaryUniform = input.primaryUniform || null;
    this.secondaryUniform = input.secondaryUniform || null;
    this.primaryColor = input.primaryColor || null;
    this.secondaryColor = input.secondaryColor || null;
    this.observations = input.observations || null;
    this.status = input.status || TeamStatus.ACTIVE;
    this.shield = readObjectOrNull(input.shield || input.logo);
    this.logo = this.shield;
    this.metadata = input.metadata || {};
    this.createdBy = input.createdBy || null;
    this.updatedBy = input.updatedBy || null;
    this.createdAt = input.createdAt || null;
    this.updatedAt = input.updatedAt || null;
    this.activatedAt = input.activatedAt || null;
    this.inactivatedAt = input.inactivatedAt || null;
    this.disqualifiedAt = input.disqualifiedAt || null;
    this.deletedAt = input.deletedAt || null;
  }

  static fromPersistence(row = {}) {
    return new ChampionshipTeam({
      acronym: row.acronym,
      activatedAt: row.activated_at || row.activatedAt || null,
      assistantCoach: row.assistant_coach || row.assistantCoach || null,
      category: row.category || "",
      championshipId: row.championship_id || row.championshipId || null,
      championshipName: row.championship_name || row.championshipName || null,
      city: row.city || null,
      coach: row.coach || null,
      createdAt: row.created_at || row.createdAt || null,
      createdBy: row.created_by || row.createdBy || null,
      deletedAt: row.deleted_at || row.deletedAt || null,
      disqualifiedAt: row.disqualified_at || row.disqualifiedAt || null,
      id: row.id || null,
      inactivatedAt: row.inactivated_at || row.inactivatedAt || null,
      metadata: row.metadata || {},
      modality: row.modality || null,
      name: row.name || "",
      nameKey: row.name_key || row.nameKey || "",
      observations: row.observations || null,
      primaryColor: row.primary_color || row.primaryColor || null,
      primaryUniform: row.primary_uniform || row.primaryUniform || null,
      responsible: row.responsible || null,
      secondaryColor: row.secondary_color || row.secondaryColor || null,
      secondaryUniform: row.secondary_uniform || row.secondaryUniform || null,
      shield: row.shield || null,
      state: row.state || null,
      status: row.status || TeamStatus.ACTIVE,
      technicalCommission: Array.isArray(row.technical_commission)
        ? row.technical_commission
        : row.technicalCommission || [],
      updatedAt: row.updated_at || row.updatedAt || null,
      updatedBy: row.updated_by || row.updatedBy || null,
    });
  }

  toJSON() {
    return {
      acronym: this.acronym,
      activatedAt: this.activatedAt,
      assistantCoach: this.assistantCoach,
      category: this.category,
      championshipId: this.championshipId,
      championshipName: this.championshipName,
      city: this.city,
      coach: this.coach,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      deletedAt: this.deletedAt,
      disqualifiedAt: this.disqualifiedAt,
      id: this.id,
      inactivatedAt: this.inactivatedAt,
      logo: this.logo,
      metadata: this.metadata,
      modality: this.modality,
      name: this.name,
      observations: this.observations,
      primaryColor: this.primaryColor,
      primaryUniform: this.primaryUniform,
      responsible: this.responsible,
      secondaryColor: this.secondaryColor,
      secondaryUniform: this.secondaryUniform,
      shield: this.shield,
      state: this.state,
      status: this.status,
      technicalCommission: this.technicalCommission,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }
}

function readObjectOrNull(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return Object.keys(value).length > 0 ? value : null;
}

module.exports = {
  ChampionshipTeam,
};
