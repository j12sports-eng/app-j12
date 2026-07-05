import { Search } from "lucide-react";

import { CHAMPIONSHIP_STATUS_OPTIONS } from "../constants/championship.constants";

import type { ChampionshipFilters as ChampionshipFiltersValue } from "../types/championship.types";

type ChampionshipFiltersProps = {
  filters: ChampionshipFiltersValue;
  onChange: (filters: ChampionshipFiltersValue) => void;
};

export function ChampionshipFilters({ filters, onChange }: ChampionshipFiltersProps) {
  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-card p-3 md:grid-cols-[minmax(220px,1fr)_180px]">
      <label className="relative block">
        <span className="sr-only">Buscar campeonato</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={filters.search || ""}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Buscar por nome, categoria ou modalidade"
          className={fieldClassName("pl-9")}
        />
      </label>

      <label>
        <span className="sr-only">Status do campeonato</span>
        <select
          value={filters.status || ""}
          onChange={(event) =>
            onChange({
              ...filters,
              status: event.target.value as ChampionshipFiltersValue["status"],
            })
          }
          className={fieldClassName()}
        >
          {CHAMPIONSHIP_STATUS_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function fieldClassName(extra = "") {
  return `min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 ${extra}`;
}
