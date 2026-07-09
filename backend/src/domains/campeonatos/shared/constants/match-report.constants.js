const CHAMPIONSHIP_MATCH_REPORT_TABLE_NAME = "j12_campeonato_sumulas";
const CHAMPIONSHIP_MATCH_EVENT_TABLE_NAME = "j12_campeonato_sumula_eventos";
const CHAMPIONSHIP_MATCH_REPORT_ROUTE_SEGMENT = "/sumula";

const ChampionshipMatchReportStatus = Object.freeze({
  DRAFT: "DRAFT",
  FINISHED: "FINISHED",
  OPEN: "OPEN",
  REOPENED: "REOPENED",
});

const CHAMPIONSHIP_MATCH_REPORT_STATUSES = Object.freeze(
  Object.values(ChampionshipMatchReportStatus),
);

const ChampionshipMatchEventType = Object.freeze({
  FOUL: "FOUL",
  GOAL: "GOAL",
  OBSERVATION: "OBSERVATION",
  RED_CARD: "RED_CARD",
  SUBSTITUTION: "SUBSTITUTION",
  TECHNICAL_TIMEOUT: "TECHNICAL_TIMEOUT",
  WALKOVER: "WALKOVER",
  YELLOW_CARD: "YELLOW_CARD",
});

const CHAMPIONSHIP_MATCH_EVENT_TYPES = Object.freeze(Object.values(ChampionshipMatchEventType));

const CHAMPIONSHIP_MATCH_EVENT_PLAYER_REQUIRED_TYPES = Object.freeze([
  ChampionshipMatchEventType.FOUL,
  ChampionshipMatchEventType.GOAL,
  ChampionshipMatchEventType.RED_CARD,
  ChampionshipMatchEventType.YELLOW_CARD,
]);

const CHAMPIONSHIP_MATCH_EVENT_TEAM_REQUIRED_TYPES = Object.freeze([
  ChampionshipMatchEventType.FOUL,
  ChampionshipMatchEventType.GOAL,
  ChampionshipMatchEventType.RED_CARD,
  ChampionshipMatchEventType.SUBSTITUTION,
  ChampionshipMatchEventType.WALKOVER,
  ChampionshipMatchEventType.YELLOW_CARD,
]);

const CHAMPIONSHIP_MATCH_REPORT_PERMISSIONS = Object.freeze({
  create: "campeonatos.sumulas.criar",
  edit: "campeonatos.sumulas.editar",
  eventCreate: "campeonatos.sumulas.eventos.criar",
  eventDelete: "campeonatos.sumulas.eventos.remover",
  eventEdit: "campeonatos.sumulas.eventos.editar",
  finalize: "campeonatos.sumulas.finalizar",
  reopen: "campeonatos.sumulas.reabrir",
  view: "campeonatos.sumulas.visualizar",
});

module.exports = {
  CHAMPIONSHIP_MATCH_EVENT_PLAYER_REQUIRED_TYPES,
  CHAMPIONSHIP_MATCH_EVENT_TABLE_NAME,
  CHAMPIONSHIP_MATCH_EVENT_TEAM_REQUIRED_TYPES,
  CHAMPIONSHIP_MATCH_EVENT_TYPES,
  CHAMPIONSHIP_MATCH_REPORT_PERMISSIONS,
  CHAMPIONSHIP_MATCH_REPORT_ROUTE_SEGMENT,
  CHAMPIONSHIP_MATCH_REPORT_STATUSES,
  CHAMPIONSHIP_MATCH_REPORT_TABLE_NAME,
  ChampionshipMatchEventType,
  ChampionshipMatchReportStatus,
};
