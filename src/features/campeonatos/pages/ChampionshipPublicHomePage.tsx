import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  FilterX,
  ListFilter,
  RefreshCw,
  Search,
  ShieldCheck,
  Trophy,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { formatApiErrorMessage } from "@/lib/api";

import { ChampionshipPublicCard, ChampionshipPublicLayout } from "../components";
import { usePublicChampionships } from "../hooks/usePublicChampionships";

import type { PublicChampionshipListFilters } from "../types/championship-public.types";

type PublicHomeFilters = {
  category: string;
  modality: string;
  search: string;
};

const DEFAULT_FILTERS: PublicHomeFilters = {
  category: "",
  modality: "",
  search: "",
};

function ChampionshipPublicHomeContent() {
  const [filters, setFilters] = useState<PublicHomeFilters>(DEFAULT_FILTERS);

  const queryFilters = useMemo<PublicChampionshipListFilters>(
    () => ({
      category: filters.category.trim(),
      limit: 100,
      modality: filters.modality.trim(),
      search: filters.search.trim(),
      sortBy: "publishedAt",
      sortDirection: "DESC",
    }),
    [filters.category, filters.modality, filters.search],
  );

  const championshipsQuery = usePublicChampionships(queryFilters);
  const championships = championshipsQuery.data?.items || [];
  const total = championshipsQuery.data?.total ?? championships.length;
  const categories = new Set(championships.map((item) => item.category).filter(Boolean)).size;
  const modalities = new Set(championships.map((item) => item.modality).filter(Boolean)).size;
  const hasActiveFilters = Boolean(filters.category || filters.modality || filters.search);
  const errorMessage = championshipsQuery.error
    ? formatApiErrorMessage(
        championshipsQuery.error,
        "Nao foi possivel carregar campeonatos publicados.",
      )
    : "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(255,69,0,0.18),rgba(17,17,20,0.98))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex min-h-8 items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 text-xs font-black uppercase tracking-[0.18em] text-primary">
              <ShieldCheck className="h-4 w-4" />
              Portal publico
            </div>
            <h1 className="mt-4 text-3xl font-black leading-tight text-white md:text-5xl">
              Campeonatos J12
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Acompanhe campeonatos publicados, jogos, classificacao, mata-mata, estatisticas e
              artilharia sem acessar a area restrita.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[560px]">
            <PublicMetric icon={Trophy} label="Publicados" value={total} />
            <PublicMetric icon={UsersRound} label="Na tela" value={championships.length} />
            <PublicMetric icon={ListFilter} label="Categorias" value={categories} />
            <PublicMetric icon={CalendarDays} label="Modalidades" value={modalities} />
          </div>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-white/10 bg-[#111114] p-4"
        aria-label="Filtros de campeonatos publicos"
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Buscar
            </span>
            <span className="flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3">
              <Search className="h-4 w-4 shrink-0 text-primary" />
              <input
                type="search"
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, search: event.target.value }))
                }
                placeholder="Nome do campeonato"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-600"
              />
            </span>
          </label>

          <PublicTextFilter
            label="Categoria"
            placeholder="Ex: Sub-13"
            value={filters.category}
            onChange={(value) => setFilters((current) => ({ ...current, category: value }))}
          />

          <PublicTextFilter
            label="Modalidade"
            placeholder="Ex: Futebol"
            value={filters.modality}
            onChange={(value) => setFilters((current) => ({ ...current, modality: value }))}
          />

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => void championshipsQuery.refetch()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary px-4 text-sm font-black text-black transition hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-slate-300 transition hover:bg-white/10"
                aria-label="Limpar filtros"
              >
                <FilterX className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </form>

      {errorMessage ? <PublicErrorMessage message={errorMessage} /> : null}

      {championshipsQuery.isLoading && championships.length === 0 ? (
        <PublicChampionshipSkeleton />
      ) : championships.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {championships.map((championship) => (
            <ChampionshipPublicCard key={championship.id} championship={championship} />
          ))}
        </section>
      ) : (
        <PublicEmptyState hasActiveFilters={hasActiveFilters} onReset={resetFilters} />
      )}
    </div>
  );
}

function PublicTextFilter({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/50"
      />
    </label>
  );
}

function PublicMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-black/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 truncate text-xl font-black text-white">{value}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-primary" />
      </div>
    </article>
  );
}

function PublicErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-bold">Falha ao carregar campeonatos.</p>
        <p className="mt-1 text-red-100/80">{message}</p>
      </div>
    </div>
  );
}

function PublicChampionshipSkeleton() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-72 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
        />
      ))}
    </section>
  );
}

function PublicEmptyState({
  hasActiveFilters,
  onReset,
}: {
  hasActiveFilters: boolean;
  onReset: () => void;
}) {
  return (
    <section className="rounded-lg border border-dashed border-white/15 bg-[#111114] p-8 text-center">
      <Trophy className="mx-auto h-9 w-9 text-primary" />
      <h2 className="mt-3 text-lg font-black text-white">Nenhum campeonato publicado</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {hasActiveFilters
          ? "Os filtros atuais nao retornaram campeonatos publicados."
          : "Assim que a J12 publicar um campeonato, ele aparecera aqui."}
      </p>
      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary px-4 text-sm font-black text-black transition hover:bg-primary/90"
        >
          <FilterX className="h-4 w-4" />
          Limpar filtros
        </button>
      ) : null}
    </section>
  );
}

export function ChampionshipPublicHomePage() {
  return (
    <ChampionshipPublicLayout
      title="Portal de Campeonatos"
      subtitle="Consulta publica somente leitura dos campeonatos publicados pela J12."
    >
      <ChampionshipPublicHomeContent />
    </ChampionshipPublicLayout>
  );
}

export { ChampionshipPublicHomeContent };
