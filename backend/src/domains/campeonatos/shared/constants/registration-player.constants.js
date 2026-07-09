const CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME = "j12_campeonato_inscricao_atletas";
const CHAMPIONSHIP_REGISTRATION_PLAYER_ROUTE_SEGMENT = "/inscricoes/:registrationId/atletas";

const CHAMPIONSHIP_REGISTRATION_PLAYER_PERMISSIONS = Object.freeze({
  create: "campeonatos.inscricoes.atletas.criar",
  delete: "campeonatos.inscricoes.atletas.excluir",
  edit: "campeonatos.inscricoes.atletas.editar",
  setCaptain: "campeonatos.inscricoes.atletas.capitao",
  view: "campeonatos.inscricoes.atletas.visualizar",
});

module.exports = {
  CHAMPIONSHIP_REGISTRATION_PLAYER_PERMISSIONS,
  CHAMPIONSHIP_REGISTRATION_PLAYER_ROUTE_SEGMENT,
  CHAMPIONSHIP_REGISTRATION_PLAYER_TABLE_NAME,
};
