import {
  ArrowRightLeft,
  CalendarClock,
  Edit3,
  FileText,
  Loader2,
  Trash2,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { CHAMPIONSHIP_MATCH_STATUS_OPTIONS } from "../constants/championship.constants";
import {
  formatChampionshipDate,
  getMatchStatusLabel,
  getMatchStatusTone,
  getRoundPhaseLabel,
} from "../utils/championship-formatters";

import type {
  ChampionshipMatch,
  ChampionshipMatchStatus,
  ChampionshipRound,
} from "../types/championship.types";

type ChampionshipRoundListProps = {
  busyMatchId?: string | null;
  busyRoundId?: string | null;
  items: ChampionshipRound[];
  getMatchReportHref?: (match: ChampionshipMatch) => string;
  moveTargets: Record<string, string>;
  onDeleteMatch?: (matchId: string) => void;
  onDeleteRound?: (roundId: string) => void;
  onEditRound?: (round: ChampionshipRound) => void;
  onMoveMatch?: (input: { matchId: string; targetRoundId: string }) => void;
  onMoveTargetChange?: (matchId: string, targetRoundId: string) => void;
  onStatusChange?: (matchId: string, status: ChampionshipMatchStatus) => void;
};

export function ChampionshipRoundList({
  busyMatchId,
  busyRoundId,
  getMatchReportHref,
  items,
  moveTargets,
  onDeleteMatch,
  onDeleteRound,
  onEditRound,
  onMoveMatch,
  onMoveTargetChange,
  onStatusChange,
}: ChampionshipRoundListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
        <CalendarClock className="mx-auto h-8 w-8 text-slate-500" />
        <p className="mt-3 text-sm font-black text-white">Nenhuma rodada encontrada</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Crie rodadas ou gere jogos a partir dos grupos cadastrados.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {items.map((round) => {
        const isBusy = busyRoundId === round.id;
        const orderedMatches = round.matches
          .slice()
          .sort(
            (left, right) =>
              String(left.groupName || "").localeCompare(String(right.groupName || "")) ||
              String(left.matchDate || "").localeCompare(String(right.matchDate || "")) ||
              String(left.startTime || "").localeCompare(String(right.startTime || "")),
          );

        return (
          <article
            key={round.id}
            className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-2 text-sm font-black text-primary">
                    {round.roundNumber}
                  </span>
                  <h3 className="truncate text-base font-black text-white">
                    {round.name || `Rodada ${round.roundNumber}`}
                  </h3>
                  <span className="inline-flex rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                    {getRoundPhaseLabel(round.phase)}
                  </span>
                  <span className="inline-flex rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                    {round.matches.length} jogo(s)
                  </span>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <ActionButton
                  disabled={isBusy}
                  icon={Edit3}
                  label="Editar"
                  onClick={() => onEditRound?.(round)}
                />
                <ActionButton
                  disabled={isBusy || round.matches.length > 0}
                  icon={isBusy ? Loader2 : Trash2}
                  label="Remover"
                  onClick={() => onDeleteRound?.(round.id)}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {orderedMatches.length > 0 ? (
                orderedMatches.map((match) => (
                  <MatchRow
                    key={match.id}
                    busyMatchId={busyMatchId}
                    match={match}
                    matchReportHref={getMatchReportHref?.(match)}
                    moveTargets={moveTargets}
                    rounds={items}
                    onDeleteMatch={onDeleteMatch}
                    onMoveMatch={onMoveMatch}
                    onMoveTargetChange={onMoveTargetChange}
                    onStatusChange={onStatusChange}
                  />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
                  Rodada sem jogos cadastrados.
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MatchRow({
  busyMatchId,
  match,
  matchReportHref,
  moveTargets,
  onDeleteMatch,
  onMoveMatch,
  onMoveTargetChange,
  onStatusChange,
  rounds,
}: {
  busyMatchId?: string | null;
  match: ChampionshipMatch;
  matchReportHref?: string;
  moveTargets: Record<string, string>;
  onDeleteMatch?: (matchId: string) => void;
  onMoveMatch?: (input: { matchId: string; targetRoundId: string }) => void;
  onMoveTargetChange?: (matchId: string, targetRoundId: string) => void;
  onStatusChange?: (matchId: string, status: ChampionshipMatchStatus) => void;
  rounds: ChampionshipRound[];
}) {
  const isBusy = busyMatchId === match.id;
  const targetRoundId = moveTargets[match.id] || "";

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <p className="truncate text-sm font-black text-white">
              {match.homeTeamName || match.homeRegistrationId} x{" "}
              {match.awayTeamName || match.awayRegistrationId}
            </p>
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${getMatchStatusTone(
                match.status,
              )}`}
            >
              {getMatchStatusLabel(match.status)}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {match.groupName || "Grupo"} - {formatChampionshipDate(match.matchDate)} -{" "}
            {match.startTime || "sem horario"} - {match.court || "sem quadra"}
          </p>
        </div>

        <div className="grid gap-2 md:grid-cols-[130px_minmax(0,1fr)_100px_100px_100px] 2xl:min-w-[730px]">
          <select
            value={match.status}
            onChange={(event) =>
              onStatusChange?.(match.id, event.target.value as ChampionshipMatchStatus)
            }
            disabled={isBusy}
            className={fieldClassName}
          >
            {CHAMPIONSHIP_MATCH_STATUS_OPTIONS.filter((option) => option.value).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={targetRoundId}
            onChange={(event) => onMoveTargetChange?.(match.id, event.target.value)}
            disabled={isBusy}
            className={fieldClassName}
          >
            <option value="">Mover para</option>
            {rounds
              .filter((round) => round.id !== match.roundId)
              .map((round) => (
                <option key={round.id} value={round.id}>
                  {round.name || `Rodada ${round.roundNumber}`}
                </option>
              ))}
          </select>

          <ActionButton
            disabled={isBusy || !targetRoundId}
            icon={isBusy ? Loader2 : ArrowRightLeft}
            label="Mover"
            onClick={() => onMoveMatch?.({ matchId: match.id, targetRoundId })}
          />
          {matchReportHref ? (
            <ActionLink disabled={isBusy} href={matchReportHref} icon={FileText} label="Sumula" />
          ) : null}
          <ActionButton
            disabled={isBusy}
            icon={isBusy ? Loader2 : Trash2}
            label="Remover"
            onClick={() => onDeleteMatch?.(match.id)}
          />
        </div>
      </div>
    </div>
  );
}

function ActionLink({
  disabled,
  href,
  icon: Icon,
  label,
}: {
  disabled?: boolean;
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="inline-flex min-h-10 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200 opacity-50">
        <Icon className="h-4 w-4" />
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 text-xs font-black text-primary transition hover:bg-primary/20"
    >
      <Icon className="h-4 w-4" />
      {label}
    </a>
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
