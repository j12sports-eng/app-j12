const CHAMPIONSHIP_STATISTICS_TABLE_NAME = "j12_campeonato_estatisticas";
const CHAMPIONSHIP_TEAM_STATISTICS_TABLE_NAME = "j12_campeonato_estatisticas_equipes";
const CHAMPIONSHIP_PLAYER_STATISTICS_TABLE_NAME = "j12_campeonato_estatisticas_atletas";

const CHAMPIONSHIP_STATISTICS_ROUTE_SEGMENT = "/estatisticas";
const CHAMPIONSHIP_RANKINGS_ROUTE_SEGMENT = "/rankings";
const CHAMPIONSHIP_TOP_SCORERS_ROUTE_SEGMENT = "/artilharia";

const ChampionshipRankingType = Object.freeze({
  BEST_ATTACK: "bestAttack",
  BEST_DEFENSE: "bestDefense",
  FAIR_PLAY: "fairPlay",
  TOP_SCORERS: "topScorers",
});

const CHAMPIONSHIP_RANKING_TYPES = Object.freeze(Object.values(ChampionshipRankingType));

const CHAMPIONSHIP_STATISTICS_PERMISSIONS = Object.freeze({
  recalculate: "campeonatos.estatisticas.recalcular",
  view: "campeonatos.estatisticas.visualizar",
});

module.exports = {
  CHAMPIONSHIP_PLAYER_STATISTICS_TABLE_NAME,
  CHAMPIONSHIP_RANKINGS_ROUTE_SEGMENT,
  CHAMPIONSHIP_RANKING_TYPES,
  CHAMPIONSHIP_STATISTICS_PERMISSIONS,
  CHAMPIONSHIP_STATISTICS_ROUTE_SEGMENT,
  CHAMPIONSHIP_STATISTICS_TABLE_NAME,
  CHAMPIONSHIP_TEAM_STATISTICS_TABLE_NAME,
  CHAMPIONSHIP_TOP_SCORERS_ROUTE_SEGMENT,
  ChampionshipRankingType,
};
