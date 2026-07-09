const CHAMPIONSHIP_ADMIN_ROUTE_BASE_PATH = "/admin/campeonatos";
const CHAMPIONSHIP_PUBLIC_ROUTE_BASE_PATH = "/public/campeonatos";
const CHAMPIONSHIP_TABLE_NAME = "j12_campeonatos";
const CHAMPIONSHIP_MODULE_NAME = "campeonatos";
const CHAMPIONSHIP_ADMIN_ACCESS_POLICY = Object.freeze({
  currentGuard: "requireAuth+canManageSystem",
  granularPermissions: Object.freeze({
    archive: "campeonatos.archive",
    manage: "campeonatos.manage",
    publish: "campeonatos.publish",
  }),
});
const CHAMPIONSHIP_LOGO_STRUCTURE = Object.freeze({
  metadataKey: "logo",
  storageModuleRequired: "arquivos",
  uploadEnabled: false,
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

module.exports = {
  CHAMPIONSHIP_ADMIN_ACCESS_POLICY,
  CHAMPIONSHIP_ADMIN_ROUTE_BASE_PATH,
  CHAMPIONSHIP_LOGO_STRUCTURE,
  CHAMPIONSHIP_MODULE_NAME,
  CHAMPIONSHIP_PUBLIC_ROUTE_BASE_PATH,
  CHAMPIONSHIP_TABLE_NAME,
};
