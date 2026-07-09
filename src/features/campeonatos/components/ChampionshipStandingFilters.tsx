import { ListFilter } from "lucide-react";

import {
  CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS,
  CHAMPIONSHIP_STANDING_TIE_BREAKER_OPTIONS,
} from "../constants/championship.constants";

import type {
  ChampionshipGroup,
  ChampionshipStandingFilters as ChampionshipStandingFiltersValue,
  ChampionshipStandingTieBreaker,
} from "../types/championship.types";

type ChampionshipStandingFiltersProps = {
  filters: ChampionshipStandingFiltersValue;
  groups: ChampionshipGroup[];
  onChange: (filters: ChampionshipStandingFiltersValue) => void;
};

export function ChampionshipStandingFilters({
  filters,
  groups,
  onChange,
}: ChampionshipStandingFiltersProps) {
  const selectedCriteria = filters.criteria?.length
    ? filters.criteria
    : CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS;

  function handleCriterionChange(value: ChampionshipStandingTieBreaker, checked: boolean) {
    const selected = new Set(selectedCriteria);

    if (checked) {
      selected.add(value);
    } else {
      selected.delete(value);
    }

    const nextCriteria = CHAMPIONSHIP_STANDING_TIE_BREAKER_OPTIONS.map(
      (option) => option.value,
    ).filter((optionValue) => selected.has(optionValue));

    onChange({
      ...filters,
      criteria: nextCriteria.length > 0 ? nextCriteria : CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS,
      page: 1,
    });
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-card p-4">
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_140px]">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Grupo
          </span>
          <select
            value={filters.groupId || ""}
            onChange={(event) =>
              onChange({
                ...filters,
                groupId: event.target.value,
                page: 1,
              })
            }
            className={fieldClassName}
          >
            <option value="">Classificacao geral</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Criterios de desempate
          </span>
          <div className="flex flex-wrap gap-2">
            {CHAMPIONSHIP_STANDING_TIE_BREAKER_OPTIONS.map((option) => {
              const checked = selectedCriteria.includes(option.value);

              return (
                <label
                  key={option.value}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-xs font-black transition ${
                    checked
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-white/10 bg-black/30 text-slate-400 hover:bg-white/5"
                  }`}
                >
                  <input
                    checked={checked}
                    onChange={(event) => handleCriterionChange(option.value, event.target.checked)}
                    type="checkbox"
                    className="h-4 w-4 rounded border-white/20 bg-black text-primary focus:ring-primary"
                  />
                  {option.shortLabel}
                </label>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Limite
          </span>
          <span className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
            <ListFilter className="h-4 w-4 text-slate-500" />
            <select
              value={filters.limit || 100}
              onChange={(event) =>
                onChange({
                  ...filters,
                  limit: Number(event.target.value),
                  page: 1,
                })
              }
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </span>
        </label>
      </div>
    </section>
  );
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15";
