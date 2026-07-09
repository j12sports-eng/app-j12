import { type FormEvent, type ReactNode } from "react";
import { Ban, CheckCircle2, Loader2, Save } from "lucide-react";

import type { Championship, ChampionshipTeam } from "../types/championship.types";

export type ChampionshipRegistrationFormValues = {
  championshipId: string;
  confirm: boolean;
  observations: string;
  teamId: string;
};

type ChampionshipRegistrationFormProps = {
  availableTeams: ChampionshipTeam[];
  championships: Championship[];
  isCancelling?: boolean;
  isSaving?: boolean;
  onCancelRegistration?: () => void;
  onChange: (values: ChampionshipRegistrationFormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  selectedRegistrationId?: string | null;
  values: ChampionshipRegistrationFormValues;
};

export function ChampionshipRegistrationForm({
  availableTeams,
  championships,
  isCancelling = false,
  isSaving = false,
  onCancelRegistration,
  onChange,
  onSubmit,
  selectedRegistrationId,
  values,
}: ChampionshipRegistrationFormProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <div>
        <h3 className="text-lg font-black text-white">Inscrever equipe</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Vincule uma equipe a um campeonato ativo.
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        <Field label="Campeonato">
          <select
            value={values.championshipId}
            onChange={(event) =>
              onChange({ ...values, championshipId: event.target.value, teamId: "" })
            }
            className={fieldClassName}
            required
          >
            <option value="">Selecione</option>
            {championships.map((championship) => (
              <option key={championship.id} value={championship.id}>
                {championship.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Equipe">
          <select
            value={values.teamId}
            onChange={(event) => onChange({ ...values, teamId: event.target.value })}
            className={fieldClassName}
            disabled={!values.championshipId || availableTeams.length === 0}
            required
          >
            <option value="">Selecione</option>
            {availableTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Observacoes">
          <textarea
            value={values.observations}
            onChange={(event) => onChange({ ...values, observations: event.target.value })}
            className={`${fieldClassName} min-h-24 resize-y py-3`}
          />
        </Field>

        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-semibold text-slate-200">
          <input
            type="checkbox"
            checked={values.confirm}
            onChange={(event) => onChange({ ...values, confirm: event.target.checked })}
            className="h-4 w-4 rounded border-white/20 bg-black text-primary focus:ring-primary"
          />
          Confirmar inscricao imediatamente
          <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />
        </label>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <button
            type="submit"
            disabled={isSaving || !values.championshipId || !values.teamId}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Registrar equipe
          </button>

          {selectedRegistrationId && onCancelRegistration ? (
            <button
              type="button"
              disabled={isCancelling}
              onClick={onCancelRegistration}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 text-sm font-black text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCancelling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              Cancelar inscricao
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">{label}</span>
      {children}
    </label>
  );
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60";
