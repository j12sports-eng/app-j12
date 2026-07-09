import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Network,
  RefreshCw,
  Swords,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { formatApiErrorMessage } from "@/lib/api";

import {
  ChampionshipPlayerStatisticsTable,
  ChampionshipRankingsTabs,
  ChampionshipStatisticsCards,
  ChampionshipStatisticsFilters,
  ChampionshipStatisticsSummary,
  ChampionshipTeamStatisticsTable,
  ChampionshipTopScorersTable,
  type ChampionshipStatisticsFilterState,
} from "../components";
import { useChampionship } from "../hooks/useChampionships";
import {
  useChampionshipRankings,
  useChampionshipStatistics,
  usePlayerStatistics,
  useRecalculateStatistics,
  useTeamStatistics,
  useTopScorers,
} from "../hooks/useChampionshipStatistics";
import { formatChampionshipDateTime } from "../utils/championship-formatters";

import type {
  ChampionshipPlayerStatistics,
  ChampionshipRankingType,
  ChampionshipTeamStatistics,
  ChampionshipTopScorerRankingItem,
} from "../types/championship.types";

const STATISTICS_PAGE_SIZE = 10;
const API_LIMIT = 500;

type ChampionshipStatisticsPageProps = {
  championshipId: string;
};

function ChampionshipStatisticsContent({ championshipId }: ChampionshipStatisticsPageProps) {
  const [filters, setFilters] = useState<ChampionshipStatisticsFilterState>({
    pageSize: STATISTICS_PAGE_SIZE,
    search: "",
  });
  const [activeRanking, setActiveRanking] = useState<ChampionshipRankingType>("topScorers");
  const [teamPage, setTeamPage] = useState(1);
  const [playerPage, setPlayerPage] = useState(1);
  const [scorerPage, setScorerPage] = useState(1);

  const apiFilters = useMemo(() => ({ limit: API_LIMIT }), []);
  const championshipQuery = useChampionship(championshipId);
  const statisticsQuery = useChampionshipStatistics(championshipId, apiFilters);
  const teamStatisticsQuery = useTeamStatistics(championshipId, apiFilters);
  const playerStatisticsQuery = usePlayerStatistics(championshipId, apiFilters);
  const rankingsQuery = useChampionshipRankings(championshipId, { limit: 10 });
  const topScorersQuery = useTopScorers(championshipId, apiFilters);
  const recalculateMutation = useRecalculateStatistics();

  const championship = championshipQuery.data || null;
  const statistics = statisticsQuery.data?.championship || null;
  const rankings = rankingsQuery.data?.rankings || statisticsQuery.data?.rankings || null;
  const teams = useMemo(
    () => teamStatisticsQuery.data || statisticsQuery.data?.teams || [],
    [statisticsQuery.data?.teams, teamStatisticsQuery.data],
  );
  const players = useMemo(
    () => playerStatisticsQuery.data || statisticsQuery.data?.athletes || [],
    [playerStatisticsQuery.data, statisticsQuery.data?.athletes],
  );
  const topScorers = useMemo(
    () => topScorersQuery.data?.items || rankings?.topScorers || [],
    [rankings?.topScorers, topScorersQuery.data?.items],
  );

  const filteredTeams = useMemo(() => filterTeams(teams, filters.search), [filters.search, teams]);
  const filteredPlayers = useMemo(
    () => filterPlayers(players, filters.search),
    [filters.search, players],
  );
  const filteredTopScorers = useMemo(
    () => filterTopScorers(topScorers, filters.search),
    [filters.search, topScorers],
  );

  const paginatedTeams = useMemo(
    () => paginate(filteredTeams, teamPage, filters.pageSize),
    [filteredTeams, filters.pageSize, teamPage],
  );
  const paginatedPlayers = useMemo(
    () => paginate(filteredPlayers, playerPage, filters.pageSize),
    [filteredPlayers, filters.pageSize, playerPage],
  );
  const paginatedTopScorers = useMemo(
    () => paginate(filteredTopScorers, scorerPage, filters.pageSize),
    [filteredTopScorers, filters.pageSize, scorerPage],
  );

  const isLoading = championshipQuery.isLoading || statisticsQuery.isLoading;
  const statisticsErrorMessage =
    formatQueryError(championshipQuery.error) || formatQueryError(statisticsQuery.error);
  const rankingsErrorMessage = formatQueryError(rankingsQuery.error);
  const topScorersErrorMessage = formatQueryError(topScorersQuery.error);

  useEffect(() => {
    setTeamPage(1);
    setPlayerPage(1);
    setScorerPage(1);
  }, [filters.pageSize, filters.search]);

  async function handleRecalculate() {
    try {
      await recalculateMutation.mutateAsync({ championshipId });
      toast.success("Estatisticas recalculadas.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel recalcular as estatisticas."));
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute roles={["admin", "coordenador"]}>
        <AppShell title="Estatisticas do Campeonato">
          <SkeletonDashboard cards={4} panels={2} withHero />
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <AppShell title="Estatisticas do Campeonato" contentClassName="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,69,0,0.18),rgba(18,18,20,0.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <BarChart3 className="h-4 w-4" />
                Sprint 17.11
              </div>
              <h2 className="mt-4 text-2xl font-black text-white md:text-4xl">
                Estatisticas e Rankings
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Visualize estatisticas administrativas do campeonato, equipes, atletas e rankings
                gerados pela Sumula Digital.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[560px]">
              <MetricCard icon={Trophy} label="Campeonato" value={championship?.name || "-"} />
              <MetricCard icon={BarChart3} label="Equipes" value={filteredTeams.length} />
              <MetricCard icon={Network} label="Atletas" value={filteredPlayers.length} />
              <MetricCard
                icon={CalendarClock}
                label="Atualizado"
                value={formatChampionshipDateTime(statisticsQuery.data?.calculatedAt)}
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
              href={`/admin/campeonatos/${championshipId}/classificacao`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10"
            >
              <BarChart3 className="h-4 w-4" />
              Classificacao
            </a>
            <a
              href={`/admin/campeonatos/${championshipId}/rodadas`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10"
            >
              <CalendarClock className="h-4 w-4" />
              Rodadas
            </a>
            <a
              href={`/admin/campeonatos/${championshipId}/mata-mata`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10"
            >
              <Swords className="h-4 w-4" />
              Mata-mata
            </a>
          </div>
        </section>

        {statisticsErrorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Falha ao carregar estatisticas.</p>
              <p className="mt-1 text-red-100/80">{statisticsErrorMessage}</p>
            </div>
          </div>
        ) : null}

        <ChampionshipStatisticsCards statistics={statistics} />

        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-white">Resumo competitivo</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Dados consolidados a partir das sumulas administrativas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void statisticsQuery.refetch()}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <RefreshCw
                  className={`h-4 w-4 ${statisticsQuery.isFetching ? "animate-spin" : ""}`}
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

          <ChampionshipStatisticsSummary rankings={rankings} />
        </section>

        <ChampionshipStatisticsFilters filters={filters} onChange={setFilters} />

        <ChampionshipRankingsTabs
          activeRanking={activeRanking}
          errorMessage={rankingsErrorMessage}
          isLoading={rankingsQuery.isLoading}
          rankings={rankings}
          onRankingChange={setActiveRanking}
        />

        <div className="grid gap-5">
          <ChampionshipTopScorersTable
            errorMessage={topScorersErrorMessage}
            isLoading={topScorersQuery.isLoading}
            items={paginatedTopScorers}
            onPageChange={setScorerPage}
            page={scorerPage}
            pageSize={filters.pageSize}
            total={filteredTopScorers.length}
          />

          <ChampionshipTeamStatisticsTable
            errorMessage={formatQueryError(teamStatisticsQuery.error)}
            isLoading={teamStatisticsQuery.isLoading}
            items={paginatedTeams}
            onPageChange={setTeamPage}
            page={teamPage}
            pageSize={filters.pageSize}
            total={filteredTeams.length}
          />

          <ChampionshipPlayerStatisticsTable
            errorMessage={formatQueryError(playerStatisticsQuery.error)}
            isLoading={playerStatisticsQuery.isLoading}
            items={paginatedPlayers}
            onPageChange={setPlayerPage}
            page={playerPage}
            pageSize={filters.pageSize}
            total={filteredPlayers.length}
          />
        </div>
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

function filterTeams(items: ChampionshipTeamStatistics[], search: string) {
  const query = normalizeSearch(search);
  if (!query) return items;

  return items.filter((item) =>
    [item.teamName, item.teamAcronym, item.teamId, item.registrationId]
      .map(normalizeSearch)
      .some((value) => value.includes(query)),
  );
}

function filterPlayers(items: ChampionshipPlayerStatistics[], search: string) {
  const query = normalizeSearch(search);
  if (!query) return items;

  return items.filter((item) =>
    [item.playerName, item.teamName, item.teamAcronym, item.playerId, item.shirtNumber]
      .map((value) => normalizeSearch(value))
      .some((value) => value.includes(query)),
  );
}

function filterTopScorers(items: ChampionshipTopScorerRankingItem[], search: string) {
  const query = normalizeSearch(search);
  if (!query) return items;

  return items.filter((item) =>
    [item.playerName, item.teamName, item.teamAcronym, item.playerId, item.shirtNumber]
      .map((value) => normalizeSearch(value))
      .some((value) => value.includes(query)),
  );
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  return items.slice((safePage - 1) * safePageSize, safePage * safePageSize);
}

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatQueryError(error: unknown) {
  return error ? formatApiErrorMessage(error, "Nao foi possivel carregar dados.") : "";
}

function ChampionshipStatisticsPage({ championshipId }: ChampionshipStatisticsPageProps) {
  return <ChampionshipStatisticsContent championshipId={championshipId} />;
}

export { ChampionshipStatisticsContent, ChampionshipStatisticsPage };
