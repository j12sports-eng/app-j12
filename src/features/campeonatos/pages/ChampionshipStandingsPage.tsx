import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Network,
  RefreshCw,
  Swords,
  Trophy,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { formatApiErrorMessage } from "@/lib/api";

import {
  ChampionshipStandingFilters,
  ChampionshipStandingTable,
  type ChampionshipStandingViewMode,
} from "../components";
import { CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS } from "../constants/championship.constants";
import { useChampionshipGroups } from "../hooks/useChampionshipGroups";
import { useChampionship } from "../hooks/useChampionships";
import {
  useChampionshipStandings,
  useRecalculateChampionshipStandings,
} from "../hooks/useChampionshipStandings";
import { formatChampionshipDateTime } from "../utils/championship-formatters";

import type { ChampionshipStandingFilters as StandingFiltersValue } from "../types/championship.types";

const STANDING_PAGE_SIZE = 100;

type ChampionshipStandingsPageProps = {
  championshipId: string;
};

function ChampionshipStandingsContent({ championshipId }: ChampionshipStandingsPageProps) {
  const [filters, setFilters] = useState<StandingFiltersValue>({
    criteria: CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS,
    groupId: "",
    limit: STANDING_PAGE_SIZE,
    page: 1,
  });
  const [viewMode, setViewMode] = useState<ChampionshipStandingViewMode>("overall");

  const queryFilters = useMemo(
    () => ({
      criteria: filters.criteria?.length
        ? filters.criteria
        : CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS,
      groupId: filters.groupId || "",
      limit: filters.limit || STANDING_PAGE_SIZE,
      page: filters.page || 1,
    }),
    [filters.criteria, filters.groupId, filters.limit, filters.page],
  );
  const championshipQuery = useChampionship(championshipId);
  const groupsQuery = useChampionshipGroups(championshipId, {
    limit: STANDING_PAGE_SIZE,
    page: 1,
    search: "",
    sortBy: "displayOrder",
    sortDirection: "ASC",
  });
  const standingsQuery = useChampionshipStandings(championshipId, queryFilters);
  const recalculateMutation = useRecalculateChampionshipStandings();

  const championship = championshipQuery.data || null;
  const groups = useMemo(() => groupsQuery.data?.items || [], [groupsQuery.data?.items]);
  const standings = standingsQuery.data?.items || [];
  const standingGroups = standingsQuery.data?.groups || [];
  const criteria = standingsQuery.data?.criteria?.length
    ? standingsQuery.data.criteria
    : queryFilters.criteria;
  const groupedTeamTotal = groups.reduce((total, group) => total + group.registrations.length, 0);
  const isLoading =
    championshipQuery.isLoading || groupsQuery.isLoading || standingsQuery.isLoading;
  const errorMessage =
    formatQueryError(championshipQuery.error) ||
    formatQueryError(groupsQuery.error) ||
    formatQueryError(standingsQuery.error);

  async function handleRecalculate() {
    try {
      await recalculateMutation.mutateAsync({
        championshipId,
        payload: { criteria },
      });
      toast.success("Classificacao recalculada.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel recalcular a classificacao."));
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute roles={["admin", "coordenador"]}>
        <AppShell title="Classificacao do Campeonato">
          <SkeletonDashboard cards={4} panels={2} withHero />
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <AppShell title="Classificacao do Campeonato" contentClassName="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,69,0,0.18),rgba(18,18,20,0.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <BarChart3 className="h-4 w-4" />
                Sprint 17.8
              </div>
              <h2 className="mt-4 text-2xl font-black text-white md:text-4xl">
                Classificacao do Campeonato
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Acompanhe a tabela da fase de grupos com calculo por resultados cadastrados,
                criterios de desempate e visao geral ou por grupo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[560px]">
              <MetricCard icon={Trophy} label="Campeonato" value={championship?.name || "-"} />
              <MetricCard icon={Network} label="Grupos" value={groups.length} />
              <MetricCard icon={UsersRound} label="Equipes" value={groupedTeamTotal} />
              <MetricCard
                icon={CalendarClock}
                label="Atualizado"
                value={formatChampionshipDateTime(standingsQuery.data?.calculatedAt)}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href="/admin/campeonatos"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Campeonatos
            </a>
            <a
              href={`/admin/campeonatos/${championshipId}/grupos`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10"
            >
              <Network className="h-4 w-4" />
              Grupos
            </a>
            <a
              href={`/admin/campeonatos/${championshipId}/rodadas`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-black text-primary transition hover:bg-primary/20"
            >
              <Trophy className="h-4 w-4" />
              Rodadas
            </a>
            <a
              href={`/admin/campeonatos/${championshipId}/mata-mata`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-black text-primary transition hover:bg-primary/20"
            >
              <Swords className="h-4 w-4" />
              Mata-mata
            </a>
          </div>
        </section>

        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Falha ao carregar classificacao.</p>
              <p className="mt-1 text-red-100/80">{errorMessage}</p>
            </div>
          </div>
        ) : null}

        <ChampionshipStandingFilters filters={filters} groups={groups} onChange={setFilters} />

        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-white">Tabela de classificacao</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {standingsQuery.data?.total || 0} equipe(s) dentro dos filtros atuais.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void standingsQuery.refetch()}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <RefreshCw
                  className={`h-4 w-4 ${standingsQuery.isFetching ? "animate-spin" : ""}`}
                />
                Atualizar
              </button>
              <button
                type="button"
                disabled={recalculateMutation.isPending}
                onClick={() => void handleRecalculate()}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${recalculateMutation.isPending ? "animate-spin" : ""}`}
                />
                Recalcular
              </button>
            </div>
          </div>

          <ChampionshipStandingTable
            criteria={criteria}
            groups={standingGroups}
            items={standings}
            onViewModeChange={setViewMode}
            viewMode={viewMode}
          />
        </section>
      </AppShell>
    </ProtectedRoute>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: number | string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/35 p-4">
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

function formatQueryError(error: unknown) {
  return error ? formatApiErrorMessage(error, "Nao foi possivel carregar dados.") : "";
}

function ChampionshipStandingsPage({ championshipId }: ChampionshipStandingsPageProps) {
  return <ChampionshipStandingsContent championshipId={championshipId} />;
}

export { ChampionshipStandingsContent, ChampionshipStandingsPage };
