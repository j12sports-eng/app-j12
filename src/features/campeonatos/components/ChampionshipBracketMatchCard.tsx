import { type FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Save, Swords } from "lucide-react";

import { CHAMPIONSHIP_MATCH_STATUS_LABELS } from "../constants/championship.constants";

import type {
  ChampionshipBracketMatch,
  ChampionshipBracketMatchUpdatePayload,
  ChampionshipMatchStatus,
  ChampionshipStanding,
} from "../types/championship.types";

type ChampionshipBracketMatchCardProps = {
  isBusy?: boolean;
  match: ChampionshipBracketMatch;
  onAdvance: (match: ChampionshipBracketMatch) => void;
  onUpdate: (matchId: string, payload: ChampionshipBracketMatchUpdatePayload) => void;
  teamOptions: ChampionshipStanding[];
};

export function ChampionshipBracketMatchCard({
  isBusy = false,
  match,
  onAdvance,
  onUpdate,
  teamOptions,
}: ChampionshipBracketMatchCardProps) {
  const [values, setValues] = useState(() => toFormValues(match));
  const hasStarted = isMatchStarted(match);
  const canAdvance = Boolean(match.homeRegistrationId && match.awayRegistrationId);
  const winnerName = useMemo(() => resolveWinnerName(match), [match]);

  useEffect(() => {
    setValues(toFormValues(match));
  }, [match]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onUpdate(match.id, {
      awayRegistrationId: values.awayRegistrationId || null,
      awayScore: parseOptionalScore(values.awayScore),
      court: values.court.trim() || null,
      homeRegistrationId: values.homeRegistrationId || null,
      homeScore: parseOptionalScore(values.homeScore),
      matchDate: values.matchDate || null,
      startTime: values.startTime || null,
      status: values.status,
      winnerRegistrationId: values.winnerRegistrationId || null,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.25)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Jogo {match.displayOrder}
          </p>
          <h4 className="mt-1 flex items-center gap-2 text-sm font-black text-white">
            <Swords className="h-4 w-4 text-primary" />
            {formatTeam(match.homeTeamName, match.homeRegistrationId)} x{" "}
            {formatTeam(match.awayTeamName, match.awayRegistrationId)}
          </h4>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-black text-slate-300">
          {CHAMPIONSHIP_MATCH_STATUS_LABELS[match.status]}
        </span>
      </div>

      {winnerName ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-100">
          <CheckCircle2 className="h-4 w-4" />
          Vencedor: {winnerName}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        <TeamSelect
          disabled={hasStarted || isBusy}
          label="Mandante"
          options={teamOptions}
          value={values.homeRegistrationId}
          onChange={(homeRegistrationId) =>
            setValues((current) => ({ ...current, homeRegistrationId }))
          }
        />
        <TeamSelect
          disabled={hasStarted || isBusy}
          label="Visitante"
          options={teamOptions}
          value={values.awayRegistrationId}
          onChange={(awayRegistrationId) =>
            setValues((current) => ({ ...current, awayRegistrationId }))
          }
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-400">Gols mandante</span>
            <input
              value={values.homeScore}
              onChange={(event) =>
                setValues((current) => ({ ...current, homeScore: event.target.value }))
              }
              className={fieldClassName}
              inputMode="numeric"
              min={0}
              type="number"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-400">Gols visitante</span>
            <input
              value={values.awayScore}
              onChange={(event) =>
                setValues((current) => ({ ...current, awayScore: event.target.value }))
              }
              className={fieldClassName}
              inputMode="numeric"
              min={0}
              type="number"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-bold text-slate-400">Vencedor</span>
          <select
            value={values.winnerRegistrationId}
            onChange={(event) =>
              setValues((current) => ({ ...current, winnerRegistrationId: event.target.value }))
            }
            className={fieldClassName}
          >
            <option value="">Automatico pelo placar</option>
            {[
              [match.homeRegistrationId, formatTeam(match.homeTeamName, match.homeRegistrationId)],
              [match.awayRegistrationId, formatTeam(match.awayTeamName, match.awayRegistrationId)],
            ]
              .filter(([registrationId]) => Boolean(registrationId))
              .map(([registrationId, label]) => (
                <option key={registrationId || ""} value={registrationId || ""}>
                  {label}
                </option>
              ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-400">Data</span>
            <input
              value={values.matchDate}
              onChange={(event) =>
                setValues((current) => ({ ...current, matchDate: event.target.value }))
              }
              className={fieldClassName}
              type="date"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-400">Hora</span>
            <input
              value={values.startTime}
              onChange={(event) =>
                setValues((current) => ({ ...current, startTime: event.target.value }))
              }
              className={fieldClassName}
              type="time"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-400">Status</span>
            <select
              value={values.status}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  status: event.target.value as ChampionshipMatchStatus,
                }))
              }
              className={fieldClassName}
            >
              {Object.entries(CHAMPIONSHIP_MATCH_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-bold text-slate-400">Quadra</span>
          <input
            value={values.court}
            onChange={(event) =>
              setValues((current) => ({ ...current, court: event.target.value }))
            }
            className={fieldClassName}
            placeholder="Quadra"
            type="text"
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="submit"
            disabled={isBusy}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </button>
          <button
            type="button"
            disabled={isBusy || !canAdvance}
            onClick={() => onAdvance(match)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            Avancar vencedor
          </button>
        </div>
      </div>
    </form>
  );
}

function TeamSelect({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  options: ChampionshipStanding[];
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName}
        disabled={disabled}
      >
        <option value="">A definir</option>
        {options.map((option) => (
          <option key={option.registrationId} value={option.registrationId}>
            {option.teamName || option.registrationId}
          </option>
        ))}
      </select>
    </label>
  );
}

function toFormValues(match: ChampionshipBracketMatch) {
  return {
    awayRegistrationId: match.awayRegistrationId || "",
    awayScore: match.awayScore === null ? "" : String(match.awayScore),
    court: match.court || "",
    homeRegistrationId: match.homeRegistrationId || "",
    homeScore: match.homeScore === null ? "" : String(match.homeScore),
    matchDate: match.matchDate || "",
    startTime: match.startTime || "",
    status: match.status,
    winnerRegistrationId: match.winnerRegistrationId || "",
  };
}

function parseOptionalScore(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() ? Math.max(Math.trunc(parsed), 0) : null;
}

function isMatchStarted(match: ChampionshipBracketMatch) {
  return (
    match.status !== "SCHEDULED" ||
    match.homeScore !== null ||
    match.awayScore !== null ||
    Boolean(match.winnerRegistrationId)
  );
}

function resolveWinnerName(match: ChampionshipBracketMatch) {
  if (!match.winnerRegistrationId) return "";
  if (match.winnerRegistrationId === match.homeRegistrationId) {
    return formatTeam(match.homeTeamName, match.homeRegistrationId);
  }
  if (match.winnerRegistrationId === match.awayRegistrationId) {
    return formatTeam(match.awayTeamName, match.awayRegistrationId);
  }
  return match.winnerRegistrationId;
}

function formatTeam(name?: string | null, fallback?: string | null) {
  return name || fallback || "A definir";
}

const fieldClassName =
  "min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60";
