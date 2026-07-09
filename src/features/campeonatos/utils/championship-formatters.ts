import type {
  ChampionshipMatchStatus,
  ChampionshipRegistrationPlayerStatus,
  ChampionshipRegistrationStatus,
  ChampionshipRoundPhase,
  ChampionshipStandingTieBreaker,
  ChampionshipStatus,
} from "../types/championship.types";

export function getChampionshipStatusLabel(status: ChampionshipStatus | "") {
  const labels: Record<ChampionshipStatus, string> = {
    ARCHIVED: "Arquivado",
    DRAFT: "Rascunho",
    PUBLISHED: "Publicado",
    REMOVED: "Removido",
  };

  return status ? labels[status] || status : "Todos";
}

export function getChampionshipStatusTone(status: ChampionshipStatus) {
  if (status === "PUBLISHED") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
  if (status === "ARCHIVED") return "border-slate-400/20 bg-slate-500/10 text-slate-200";
  if (status === "REMOVED") return "border-red-400/20 bg-red-500/10 text-red-100";

  return "border-amber-400/20 bg-amber-500/10 text-amber-100";
}

export function getRegistrationStatusLabel(status: ChampionshipRegistrationStatus | "") {
  const labels: Record<ChampionshipRegistrationStatus, string> = {
    CANCELLED: "Cancelada",
    CONFIRMED: "Confirmada",
    PENDING: "Pendente",
    REFUSED: "Recusada",
  };

  return status ? labels[status] || status : "Todos";
}

export function getRegistrationStatusTone(status: ChampionshipRegistrationStatus) {
  if (status === "CONFIRMED") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
  if (status === "REFUSED") return "border-red-400/20 bg-red-500/10 text-red-100";
  if (status === "CANCELLED") return "border-slate-400/20 bg-slate-500/10 text-slate-200";

  return "border-amber-400/20 bg-amber-500/10 text-amber-100";
}

export function getRegistrationPlayerStatusLabel(
  status: ChampionshipRegistrationPlayerStatus | "",
) {
  const labels: Record<ChampionshipRegistrationPlayerStatus, string> = {
    ACTIVE: "Ativo",
    INACTIVE: "Inativo",
  };

  return status ? labels[status] || status : "Todos";
}

export function getRegistrationPlayerStatusTone(status: ChampionshipRegistrationPlayerStatus) {
  if (status === "ACTIVE") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";

  return "border-slate-400/20 bg-slate-500/10 text-slate-200";
}

export function getRoundPhaseLabel(phase: ChampionshipRoundPhase | "") {
  const labels: Record<ChampionshipRoundPhase, string> = {
    GROUP_STAGE: "Fase de grupos",
  };

  return phase ? labels[phase] || phase : "Todas";
}

export function getMatchStatusLabel(status: ChampionshipMatchStatus | "") {
  const labels: Record<ChampionshipMatchStatus, string> = {
    CANCELLED: "Cancelado",
    FINISHED: "Finalizado",
    POSTPONED: "Adiado",
    SCHEDULED: "Agendado",
  };

  return status ? labels[status] || status : "Todos";
}

export function getMatchStatusTone(status: ChampionshipMatchStatus) {
  if (status === "FINISHED") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "SCHEDULED") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
  if (status === "POSTPONED") return "border-amber-400/20 bg-amber-500/10 text-amber-100";

  return "border-red-400/20 bg-red-500/10 text-red-100";
}

export function getStandingTieBreakerLabel(value: ChampionshipStandingTieBreaker) {
  const labels: Record<ChampionshipStandingTieBreaker, string> = {
    draws: "Empates",
    goalDifference: "Saldo de gols",
    goalsAgainst: "Gols contra",
    goalsFor: "Gols pro",
    losses: "Derrotas",
    played: "Jogos",
    points: "Pontos",
    teamName: "Nome da equipe",
    wins: "Vitorias",
  };

  return labels[value] || value;
}

export function formatChampionshipDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

export function formatChampionshipDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}
