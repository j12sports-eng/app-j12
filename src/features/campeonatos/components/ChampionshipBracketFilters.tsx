import { Filter } from "lucide-react";

import { CHAMPIONSHIP_BRACKET_PHASE_OPTIONS } from "../constants/championship.constants";

import type { ChampionshipBracketFilters as BracketFiltersValue } from "../types/championship.types";

type ChampionshipBracketFiltersProps = {
  filters: BracketFiltersValue;
  onChange: (filters: BracketFiltersValue) => void;
};

export function ChampionshipBracketFilters({ filters, onChange }: ChampionshipBracketFiltersProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-white">
            <Filter className="h-5 w-5 text-primary" />
            Filtros do mata-mata
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Filtre a arvore por fase sem alterar o chaveamento salvo.
          </p>
        </div>

        <label className="block w-full sm:max-w-xs">
          <span className="mb-2 block text-sm font-bold text-slate-300">Fase</span>
          <select
            value={filters.phase || ""}
            onChange={(event) =>
              onChange({
                ...filters,
                phase: event.target.value as BracketFiltersValue["phase"],
              })
            }
            className={fieldClassName}
          >
            {CHAMPIONSHIP_BRACKET_PHASE_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15";
