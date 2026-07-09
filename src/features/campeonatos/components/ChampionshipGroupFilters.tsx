import { ArrowDownUp, Search } from "lucide-react";

import type { ChampionshipGroupFilters as FiltersValue } from "../types/championship.types";

type ChampionshipGroupFiltersProps = {
  filters: FiltersValue;
  onChange: (filters: FiltersValue) => void;
};

export function ChampionshipGroupFilters({ filters, onChange }: ChampionshipGroupFiltersProps) {
  return (
    <section className="grid gap-3 rounded-2xl border border-white/10 bg-card p-4 lg:grid-cols-[minmax(0,1fr)_180px_130px]">
      <label className="relative block">
        <span className="sr-only">Buscar grupo</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={filters.search || ""}
          onChange={(event) => onChange({ ...filters, page: 1, search: event.target.value })}
          placeholder="Pesquisar grupo"
          className={`${fieldClassName} px-10`}
        />
      </label>

      <label className="relative block">
        <span className="sr-only">Ordenacao</span>
        <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <select
          value={filters.sortBy || "displayOrder"}
          onChange={(event) =>
            onChange({
              ...filters,
              page: 1,
              sortBy: event.target.value as FiltersValue["sortBy"],
            })
          }
          className={`${fieldClassName} px-10`}
        >
          <option value="displayOrder">Ordem</option>
          <option value="name">Nome</option>
          <option value="createdAt">Cadastro</option>
        </select>
      </label>

      <label className="block">
        <span className="sr-only">Direcao</span>
        <select
          value={filters.sortDirection || "ASC"}
          onChange={(event) =>
            onChange({
              ...filters,
              page: 1,
              sortDirection: event.target.value as FiltersValue["sortDirection"],
            })
          }
          className={fieldClassName}
        >
          <option value="ASC">Asc</option>
          <option value="DESC">Desc</option>
        </select>
      </label>
    </section>
  );
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15";
