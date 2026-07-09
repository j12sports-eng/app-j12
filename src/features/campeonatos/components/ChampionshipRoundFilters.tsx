import { Search } from "lucide-react";

import { CHAMPIONSHIP_ROUND_PHASE_OPTIONS } from "../constants/championship.constants";

import type { ChampionshipRoundFilters as ChampionshipRoundFiltersValue } from "../types/championship.types";

type ChampionshipRoundFiltersProps = {
  filters: ChampionshipRoundFiltersValue;
  onChange: (filters: ChampionshipRoundFiltersValue) => void;
};

export function ChampionshipRoundFilters({ filters, onChange }: ChampionshipRoundFiltersProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-card p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_160px_140px]">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Pesquisar rodada
          </span>
          <span className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={filters.search || ""}
              onChange={(event) => onChange({ ...filters, page: 1, search: event.target.value })}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-600"
              placeholder="Nome ou numero"
              type="search"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Fase
          </span>
          <select
            value={filters.phase || ""}
            onChange={(event) =>
              onChange({
                ...filters,
                page: 1,
                phase: event.target.value as ChampionshipRoundFiltersValue["phase"],
              })
            }
            className={fieldClassName}
          >
            {CHAMPIONSHIP_ROUND_PHASE_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Ordenar por
          </span>
          <select
            value={filters.sortBy || "roundNumber"}
            onChange={(event) =>
              onChange({
                ...filters,
                sortBy: event.target.value as ChampionshipRoundFiltersValue["sortBy"],
              })
            }
            className={fieldClassName}
          >
            <option value="roundNumber">Numero</option>
            <option value="name">Nome</option>
            <option value="createdAt">Criacao</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Direcao
          </span>
          <select
            value={filters.sortDirection || "ASC"}
            onChange={(event) =>
              onChange({
                ...filters,
                sortDirection: event.target.value as ChampionshipRoundFiltersValue["sortDirection"],
              })
            }
            className={fieldClassName}
          >
            <option value="ASC">Crescente</option>
            <option value="DESC">Decrescente</option>
          </select>
        </label>
      </div>
    </section>
  );
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15";
