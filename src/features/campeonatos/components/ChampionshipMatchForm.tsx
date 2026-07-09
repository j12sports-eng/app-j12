import { type FormEvent, useMemo } from "react";
import { Loader2, Swords } from "lucide-react";

import { CHAMPIONSHIP_MATCH_STATUS_OPTIONS } from "../constants/championship.constants";

import type {
  ChampionshipGroup,
  ChampionshipMatchStatus,
  ChampionshipRound,
} from "../types/championship.types";

export type ChampionshipMatchFormValues = {
  awayRegistrationId: string;
  court: string;
  groupId: string;
  homeRegistrationId: string;
  matchDate: string;
  roundId: string;
  startTime: string;
  status: ChampionshipMatchStatus;
};

type ChampionshipMatchFormProps = {
  groups: ChampionshipGroup[];
  isSaving?: boolean;
  onChange: (values: ChampionshipMatchFormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  rounds: ChampionshipRound[];
  values: ChampionshipMatchFormValues;
};

export function ChampionshipMatchForm({
  groups,
  isSaving = false,
  onChange,
  onSubmit,
  rounds,
  values,
}: ChampionshipMatchFormProps) {
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === values.groupId) || null,
    [groups, values.groupId],
  );
  const registrations = useMemo(
    () =>
      (selectedGroup?.registrations || []).filter(
        (registration) => registration.status === "CONFIRMED" || registration.status === "PENDING",
      ),
    [selectedGroup],
  );

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <div>
        <h3 className="text-lg font-black text-white">Novo jogo</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Agende confrontos entre equipes do mesmo grupo.
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">Rodada</span>
            <select
              value={values.roundId}
              onChange={(event) => onChange({ ...values, roundId: event.target.value })}
              className={fieldClassName}
              required
            >
              <option value="">Selecione</option>
              {rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.name || `Rodada ${round.roundNumber}`}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">Grupo</span>
            <select
              value={values.groupId}
              onChange={(event) =>
                onChange({
                  ...values,
                  awayRegistrationId: "",
                  groupId: event.target.value,
                  homeRegistrationId: "",
                })
              }
              className={fieldClassName}
              required
            >
              <option value="">Selecione</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <RegistrationSelect
            label="Mandante"
            value={values.homeRegistrationId}
            registrations={registrations}
            onChange={(registrationId) =>
              onChange({ ...values, homeRegistrationId: registrationId })
            }
          />
          <RegistrationSelect
            label="Visitante"
            value={values.awayRegistrationId}
            registrations={registrations}
            onChange={(registrationId) =>
              onChange({ ...values, awayRegistrationId: registrationId })
            }
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">Data</span>
            <input
              value={values.matchDate}
              onChange={(event) => onChange({ ...values, matchDate: event.target.value })}
              className={fieldClassName}
              type="date"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">Horario</span>
            <input
              value={values.startTime}
              onChange={(event) => onChange({ ...values, startTime: event.target.value })}
              className={fieldClassName}
              type="time"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">Status</span>
            <select
              value={values.status}
              onChange={(event) =>
                onChange({ ...values, status: event.target.value as ChampionshipMatchStatus })
              }
              className={fieldClassName}
            >
              {CHAMPIONSHIP_MATCH_STATUS_OPTIONS.filter((option) => option.value).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">Quadra</span>
          <input
            value={values.court}
            onChange={(event) => onChange({ ...values, court: event.target.value })}
            className={fieldClassName}
            maxLength={120}
            placeholder="Quadra principal"
          />
        </label>

        <button
          type="submit"
          disabled={
            isSaving ||
            !values.roundId ||
            !values.groupId ||
            !values.homeRegistrationId ||
            !values.awayRegistrationId
          }
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
          Criar jogo
        </button>
      </div>
    </form>
  );
}

function RegistrationSelect({
  label,
  onChange,
  registrations,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  registrations: ChampionshipGroup["registrations"];
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName}
        required
      >
        <option value="">Selecione</option>
        {registrations.map((registration) => (
          <option key={registration.registrationId} value={registration.registrationId}>
            {registration.teamName || registration.teamId || registration.registrationId}
          </option>
        ))}
      </select>
    </label>
  );
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60";
