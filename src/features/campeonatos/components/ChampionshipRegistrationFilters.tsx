import { ArrowDownUp, Search } from "lucide-react";

import { CHAMPIONSHIP_REGISTRATION_STATUS_OPTIONS } from "../constants/championship.constants";

import type { ChampionshipRegistrationFilters as FiltersValue } from "../types/championship.types";

type ChampionshipRegistrationFiltersProps = {
  filters: FiltersValue;
  onChange: (filters: FiltersValue) => void;
};

export function ChampionshipRegistrationFilters({
  filters,
  onChange,
}: ChampionshipRegistrationFiltersProps) {
  return (
    <section className="grid gap-3 rounded-2xl border border-white/10 bg-card p-4 md:grid-cols-[minmax(0,1fr)_180px_180px_130px]">
      <label className="relative block">
        <span className="sr-only">Buscar inscricao</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={filters.search || ""}
          onChange={(event) => onChange({ ...filters, page: 1, search: event.target.value })}
          placeholder="Pesquisar equipe"
          className={fieldClassName}
        />
      </label>

      <label className="block">
        <span className="sr-only">Status da inscricao</span>
        <select
          value={filters.status || ""}
          onChange={(event) =>
            onChange({
              ...filters,
              page: 1,
              status: event.target.value as FiltersValue["status"],
            })
          }
          className={fieldClassName}
        >
          {CHAMPIONSHIP_REGISTRATION_STATUS_OPTIONS.map((option) => (
            <option key={option.value || "ALL"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="relative block">
        <span className="sr-only">Ordenacao</span>
        <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <select
          value={filters.sortBy || "createdAt"}
          onChange={(event) =>
            onChange({
              ...filters,
              page: 1,
              sortBy: event.target.value as FiltersValue["sortBy"],
            })
          }
          className={fieldClassName}
        >
          <option value="createdAt">Cadastro</option>
          <option value="teamName">Equipe</option>
          <option value="status">Status</option>
          <option value="updatedAt">Atualizacao</option>
        </select>
      </label>

      <label className="block">
        <span className="sr-only">Direcao</span>
        <select
          value={filters.sortDirection || "DESC"}
          onChange={(event) =>
            onChange({
              ...filters,
              page: 1,
              sortDirection: event.target.value as FiltersValue["sortDirection"],
            })
          }
          className={fieldClassName}
        >
          <option value="DESC">Desc</option>
          <option value="ASC">Asc</option>
        </select>
      </label>
    </section>
  );
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-10 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15";
