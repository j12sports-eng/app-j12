import type {
  ChampionshipRegistrationStatus,
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
