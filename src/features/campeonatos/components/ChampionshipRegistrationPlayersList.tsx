import {
  Crown,
  Edit3,
  Loader2,
  ShieldCheck,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import {
  getRegistrationPlayerStatusLabel,
  getRegistrationPlayerStatusTone,
} from "../utils/championship-formatters";

import type { ChampionshipRegistrationPlayer } from "../types/championship.types";

type ChampionshipRegistrationPlayersListProps = {
  busyPlayerId?: string | null;
  items: ChampionshipRegistrationPlayer[];
  onDelete?: (playerId: string) => void;
  onEdit?: (player: ChampionshipRegistrationPlayer) => void;
  onSetCaptain?: (playerId: string) => void;
  selectedPlayerId?: string | null;
};

export function ChampionshipRegistrationPlayersList({
  busyPlayerId,
  items,
  onDelete,
  onEdit,
  onSetCaptain,
  selectedPlayerId,
}: ChampionshipRegistrationPlayersListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
        <UserRound className="mx-auto h-8 w-8 text-slate-500" />
        <p className="mt-3 text-sm font-black text-white">Nenhum atleta encontrado</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          O elenco da equipe inscrita aparece aqui apos o cadastro.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((player) => {
        const isBusy = busyPlayerId === player.id;
        const isSelected = selectedPlayerId === player.id;
        const status = player.active ? "ACTIVE" : "INACTIVE";

        return (
          <article
            key={player.id}
            className={`rounded-2xl border p-4 transition ${
              isSelected
                ? "border-primary/50 bg-primary/10"
                : "border-white/10 bg-black/20 hover:border-white/20"
            }`}
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <button type="button" onClick={() => onEdit?.(player)} className="min-w-0 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-2 text-sm font-black text-primary">
                    {player.shirtNumber}
                  </span>
                  <h3 className="truncate text-base font-black text-white">{player.name}</h3>
                  {player.captain ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-primary">
                      <Crown className="h-3.5 w-3.5" />
                      Capitao
                    </span>
                  ) : null}
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${getRegistrationPlayerStatusTone(
                      status,
                    )}`}
                  >
                    {getRegistrationPlayerStatusLabel(status)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                  <span>{player.position || "Sem posicao"}</span>
                  <span>{player.birthDate || "Nascimento nao informado"}</span>
                  <span>{player.document || "Documento nao informado"}</span>
                </div>
              </button>

              <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[360px]">
                <ActionButton
                  disabled={isBusy}
                  icon={Edit3}
                  label="Editar"
                  onClick={() => onEdit?.(player)}
                />
                <ActionButton
                  disabled={isBusy || !player.active || player.captain}
                  icon={isBusy ? Loader2 : ShieldCheck}
                  label="Capitao"
                  onClick={() => onSetCaptain?.(player.id)}
                />
                <ActionButton
                  disabled={isBusy || !player.active}
                  icon={isBusy ? Loader2 : Trash2}
                  label="Excluir"
                  onClick={() => onDelete?.(player.id)}
                />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ActionButton({
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className={`h-4 w-4 ${Icon === Loader2 ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}
