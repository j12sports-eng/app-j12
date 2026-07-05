import type {
  ChampionshipRegistrationStatus,
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

export function formatChampionshipDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}
