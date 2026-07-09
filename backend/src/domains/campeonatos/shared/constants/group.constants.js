const CHAMPIONSHIP_GROUP_TABLE_NAME = "j12_campeonato_grupos";
const CHAMPIONSHIP_GROUP_REGISTRATION_TABLE_NAME = "j12_campeonato_grupo_inscricoes";
const CHAMPIONSHIP_GROUP_ROUTE_SEGMENT = "/grupos";

const CHAMPIONSHIP_GROUP_PERMISSIONS = Object.freeze({
  assign: "campeonatos.grupos.equipes.vincular",
  create: "campeonatos.grupos.criar",
  delete: "campeonatos.grupos.remover",
  draw: "campeonatos.grupos.sortear",
  edit: "campeonatos.grupos.editar",
  redistribute: "campeonatos.grupos.redistribuir",
  view: "campeonatos.grupos.visualizar",
});

module.exports = {
  CHAMPIONSHIP_GROUP_PERMISSIONS,
  CHAMPIONSHIP_GROUP_REGISTRATION_TABLE_NAME,
  CHAMPIONSHIP_GROUP_ROUTE_SEGMENT,
  CHAMPIONSHIP_GROUP_TABLE_NAME,
};
