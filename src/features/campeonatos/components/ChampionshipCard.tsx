import { type ReactNode } from "react";
import { Archive, CalendarDays, Edit3, Loader2, Send, Trash2 } from "lucide-react";

import { formatChampionshipDate } from "../utils/championship-formatters";
import { ChampionshipStatusBadge } from "./ChampionshipStatusBadge";

import type { Championship } from "../types/championship.types";

type ChampionshipCardProps = {
  championship: Championship;
  isBusy?: boolean;
  onArchive?: (championshipId: string) => void;
  onDelete?: (championshipId: string) => void;
  onEdit?: (championship: Championship) => void;
  onPublish?: (championshipId: string) => void;
};

export function ChampionshipCard({
  championship,
  isBusy = false,
  onArchive,
  onDelete,
  onEdit,
  onPublish,
}: ChampionshipCardProps) {
  const canPublish = championship.status !== "PUBLISHED";
  const canArchive = championship.status !== "ARCHIVED";

  return (
    <article className="rounded-2xl border border-white/10 bg-card p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black text-white">{championship.name}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {championship.category} - {championship.modality}
          </p>
        </div>
        <ChampionshipStatusBadge status={championship.status} />
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
        <CalendarDays className="h-4 w-4 text-primary" />
        {formatChampionshipDate(championship.startDate)} ate{" "}
        {formatChampionshipDate(championship.endDate)}
      </div>

      {championship.description ? (
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-400">
          {championship.description}
        </p>
      ) : (
        <p className="mt-4 text-sm leading-6 text-slate-500">
          Campeonato cadastrado sem observacoes adicionais.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {onEdit ? (
          <ActionButton disabled={isBusy} onClick={() => onEdit(championship)} tone="neutral">
            <Edit3 className="h-4 w-4" />
            Editar
          </ActionButton>
        ) : null}

        {onPublish && canPublish ? (
          <ActionButton disabled={isBusy} onClick={() => onPublish(championship.id)} tone="primary">
            <Send className="h-4 w-4" />
            Publicar
          </ActionButton>
        ) : null}

        {onArchive && canArchive ? (
          <ActionButton disabled={isBusy} onClick={() => onArchive(championship.id)} tone="neutral">
            <Archive className="h-4 w-4" />
            Arquivar
          </ActionButton>
        ) : null}

        {onDelete ? (
          <ActionButton disabled={isBusy} onClick={() => onDelete(championship.id)} tone="danger">
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remover
          </ActionButton>
        ) : null}
      </div>
    </article>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
  tone,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tone: "danger" | "neutral" | "primary";
}) {
  const toneClassName =
    tone === "danger"
      ? "border-red-400/20 bg-red-500/10 text-red-100 hover:bg-red-500/20"
      : tone === "primary"
        ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
        : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClassName}`}
    >
      {children}
    </button>
  );
}
