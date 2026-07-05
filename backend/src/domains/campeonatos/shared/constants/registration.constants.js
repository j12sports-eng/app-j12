const CHAMPIONSHIP_REGISTRATION_TABLE_NAME = "j12_campeonato_inscricoes";
const CHAMPIONSHIP_REGISTRATION_ROUTE_SEGMENT = "/inscricoes";

const CHAMPIONSHIP_REGISTRATION_PERMISSIONS = Object.freeze({
  cancel: "campeonatos.inscricoes.cancelar",
  create: "campeonatos.inscricoes.criar",
  edit: "campeonatos.inscricoes.editar",
  view: "campeonatos.inscricoes.visualizar",
});

module.exports = {
  CHAMPIONSHIP_REGISTRATION_PERMISSIONS,
  CHAMPIONSHIP_REGISTRATION_ROUTE_SEGMENT,
  CHAMPIONSHIP_REGISTRATION_TABLE_NAME,
};
