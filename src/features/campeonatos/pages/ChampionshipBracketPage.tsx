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
  ChampionshipBracketFilters,
  ChampionshipBracketTree,
  ChampionshipGenerateBracketDialog,
} from "../components";
import {
  CHAMPIONSHIP_BRACKET_STATUS_LABELS,
  CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS,
} from "../constants/championship.constants";
import {
  useAdvanceBracket,
  useChampionshipBracket,
  useDeleteBracket,
  useGenerateBracket,
  useUpdateBracketMatch,
} from "../hooks/useChampionshipBracket";
import { useChampionship } from "../hooks/useChampionships";
import { useChampionshipStandings } from "../hooks/useChampionshipStandings";

import type {
  ChampionshipBracketFilters as BracketFiltersValue,
  ChampionshipBracketMatch,
  ChampionshipBracketMatchUpdatePayload,
  ChampionshipGenerateBracketPayload,
} from "../types/championship.types";

const BRACKET_TEAM_LIMIT = 500;

type ChampionshipBracketPageProps = {
  championshipId: string;
};

function ChampionshipBracketContent({ championshipId }: ChampionshipBracketPageProps) {
  const [filters, setFilters] = useState<BracketFiltersValue>({ phase: "" });
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);

  const championshipQuery = useChampionship(championshipId);
  const bracketQuery = useChampionshipBracket(championshipId, filters);
  const standingsQuery = useChampionshipStandings(championshipId, {
    criteria: CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS,
    limit: BRACKET_TEAM_LIMIT,
    page: 1,
  });
  const generateMutation = useGenerateBracket();
  const updateMatchMutation = useUpdateBracketMatch();
  const advanceMutation = useAdvanceBracket();
  const deleteMutation = useDeleteBracket();

  const championship = championshipQuery.data || null;
  const bracket = bracketQuery.data || null;
  const teamOptions = useMemo(() => standingsQuery.data?.items || [], [standingsQuery.data?.items]);
  const matchTotal = bracket?.matches.length || 0;
  const championName = useMemo(
    () => resolveChampionName(bracket?.championRegistrationId, teamOptions),
    [bracket?.championRegistrationId, teamOptions],
  );
  const isLoading = championshipQuery.isLoading || bracketQuery.isLoading;
  const errorMessage =
    formatQueryError(championshipQuery.error) ||
    formatQueryError(bracketQuery.error) ||
    formatQueryError(standingsQuery.error);

  async function handleGenerate(payload: ChampionshipGenerateBracketPayload) {
    try {
      await generateMutation.mutateAsync({ championshipId, payload });
      toast.success("Mata-mata gerado.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel gerar o mata-mata."));
    }
  }

  async function handleUpdateMatch(
    matchId: string,
    payload: ChampionshipBracketMatchUpdatePayload,
  ) {
    setBusyMatchId(matchId);

    try {
      await updateMatchMutation.mutateAsync({ matchId, payload });
      toast.success("Confronto atualizado.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel atualizar o confronto."));
    } finally {
      setBusyMatchId(null);
    }
  }

  async function handleAdvanceMatch(match: ChampionshipBracketMatch) {
    setBusyMatchId(match.id);

    try {
      await advanceMutation.mutateAsync({
        matchId: match.id,
        payload: { winnerRegistrationId: match.winnerRegistrationId || null },
      });
      toast.success("Vencedor avancado.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel avancar o vencedor."));
    } finally {
      setBusyMatchId(null);
    }
  }

  async function handleDeleteBracket() {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm("Remover o mata-mata antes do inicio da fase?");

    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(championshipId);
      toast.success("Mata-mata removido.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel remover o mata-mata."));
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute roles={["admin", "coordenador"]}>
        <AppShell title="Mata-mata do Campeonato">
          <SkeletonDashboard cards={4} panels={2} withHero />
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <AppShell title="Mata-mata do Campeonato" contentClassName="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,69,0,0.18),rgba(18,18,20,0.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <Swords className="h-4 w-4" />
                Sprint 17.9
              </div>
              <h2 className="mt-4 text-2xl font-black text-white md:text-4xl">
                Mata-mata do Campeonato
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Gere a arvore a partir da classificacao, ajuste confrontos antes do inicio e
                acompanhe o avancamento dos vencedores.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[560px]">
              <MetricCard icon={Trophy} label="Campeonato" value={championship?.name || "-"} />
              <MetricCard
                icon={CalendarClock}
                label="Status"
                value={bracket ? CHAMPIONSHIP_BRACKET_STATUS_LABELS[bracket.status] : "Sem chave"}
              />
              <MetricCard icon={Swords} label="Jogos" value={matchTotal} />
              <MetricCard icon={UsersRound} label="Campeao" value={championName || "-"} />
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
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10"
            >
              <Trophy className="h-4 w-4" />
              Rodadas
            </a>
            <a
              href={`/admin/campeonatos/${championshipId}/classificacao`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10"
            >
              <BarChart3 className="h-4 w-4" />
              Classificacao
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
              <p className="font-bold">Falha ao carregar mata-mata.</p>
              <p className="mt-1 text-red-100/80">{errorMessage}</p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            <ChampionshipBracketFilters filters={filters} onChange={setFilters} />

            <section className="rounded-2xl border border-white/10 bg-card p-5">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-white">Arvore do mata-mata</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {matchTotal} jogo(s) vinculados ao chaveamento atual.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void bracketQuery.refetch()}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${bracketQuery.isFetching ? "animate-spin" : ""}`}
                  />
                  Atualizar
                </button>
              </div>

              {bracket ? (
                <ChampionshipBracketTree
                  bracket={bracket}
                  busyMatchId={busyMatchId}
                  filters={filters}
                  teamOptions={teamOptions}
                  onAdvance={(match) => void handleAdvanceMatch(match)}
                  onUpdate={(matchId, payload) => void handleUpdateMatch(matchId, payload)}
                />
              ) : (
                <EmptyState />
              )}
            </section>
          </div>

          <div className="space-y-5">
            <ChampionshipGenerateBracketDialog
              isGenerating={generateMutation.isPending}
              onGenerate={(payload) => void handleGenerate(payload)}
            />

            {bracket ? (
              <section className="rounded-2xl border border-white/10 bg-card p-5">
                <h3 className="text-lg font-black text-white">Controle do chaveamento</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Remocao permitida apenas antes de qualquer jogo iniciado ou finalizado.
                </p>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => void handleDeleteBracket()}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 text-sm font-black text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Remover mata-mata
                </button>
              </section>
            ) : null}
          </div>
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

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
      <Swords className="mx-auto h-8 w-8 text-slate-500" />
      <p className="mt-3 text-sm font-black text-white">Mata-mata ainda nao gerado</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Gere automaticamente pela classificacao ou crie uma arvore manual para preencher confrontos.
      </p>
    </div>
  );
}

function resolveChampionName(
  championRegistrationId: string | null | undefined,
  teamOptions: Array<{ registrationId: string; teamName: string | null }>,
) {
  if (!championRegistrationId) return "";
  return (
    teamOptions.find((team) => team.registrationId === championRegistrationId)?.teamName ||
    championRegistrationId
  );
}

function formatQueryError(error: unknown) {
  return error ? formatApiErrorMessage(error, "Nao foi possivel carregar dados.") : "";
}

function ChampionshipBracketPage({ championshipId }: ChampionshipBracketPageProps) {
  return <ChampionshipBracketContent championshipId={championshipId} />;
}

export { ChampionshipBracketContent, ChampionshipBracketPage };
