import { ListFilter, Search } from "lucide-react";

export type ChampionshipStatisticsFilterState = {
  pageSize: number;
  search: string;
};

type ChampionshipStatisticsFiltersProps = {
  filters: ChampionshipStatisticsFilterState;
  onChange: (filters: ChampionshipStatisticsFilterState) => void;
};

type PaginationControlsProps = {
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  total: number;
};

export function ChampionshipStatisticsFilters({
  filters,
  onChange,
}: ChampionshipStatisticsFiltersProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-card p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Pesquisa
          </span>
          <span className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={filters.search}
              onChange={(event) =>
                onChange({
                  ...filters,
                  search: event.target.value,
                })
              }
              placeholder="Equipe, atleta ou camisa"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-600"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Itens por pagina
          </span>
          <span className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
            <ListFilter className="h-4 w-4 text-slate-500" />
            <select
              value={filters.pageSize}
              onChange={(event) =>
                onChange({
                  ...filters,
                  pageSize: Number(event.target.value),
                })
              }
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </span>
        </label>
      </div>
    </section>
  );
}

export function ChampionshipStatisticsPagination({
  onPageChange,
  page,
  pageSize,
  total,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t border-white/10 px-3 py-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
      <span>
        {start}-{end} de {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="min-h-9 rounded-xl border border-white/10 bg-white/5 px-3 font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="min-h-9 rounded-xl border border-white/10 bg-white/5 px-3 font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Proxima
        </button>
      </div>
    </div>
  );
}
