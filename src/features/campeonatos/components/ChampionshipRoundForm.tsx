import { type FormEvent } from "react";
import { CalendarPlus, Loader2, RotateCcw } from "lucide-react";

import { CHAMPIONSHIP_ROUND_PHASE_OPTIONS } from "../constants/championship.constants";

import type { ChampionshipRoundPhase } from "../types/championship.types";

export type ChampionshipRoundFormValues = {
  name: string;
  phase: ChampionshipRoundPhase;
  roundNumber: string;
};

type ChampionshipRoundFormProps = {
  isSaving?: boolean;
  onChange: (values: ChampionshipRoundFormValues) => void;
  onReset?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  selectedRoundId?: string | null;
  values: ChampionshipRoundFormValues;
};

export function ChampionshipRoundForm({
  isSaving = false,
  onChange,
  onReset,
  onSubmit,
  selectedRoundId,
  values,
}: ChampionshipRoundFormProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <div>
        <h3 className="text-lg font-black text-white">
          {selectedRoundId ? "Editar rodada" : "Criar rodada"}
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Cadastre rodadas administrativas para organizar os jogos do campeonato.
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">Nome</span>
          <input
            value={values.name}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
            className={fieldClassName}
            maxLength={80}
            placeholder="Rodada 1"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">Numero</span>
            <input
              value={values.roundNumber}
              onChange={(event) => onChange({ ...values, roundNumber: event.target.value })}
              className={fieldClassName}
              inputMode="numeric"
              min={1}
              placeholder="Automatico"
              type="number"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">Fase</span>
            <select
              value={values.phase}
              onChange={(event) =>
                onChange({ ...values, phase: event.target.value as ChampionshipRoundPhase })
              }
              className={fieldClassName}
            >
              {CHAMPIONSHIP_ROUND_PHASE_OPTIONS.filter((option) => option.value).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="h-4 w-4" />
            )}
            {selectedRoundId ? "Salvar rodada" : "Criar rodada"}
          </button>
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
              Limpar
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60";
