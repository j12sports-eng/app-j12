import {
  ArrowRightLeft,
  Edit3,
  Loader2,
  Shield,
  Trash2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import {
  getRegistrationStatusLabel,
  getRegistrationStatusTone,
} from "../utils/championship-formatters";

import type { ChampionshipGroup, ChampionshipGroupRegistration } from "../types/championship.types";

type ChampionshipGroupListProps = {
  busyGroupId?: string | null;
  busyRegistrationKey?: string | null;
  items: ChampionshipGroup[];
  moveTargets: Record<string, string>;
  onDelete?: (groupId: string) => void;
  onEdit?: (group: ChampionshipGroup) => void;
  onMoveRegistration?: (input: {
    groupId: string;
    registrationId: string;
    targetGroupId: string;
  }) => void;
  onMoveTargetChange?: (registrationId: string, targetGroupId: string) => void;
  onRemoveRegistration?: (groupId: string, registrationId: string) => void;
};

export function ChampionshipGroupList({
  busyGroupId,
  busyRegistrationKey,
  items,
  moveTargets,
  onDelete,
  onEdit,
  onMoveRegistration,
  onMoveTargetChange,
  onRemoveRegistration,
}: ChampionshipGroupListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
        <UsersRound className="mx-auto h-8 w-8 text-slate-500" />
        <p className="mt-3 text-sm font-black text-white">Nenhum grupo encontrado</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Crie grupos ou use o sorteio para distribuir equipes inscritas.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {items.map((group) => {
        const isBusy = busyGroupId === group.id;
        const orderedRegistrations = group.registrations
          .slice()
          .sort(
            (left, right) =>
              left.drawPosition - right.drawPosition ||
              String(left.teamName || "").localeCompare(String(right.teamName || "")),
          );

        return (
          <article
            key={group.id}
            className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-2 text-sm font-black text-primary">
                    {group.displayOrder}
                  </span>
                  <h3 className="truncate text-base font-black text-white">{group.name}</h3>
                  <span className="inline-flex rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                    {group.registrations.length} equipe(s)
                  </span>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <ActionButton
                  disabled={isBusy}
                  icon={Edit3}
                  label="Editar"
                  onClick={() => onEdit?.(group)}
                />
                <ActionButton
                  disabled={isBusy || group.registrations.length > 0}
                  icon={isBusy ? Loader2 : Trash2}
                  label="Remover"
                  onClick={() => onDelete?.(group.id)}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {orderedRegistrations.length > 0 ? (
                orderedRegistrations.map((registration) => (
                  <GroupRegistrationRow
                    key={registration.registrationId}
                    busyRegistrationKey={busyRegistrationKey}
                    group={group}
                    groups={items}
                    moveTargets={moveTargets}
                    registration={registration}
                    onMoveRegistration={onMoveRegistration}
                    onMoveTargetChange={onMoveTargetChange}
                    onRemoveRegistration={onRemoveRegistration}
                  />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
                  Grupo sem equipes vinculadas.
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function GroupRegistrationRow({
  busyRegistrationKey,
  group,
  groups,
  moveTargets,
  onMoveRegistration,
  onMoveTargetChange,
  onRemoveRegistration,
  registration,
}: {
  busyRegistrationKey?: string | null;
  group: ChampionshipGroup;
  groups: ChampionshipGroup[];
  moveTargets: Record<string, string>;
  onMoveRegistration?: (input: {
    groupId: string;
    registrationId: string;
    targetGroupId: string;
  }) => void;
  onMoveTargetChange?: (registrationId: string, targetGroupId: string) => void;
  onRemoveRegistration?: (groupId: string, registrationId: string) => void;
  registration: ChampionshipGroupRegistration;
}) {
  const rowKey = `${group.id}:${registration.registrationId}`;
  const isBusy = busyRegistrationKey === rowKey;
  const targetGroupId = moveTargets[registration.registrationId] || "";

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <p className="truncate text-sm font-black text-white">
              {registration.teamName || registration.teamId || registration.registrationId}
            </p>
            {registration.status ? (
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${getRegistrationStatusTone(
                  registration.status,
                )}`}
              >
                {getRegistrationStatusLabel(registration.status)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Posicao {registration.drawPosition || "-"} - {registration.teamAcronym || "sem sigla"}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_120px] xl:min-w-[460px]">
          <select
            value={targetGroupId}
            onChange={(event) =>
              onMoveTargetChange?.(registration.registrationId, event.target.value)
            }
            disabled={isBusy}
            className={fieldClassName}
          >
            <option value="">Mover para</option>
            {groups
              .filter((item) => item.id !== group.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
          <ActionButton
            disabled={isBusy || !targetGroupId}
            icon={isBusy ? Loader2 : ArrowRightLeft}
            label="Mover"
            onClick={() =>
              onMoveRegistration?.({
                groupId: group.id,
                registrationId: registration.registrationId,
                targetGroupId,
              })
            }
          />
          <ActionButton
            disabled={isBusy}
            icon={isBusy ? Loader2 : Trash2}
            label="Retirar"
            onClick={() => onRemoveRegistration?.(group.id, registration.registrationId)}
          />
        </div>
      </div>
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

const fieldClassName =
  "min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-xs font-semibold text-white outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60";
