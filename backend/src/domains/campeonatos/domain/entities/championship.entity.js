const { ChampionshipStatus } = require("../../shared/enums/index.js");

class Championship {
  constructor(input = {}) {
    this.id = input.id || null;
    this.name = input.name || "";
    this.category = input.category || "";
    this.modality = input.modality || "";
    this.startDate = input.startDate || null;
    this.endDate = input.endDate || null;
    this.status = input.status || ChampionshipStatus.DRAFT;
    this.description = input.description || null;
    this.metadata = input.metadata || {};
    this.logo = readLogo(input.logo || this.metadata.logo);
    this.createdBy = input.createdBy || null;
    this.updatedBy = input.updatedBy || null;
    this.createdAt = input.createdAt || null;
    this.updatedAt = input.updatedAt || null;
    this.publishedAt = input.publishedAt || null;
    this.archivedAt = input.archivedAt || null;
    this.deletedAt = input.deletedAt || null;
  }

  static fromPersistence(row = {}) {
    return new Championship({
      archivedAt: row.archived_at || row.archivedAt || null,
      category: row.category || "",
      createdAt: row.created_at || row.createdAt || null,
      createdBy: row.created_by || row.createdBy || null,
      deletedAt: row.deleted_at || row.deletedAt || null,
      description: row.description || null,
      endDate: row.end_date || row.endDate || null,
      id: row.id || null,
      logo: row.logo || row.metadata?.logo || null,
      metadata: row.metadata || {},
      modality: row.modality || "",
      name: row.name || "",
      publishedAt: row.published_at || row.publishedAt || null,
      startDate: row.start_date || row.startDate || null,
      status: row.status || ChampionshipStatus.DRAFT,
      updatedAt: row.updated_at || row.updatedAt || null,
      updatedBy: row.updated_by || row.updatedBy || null,
    });
  }

  toJSON() {
    return {
      archivedAt: this.archivedAt,
      category: this.category,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      deletedAt: this.deletedAt,
      description: this.description,
      endDate: this.endDate,
      id: this.id,
      logo: this.logo,
      metadata: this.metadata,
      modality: this.modality,
      name: this.name,
      publishedAt: this.publishedAt,
      startDate: this.startDate,
      status: this.status,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }
}

function readLogo(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return Object.keys(value).length > 0 ? value : null;
}

module.exports = {
  Championship,
};
