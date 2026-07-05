const CHAMPIONSHIP_TEAM_TABLE_NAME = "j12_campeonato_equipes";
const CHAMPIONSHIP_TEAM_ROUTE_SEGMENT = "/equipes";

const CHAMPIONSHIP_TEAM_PERMISSIONS = Object.freeze({
  create: "campeonatos.equipes.criar",
  delete: "campeonatos.equipes.excluir",
  edit: "campeonatos.equipes.editar",
  view: "campeonatos.equipes.visualizar",
});

const CHAMPIONSHIP_TEAM_SHIELD_STRUCTURE = Object.freeze({
  metadataKey: "shield",
  storageModuleRequired: "arquivos",
  uploadEnabled: false,
  previewEnabledWhenPublicUrlExists: true,
  allowedFields: Object.freeze([
    "id",
    "fileId",
    "storageKey",
    "publicUrl",
    "originalName",
    "mimeType",
    "sizeBytes",
    "checksum",
    "uploadedAt",
    "uploadedBy",
  ]),
});

const CHAMPIONSHIP_TEAM_TECHNICAL_COMMISSION_STRUCTURE = Object.freeze({
  crudEnabled: false,
  fields: Object.freeze(["name", "role", "phone", "email"]),
  relationshipReady: true,
});

module.exports = {
  CHAMPIONSHIP_TEAM_PERMISSIONS,
  CHAMPIONSHIP_TEAM_ROUTE_SEGMENT,
  CHAMPIONSHIP_TEAM_SHIELD_STRUCTURE,
  CHAMPIONSHIP_TEAM_TECHNICAL_COMMISSION_STRUCTURE,
  CHAMPIONSHIP_TEAM_TABLE_NAME,
};
