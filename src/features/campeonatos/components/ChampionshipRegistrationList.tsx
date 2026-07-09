import {
  Ban,
  CheckCircle2,
  Clock3,
  Loader2,
  UsersRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import {
  getRegistrationStatusLabel,
  getRegistrationStatusTone,
} from "../utils/championship-formatters";

import type {
  ChampionshipRegistration,
  ChampionshipRegistrationStatus,
} from "../types/championship.types";

type ChampionshipRegistrationListProps = {
  busyRegistrationId?: string | null;
  getPlayersHref?: (registration: ChampionshipRegistration) => string;
  items: ChampionshipRegistration[];
  onCancel?: (registrationId: string) => void;
  onSelect?: (registration: ChampionshipRegistration) => void;
  onStatusChange?: (registrationId: string, status: ChampionshipRegistrationStatus) => void;
  selectedRegistrationId?: string | null;
};

export function ChampionshipRegistrationList({
  busyRegistrationId,
  getPlayersHref,
  items,
  onCancel,
  onSelect,
  onStatusChange,
  selectedRegistrationId,
}: ChampionshipRegistrationListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
        <Clock3 className="mx-auto h-8 w-8 text-slate-500" />
        <p className="mt-3 text-sm font-black text-white">Nenhuma inscricao encontrada</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          As equipes inscritas aparecem aqui apos o registro.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((registration) => {
        const isBusy = busyRegistrationId === registration.id;
        const isSelected = selectedRegistrationId === registration.id;

        return (
          <article
            key={registration.id}
            className={`rounded-2xl border p-4 transition ${
              isSelected
                ? "border-primary/50 bg-primary/10"
                : "border-white/10 bg-black/20 hover:border-white/20"
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <button
                type="button"
                onClick={() => onSelect?.(registration)}
                className="min-w-0 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-black text-white">
                    {registration.teamName || registration.teamId}
                  </h3>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${getRegistrationStatusTone(
                      registration.status,
                    )}`}
                  >
                    {getRegistrationStatusLabel(registration.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  {registration.category || "-"} - {registration.modality || "-"}
                </p>
                {registration.observations ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                    {registration.observations}
                  </p>
                ) : null}
              </button>

              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[540px] lg:grid-cols-5">
                {getPlayersHref ? (
                  <a
                    href={getPlayersHref(registration)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-black text-primary transition hover:bg-primary/20"
                  >
                    <UsersRound className="h-4 w-4" />
                    Elenco
                  </a>
                ) : null}
                <StatusButton
                  disabled={isBusy}
                  icon={Clock3}
                  label="Pendente"
                  onClick={() => onStatusChange?.(registration.id, "PENDING")}
                />
                <StatusButton
                  disabled={isBusy}
                  icon={CheckCircle2}
                  label="Confirmar"
                  onClick={() => onStatusChange?.(registration.id, "CONFIRMED")}
                />
                <StatusButton
                  disabled={isBusy}
                  icon={XCircle}
                  label="Recusar"
                  onClick={() => onStatusChange?.(registration.id, "REFUSED")}
                />
                <StatusButton
                  disabled={isBusy || registration.status === "CANCELLED"}
                  icon={isBusy ? Loader2 : Ban}
                  label="Cancelar"
                  onClick={() => onCancel?.(registration.id)}
                />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function StatusButton({
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
