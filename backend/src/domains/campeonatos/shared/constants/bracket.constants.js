const CHAMPIONSHIP_BRACKET_TABLE_NAME = "j12_campeonato_chaveamentos";
const CHAMPIONSHIP_BRACKET_MATCH_TABLE_NAME = "j12_campeonato_chaveamento_jogos";
const CHAMPIONSHIP_BRACKET_ROUTE_SEGMENT = "/playoffs";

const ChampionshipBracketMode = Object.freeze({
  AUTOMATIC: "AUTOMATIC",
  MANUAL: "MANUAL",
});

const ChampionshipBracketStatus = Object.freeze({
  CANCELLED: "CANCELLED",
  DRAFT: "DRAFT",
  FINISHED: "FINISHED",
  IN_PROGRESS: "IN_PROGRESS",
  READY: "READY",
});

const ChampionshipBracketPhase = Object.freeze({
  FINAL: "FINAL",
  QUARTER_FINAL: "QUARTER_FINAL",
  ROUND_OF_16: "ROUND_OF_16",
  ROUND_OF_32: "ROUND_OF_32",
  SEMI_FINAL: "SEMI_FINAL",
  THIRD_PLACE: "THIRD_PLACE",
});

const ChampionshipBracketSlot = Object.freeze({
  AWAY: "AWAY",
  HOME: "HOME",
});

const CHAMPIONSHIP_BRACKET_MODES = Object.freeze(Object.values(ChampionshipBracketMode));
const CHAMPIONSHIP_BRACKET_STATUSES = Object.freeze(Object.values(ChampionshipBracketStatus));
const CHAMPIONSHIP_BRACKET_PHASES = Object.freeze(Object.values(ChampionshipBracketPhase));
const CHAMPIONSHIP_BRACKET_SLOTS = Object.freeze(Object.values(ChampionshipBracketSlot));

const CHAMPIONSHIP_BRACKET_PHASE_ORDER = Object.freeze([
  ChampionshipBracketPhase.ROUND_OF_32,
  ChampionshipBracketPhase.ROUND_OF_16,
  ChampionshipBracketPhase.QUARTER_FINAL,
  ChampionshipBracketPhase.SEMI_FINAL,
  ChampionshipBracketPhase.FINAL,
  ChampionshipBracketPhase.THIRD_PLACE,
]);

const CHAMPIONSHIP_BRACKET_INITIAL_PHASE_BY_TEAM_COUNT = Object.freeze({
  2: ChampionshipBracketPhase.FINAL,
  4: ChampionshipBracketPhase.SEMI_FINAL,
  8: ChampionshipBracketPhase.QUARTER_FINAL,
  16: ChampionshipBracketPhase.ROUND_OF_16,
  32: ChampionshipBracketPhase.ROUND_OF_32,
});

const CHAMPIONSHIP_BRACKET_TEAM_COUNT_BY_INITIAL_PHASE = Object.freeze({
  [ChampionshipBracketPhase.FINAL]: 2,
  [ChampionshipBracketPhase.QUARTER_FINAL]: 8,
  [ChampionshipBracketPhase.ROUND_OF_16]: 16,
  [ChampionshipBracketPhase.ROUND_OF_32]: 32,
  [ChampionshipBracketPhase.SEMI_FINAL]: 4,
});

const CHAMPIONSHIP_BRACKET_PERMISSIONS = Object.freeze({
  advance: "campeonatos.mata_mata.avancar",
  delete: "campeonatos.mata_mata.remover",
  edit: "campeonatos.mata_mata.editar",
  generate: "campeonatos.mata_mata.gerar",
  view: "campeonatos.mata_mata.visualizar",
});

module.exports = {
  CHAMPIONSHIP_BRACKET_INITIAL_PHASE_BY_TEAM_COUNT,
  CHAMPIONSHIP_BRACKET_MATCH_TABLE_NAME,
  CHAMPIONSHIP_BRACKET_MODES,
  CHAMPIONSHIP_BRACKET_PERMISSIONS,
  CHAMPIONSHIP_BRACKET_PHASE_ORDER,
  CHAMPIONSHIP_BRACKET_PHASES,
  CHAMPIONSHIP_BRACKET_ROUTE_SEGMENT,
  CHAMPIONSHIP_BRACKET_SLOTS,
  CHAMPIONSHIP_BRACKET_STATUSES,
  CHAMPIONSHIP_BRACKET_TABLE_NAME,
  CHAMPIONSHIP_BRACKET_TEAM_COUNT_BY_INITIAL_PHASE,
  ChampionshipBracketMode,
  ChampionshipBracketPhase,
  ChampionshipBracketSlot,
  ChampionshipBracketStatus,
};
