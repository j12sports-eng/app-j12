const { Championship } = require("../../domain/entities/index.js");

function toChampionshipAdminDto(value) {
  if (!value) return null;

  const championship = value instanceof Championship ? value : new Championship(value);

  return {
    archivedAt: championship.archivedAt,
    category: championship.category,
    createdAt: championship.createdAt,
    createdBy: championship.createdBy,
    deletedAt: championship.deletedAt,
    description: championship.description,
    endDate: championship.endDate,
    id: championship.id,
    logo: championship.logo || championship.metadata?.logo || null,
    metadata: championship.metadata || {},
    modality: championship.modality,
    name: championship.name,
    publishedAt: championship.publishedAt,
    startDate: championship.startDate,
    status: championship.status,
    updatedAt: championship.updatedAt,
    updatedBy: championship.updatedBy,
  };
}

function toChampionshipAdminListDto(values = []) {
  return values.map(toChampionshipAdminDto).filter(Boolean);
}

module.exports = {
  toChampionshipAdminDto,
  toChampionshipAdminListDto,
};
