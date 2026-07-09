import { type FormEvent, useState } from "react";
import { RefreshCw, Wand2 } from "lucide-react";

import {
  CHAMPIONSHIP_BRACKET_INITIAL_PHASE_OPTIONS,
  CHAMPIONSHIP_BRACKET_MODE_OPTIONS,
} from "../constants/championship.constants";

import type {
  ChampionshipBracketMode,
  ChampionshipBracketPhase,
  ChampionshipGenerateBracketPayload,
} from "../types/championship.types";

type ChampionshipGenerateBracketDialogProps = {
  isGenerating: boolean;
  onGenerate: (payload: ChampionshipGenerateBracketPayload) => void;
};

export function ChampionshipGenerateBracketDialog({
  isGenerating,
  onGenerate,
}: ChampionshipGenerateBracketDialogProps) {
  const [mode, setMode] = useState<ChampionshipBracketMode>("AUTOMATIC");
  const [initialPhase, setInitialPhase] = useState<ChampionshipBracketPhase>("SEMI_FINAL");
  const [includeThirdPlace, setIncludeThirdPlace] = useState(false);
  const [replace, setReplace] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedPhase = CHAMPIONSHIP_BRACKET_INITIAL_PHASE_OPTIONS.find(
      (option) => option.value === initialPhase,
    );

    onGenerate({
      includeThirdPlace,
      initialPhase,
      mode,
      replace,
      teamCount: selectedPhase?.teamCount || 4,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <div>
        <h3 className="text-lg font-black text-white">Gerar mata-mata</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Use a classificacao para gerar automaticamente ou crie uma arvore manual com placeholders.
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">Modo</span>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as ChampionshipBracketMode)}
            className={fieldClassName}
          >
            {CHAMPIONSHIP_BRACKET_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">Fase inicial</span>
          <select
            value={initialPhase}
            onChange={(event) => setInitialPhase(event.target.value as ChampionshipBracketPhase)}
            className={fieldClassName}
          >
            {CHAMPIONSHIP_BRACKET_INITIAL_PHASE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.teamCount} equipes
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-semibold text-slate-200">
          <input
            type="checkbox"
            checked={includeThirdPlace}
            onChange={(event) => setIncludeThirdPlace(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-black text-primary focus:ring-primary"
          />
          Disputa de terceiro lugar
        </label>

        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-semibold text-slate-200">
          <input
            type="checkbox"
            checked={replace}
            onChange={(event) => setReplace(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-black text-primary focus:ring-primary"
          />
          Substituir chaveamento existente
        </label>

        <button
          type="submit"
          disabled={isGenerating}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          Gerar chaveamento
        </button>
      </div>
    </form>
  );
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15";
