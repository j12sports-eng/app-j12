import type {
  ChampionshipBracketMode,
  ChampionshipBracketPhase,
  ChampionshipBracketStatus,
  ChampionshipMatchStatus,
  ChampionshipRegistrationPlayerStatus,
  ChampionshipRegistrationStatus,
  ChampionshipRoundPhase,
  ChampionshipRankingType,
  ChampionshipStandingTieBreaker,
  ChampionshipStatus,
} from "../types/championship.types";

export const CHAMPIONSHIP_STATUS_OPTIONS: Array<{
  label: string;
  value: ChampionshipStatus | "";
}> = [
  { label: "Todos", value: "" },
  { label: "Rascunho", value: "DRAFT" },
  { label: "Publicado", value: "PUBLISHED" },
  { label: "Arquivado", value: "ARCHIVED" },
];

export const CHAMPIONSHIP_MODALITY_SUGGESTIONS = ["Futsal", "Society", "Beach Tennis", "Volei"];

export const CHAMPIONSHIP_CATEGORY_SUGGESTIONS = ["Sub-7", "Sub-9", "Sub-11", "Sub-13", "Livre"];

export const CHAMPIONSHIP_REGISTRATION_STATUS_OPTIONS: Array<{
  label: string;
  value: ChampionshipRegistrationStatus | "";
}> = [
  { label: "Todos", value: "" },
  { label: "Pendente", value: "PENDING" },
  { label: "Confirmada", value: "CONFIRMED" },
  { label: "Recusada", value: "REFUSED" },
  { label: "Cancelada", value: "CANCELLED" },
];

export const CHAMPIONSHIP_REGISTRATION_STATUS_LABELS: Record<
  ChampionshipRegistrationStatus,
  string
> = {
  CANCELLED: "Cancelada",
  CONFIRMED: "Confirmada",
  PENDING: "Pendente",
  REFUSED: "Recusada",
};

export const CHAMPIONSHIP_REGISTRATION_PLAYER_STATUS_OPTIONS: Array<{
  label: string;
  value: ChampionshipRegistrationPlayerStatus | "";
}> = [
  { label: "Todos", value: "" },
  { label: "Ativos", value: "ACTIVE" },
  { label: "Inativos", value: "INACTIVE" },
];

export const CHAMPIONSHIP_REGISTRATION_PLAYER_STATUS_LABELS: Record<
  ChampionshipRegistrationPlayerStatus,
  string
> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
};

export const CHAMPIONSHIP_REGISTRATION_PLAYER_POSITION_OPTIONS = [
  "",
  "Goleiro",
  "Fixo",
  "Ala",
  "Pivo",
  "Universal",
];

export const CHAMPIONSHIP_ROUND_PHASE_OPTIONS: Array<{
  label: string;
  value: ChampionshipRoundPhase | "";
}> = [
  { label: "Todas", value: "" },
  { label: "Fase de grupos", value: "GROUP_STAGE" },
];

export const CHAMPIONSHIP_ROUND_PHASE_LABELS: Record<ChampionshipRoundPhase, string> = {
  GROUP_STAGE: "Fase de grupos",
};

export const CHAMPIONSHIP_MATCH_STATUS_OPTIONS: Array<{
  label: string;
  value: ChampionshipMatchStatus | "";
}> = [
  { label: "Todos", value: "" },
  { label: "Agendado", value: "SCHEDULED" },
  { label: "Finalizado", value: "FINISHED" },
  { label: "Adiado", value: "POSTPONED" },
  { label: "Cancelado", value: "CANCELLED" },
];

export const CHAMPIONSHIP_MATCH_STATUS_LABELS: Record<ChampionshipMatchStatus, string> = {
  CANCELLED: "Cancelado",
  FINISHED: "Finalizado",
  POSTPONED: "Adiado",
  SCHEDULED: "Agendado",
};

export const CHAMPIONSHIP_BRACKET_MODE_OPTIONS: Array<{
  label: string;
  value: ChampionshipBracketMode;
}> = [
  { label: "Automatico", value: "AUTOMATIC" },
  { label: "Manual", value: "MANUAL" },
];

export const CHAMPIONSHIP_BRACKET_PHASE_OPTIONS: Array<{
  label: string;
  value: ChampionshipBracketPhase | "";
}> = [
  { label: "Todas", value: "" },
  { label: "16 avos", value: "ROUND_OF_32" },
  { label: "Oitavas", value: "ROUND_OF_16" },
  { label: "Quartas", value: "QUARTER_FINAL" },
  { label: "Semifinal", value: "SEMI_FINAL" },
  { label: "Final", value: "FINAL" },
  { label: "3o lugar", value: "THIRD_PLACE" },
];

export const CHAMPIONSHIP_BRACKET_INITIAL_PHASE_OPTIONS: Array<{
  label: string;
  teamCount: number;
  value: ChampionshipBracketPhase;
}> = [
  { label: "Final", teamCount: 2, value: "FINAL" },
  { label: "Semifinal", teamCount: 4, value: "SEMI_FINAL" },
  { label: "Quartas", teamCount: 8, value: "QUARTER_FINAL" },
  { label: "Oitavas", teamCount: 16, value: "ROUND_OF_16" },
  { label: "16 avos", teamCount: 32, value: "ROUND_OF_32" },
];

export const CHAMPIONSHIP_BRACKET_PHASE_LABELS: Record<ChampionshipBracketPhase, string> = {
  FINAL: "Final",
  QUARTER_FINAL: "Quartas",
  ROUND_OF_16: "Oitavas",
  ROUND_OF_32: "16 avos",
  SEMI_FINAL: "Semifinal",
  THIRD_PLACE: "3o lugar",
};

export const CHAMPIONSHIP_BRACKET_STATUS_LABELS: Record<ChampionshipBracketStatus, string> = {
  CANCELLED: "Cancelado",
  DRAFT: "Rascunho",
  FINISHED: "Finalizado",
  IN_PROGRESS: "Em andamento",
  READY: "Pronto",
};

export const CHAMPIONSHIP_STANDING_TIE_BREAKER_OPTIONS: Array<{
  label: string;
  shortLabel: string;
  value: ChampionshipStandingTieBreaker;
}> = [
  { label: "Pontos", shortLabel: "PTS", value: "points" },
  { label: "Vitorias", shortLabel: "V", value: "wins" },
  { label: "Saldo de gols", shortLabel: "SG", value: "goalDifference" },
  { label: "Gols pro", shortLabel: "GP", value: "goalsFor" },
  { label: "Gols contra", shortLabel: "GC", value: "goalsAgainst" },
  { label: "Empates", shortLabel: "E", value: "draws" },
  { label: "Derrotas", shortLabel: "D", value: "losses" },
  { label: "Jogos", shortLabel: "J", value: "played" },
  { label: "Nome da equipe", shortLabel: "Equipe", value: "teamName" },
];

export const CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS: ChampionshipStandingTieBreaker[] = [
  "points",
  "wins",
  "goalDifference",
  "goalsFor",
  "goalsAgainst",
  "teamName",
];

export const CHAMPIONSHIP_RANKING_OPTIONS: Array<{
  label: string;
  value: ChampionshipRankingType;
}> = [
  { label: "Artilharia", value: "topScorers" },
  { label: "Fair play", value: "fairPlay" },
  { label: "Melhor ataque", value: "bestAttack" },
  { label: "Melhor defesa", value: "bestDefense" },
];
