const CHAMPIONSHIP_ROUND_TABLE_NAME = "j12_campeonato_rodadas";
const CHAMPIONSHIP_MATCH_TABLE_NAME = "j12_campeonato_jogos";
const CHAMPIONSHIP_ROUND_ROUTE_SEGMENT = "/rodadas";
const CHAMPIONSHIP_MATCH_ROUTE_SEGMENT = "/jogos";

const ChampionshipRoundPhase = Object.freeze({
  GROUP_STAGE: "GROUP_STAGE",
});

const CHAMPIONSHIP_ROUND_PHASES = Object.freeze(Object.values(ChampionshipRoundPhase));

const ChampionshipMatchStatus = Object.freeze({
  CANCELLED: "CANCELLED",
  FINISHED: "FINISHED",
  POSTPONED: "POSTPONED",
  SCHEDULED: "SCHEDULED",
});

const CHAMPIONSHIP_MATCH_STATUSES = Object.freeze(Object.values(ChampionshipMatchStatus));

const CHAMPIONSHIP_ROUND_PERMISSIONS = Object.freeze({
  create: "campeonatos.rodadas.criar",
  delete: "campeonatos.rodadas.remover",
  edit: "campeonatos.rodadas.editar",
  generate: "campeonatos.rodadas.gerar",
  matchCreate: "campeonatos.jogos.criar",
  matchDelete: "campeonatos.jogos.remover",
  matchEdit: "campeonatos.jogos.editar",
  matchMove: "campeonatos.jogos.mover",
  view: "campeonatos.rodadas.visualizar",
});

module.exports = {
  CHAMPIONSHIP_MATCH_ROUTE_SEGMENT,
  CHAMPIONSHIP_MATCH_STATUSES,
  CHAMPIONSHIP_MATCH_TABLE_NAME,
  CHAMPIONSHIP_ROUND_PERMISSIONS,
  CHAMPIONSHIP_ROUND_PHASES,
  CHAMPIONSHIP_ROUND_ROUTE_SEGMENT,
  CHAMPIONSHIP_ROUND_TABLE_NAME,
  ChampionshipMatchStatus,
  ChampionshipRoundPhase,
};
