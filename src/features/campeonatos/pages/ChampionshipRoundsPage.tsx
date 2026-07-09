import { type FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  Network,
  RefreshCw,
  Swords,
  Trophy,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { formatApiErrorMessage } from "@/lib/api";

import {
  ChampionshipMatchForm,
  ChampionshipRoundFilters,
  ChampionshipRoundForm,
  ChampionshipRoundList,
  type ChampionshipMatchFormValues,
  type ChampionshipRoundFormValues,
} from "../components";
import { useChampionshipGroups } from "../hooks/useChampionshipGroups";
import { useChampionship } from "../hooks/useChampionships";
import {
  useChampionshipRounds,
  useCreateChampionshipMatch,
  useCreateChampionshipRound,
  useDeleteChampionshipMatch,
  useDeleteChampionshipRound,
  useGenerateChampionshipMatches,
  useMoveChampionshipMatch,
  useUpdateChampionshipMatch,
  useUpdateChampionshipRound,
} from "../hooks/useChampionshipRounds";

import type {
  ChampionshipMatchStatus,
  ChampionshipRound,
  ChampionshipRoundFilters as RoundFiltersValue,
} from "../types/championship.types";

const ROUND_PAGE_SIZE = 100;

const EMPTY_ROUND_FORM_VALUES: ChampionshipRoundFormValues = {
  name: "",
  phase: "GROUP_STAGE",
  roundNumber: "",
};

const EMPTY_MATCH_FORM_VALUES: ChampionshipMatchFormValues = {
  awayRegistrationId: "",
  court: "",
  groupId: "",
  homeRegistrationId: "",
  matchDate: "",
  roundId: "",
  startTime: "",
  status: "SCHEDULED",
};

type ChampionshipRoundsPageProps = {
  championshipId: string;
};

function ChampionshipRoundsContent({ championshipId }: ChampionshipRoundsPageProps) {
  const [filters, setFilters] = useState<RoundFiltersValue>({
    limit: ROUND_PAGE_SIZE,
    page: 1,
    phase: "GROUP_STAGE",
    search: "",
    sortBy: "roundNumber",
    sortDirection: "ASC",
  });
  const [roundFormValues, setRoundFormValues] =
    useState<ChampionshipRoundFormValues>(EMPTY_ROUND_FORM_VALUES);
  const [matchFormValues, setMatchFormValues] =
    useState<ChampionshipMatchFormValues>(EMPTY_MATCH_FORM_VALUES);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [busyRoundId, setBusyRoundId] = useState<string | null>(null);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [replaceGenerated, setReplaceGenerated] = useState(false);

  const championshipQuery = useChampionship(championshipId);
  const roundsQuery = useChampionshipRounds(championshipId, filters);
  const groupsQuery = useChampionshipGroups(championshipId, {
    limit: ROUND_PAGE_SIZE,
    page: 1,
    search: "",
    sortBy: "displayOrder",
    sortDirection: "ASC",
  });
  const createRoundMutation = useCreateChampionshipRound();
  const updateRoundMutation = useUpdateChampionshipRound();
  const deleteRoundMutation = useDeleteChampionshipRound();
  const createMatchMutation = useCreateChampionshipMatch();
  const updateMatchMutation = useUpdateChampionshipMatch();
  const deleteMatchMutation = useDeleteChampionshipMatch();
  const moveMatchMutation = useMoveChampionshipMatch();
  const generateMatchesMutation = useGenerateChampionshipMatches();

  const rounds = useMemo(() => roundsQuery.data?.items || [], [roundsQuery.data?.items]);
  const groups = useMemo(() => groupsQuery.data?.items || [], [groupsQuery.data?.items]);
  const championship = championshipQuery.data || null;
  const matchTotal = rounds.reduce((total, round) => total + round.matches.length, 0);
  const groupedTeamsTotal = groups.reduce((total, group) => total + group.registrations.length, 0);
  const isSavingRound = createRoundMutation.isPending || updateRoundMutation.isPending;
  const isLoading = championshipQuery.isLoading || roundsQuery.isLoading;
  const errorMessage =
    formatQueryError(championshipQuery.error) ||
    formatQueryError(roundsQuery.error) ||
    formatQueryError(groupsQuery.error);

  async function handleRoundSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      name: roundFormValues.name.trim() || null,
      phase: roundFormValues.phase,
      roundNumber: parseOptionalPositiveNumber(roundFormValues.roundNumber),
    };

    try {
      if (editingRoundId) {
        await updateRoundMutation.mutateAsync({
          championshipId,
          payload,
          roundId: editingRoundId,
        });
        toast.success("Rodada atualizada.");
      } else {
        await createRoundMutation.mutateAsync({ championshipId, payload });
        toast.success("Rodada criada.");
      }

      resetRoundForm();
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel salvar a rodada."));
    }
  }

  function handleEditRound(round: ChampionshipRound) {
    setEditingRoundId(round.id);
    setRoundFormValues({
      name: round.name || "",
      phase: round.phase,
      roundNumber: String(round.roundNumber || ""),
    });
  }

  async function handleDeleteRound(roundId: string) {
    const confirmed = typeof window === "undefined" || window.confirm("Remover esta rodada vazia?");

    if (!confirmed) return;

    setBusyRoundId(roundId);

    try {
      await deleteRoundMutation.mutateAsync({ championshipId, roundId });
      if (editingRoundId === roundId) resetRoundForm();
      toast.success("Rodada removida.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel remover a rodada."));
    } finally {
      setBusyRoundId(null);
    }
  }

  async function handleMatchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (matchFormValues.homeRegistrationId === matchFormValues.awayRegistrationId) {
      toast.error("Selecione equipes diferentes.");
      return;
    }

    try {
      await createMatchMutation.mutateAsync({
        championshipId,
        payload: {
          awayRegistrationId: matchFormValues.awayRegistrationId,
          court: matchFormValues.court.trim() || null,
          groupId: matchFormValues.groupId,
          homeRegistrationId: matchFormValues.homeRegistrationId,
          matchDate: matchFormValues.matchDate || null,
          startTime: matchFormValues.startTime || null,
          status: matchFormValues.status,
        },
        roundId: matchFormValues.roundId,
      });
      toast.success("Jogo criado.");
      setMatchFormValues((current) => ({
        ...EMPTY_MATCH_FORM_VALUES,
        groupId: current.groupId,
        roundId: current.roundId,
      }));
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel criar o jogo."));
    }
  }

  async function handleStatusChange(matchId: string, status: ChampionshipMatchStatus) {
    setBusyMatchId(matchId);

    try {
      await updateMatchMutation.mutateAsync({
        championshipId,
        matchId,
        payload: { status },
      });
      toast.success("Status do jogo atualizado.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel atualizar o jogo."));
    } finally {
      setBusyMatchId(null);
    }
  }

  async function handleMoveMatch(input: { matchId: string; targetRoundId: string }) {
    setBusyMatchId(input.matchId);

    try {
      await moveMatchMutation.mutateAsync({
        championshipId,
        matchId: input.matchId,
        payload: { targetRoundId: input.targetRoundId },
      });
      setMoveTargets((current) => ({ ...current, [input.matchId]: "" }));
      toast.success("Jogo movido.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel mover o jogo."));
    } finally {
      setBusyMatchId(null);
    }
  }

  async function handleDeleteMatch(matchId: string) {
    const confirmed = typeof window === "undefined" || window.confirm("Remover este jogo?");

    if (!confirmed) return;

    setBusyMatchId(matchId);

    try {
      await deleteMatchMutation.mutateAsync({ championshipId, matchId });
      toast.success("Jogo removido.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel remover o jogo."));
    } finally {
      setBusyMatchId(null);
    }
  }

  async function handleGenerateMatches() {
    const confirmed =
      !replaceGenerated ||
      typeof window === "undefined" ||
      window.confirm("Substituir os jogos da fase de grupos?");

    if (!confirmed) return;

    try {
      const result = await generateMatchesMutation.mutateAsync({
        championshipId,
        payload: {
          phase: "GROUP_STAGE",
          replace: replaceGenerated,
        },
      });
      toast.success(`${result.generated} jogo(s) gerado(s).`);
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel gerar jogos."));
    }
  }

  function resetRoundForm() {
    setEditingRoundId(null);
    setRoundFormValues(EMPTY_ROUND_FORM_VALUES);
  }

  if (isLoading) {
    return (
      <ProtectedRoute roles={["admin", "coordenador"]}>
        <AppShell title="Rodadas do Campeonato">
          <SkeletonDashboard cards={4} panels={2} withHero />
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <AppShell title="Rodadas do Campeonato" contentClassName="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,69,0,0.18),rgba(18,18,20,0.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <CalendarClock className="h-4 w-4" />
                Sprint 17.7
              </div>
              <h2 className="mt-4 text-2xl font-black text-white md:text-4xl">Rodadas e Jogos</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Organize o calendario esportivo do campeonato com rodadas, confrontos, horario,
                quadra e status operacional.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[560px]">
              <MetricCard icon={Trophy} label="Campeonato" value={championship?.name || "-"} />
              <MetricCard icon={CalendarClock} label="Rodadas" value={rounds.length} />
              <MetricCard icon={Swords} label="Jogos" value={matchTotal} />
              <MetricCard icon={Network} label="Equipes" value={groupedTeamsTotal} />
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
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-black text-primary transition hover:bg-primary/20"
            >
              <Network className="h-4 w-4" />
              Grupos
            </a>
            <a
              href="/admin/campeonatos/inscricoes"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10"
            >
              <ClipboardCheck className="h-4 w-4" />
              Inscricoes
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
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10"
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
              <p className="font-bold">Falha ao carregar rodadas.</p>
              <p className="mt-1 text-red-100/80">{errorMessage}</p>
            </div>
          </div>
        ) : null}

        <ChampionshipRoundFilters filters={filters} onChange={setFilters} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-white">Rodadas cadastradas</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {roundsQuery.data?.total || 0} rodada(s) dentro dos filtros atuais.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void roundsQuery.refetch()}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </button>
            </div>

            <ChampionshipRoundList
              busyMatchId={busyMatchId}
              busyRoundId={busyRoundId}
              getMatchReportHref={(match) =>
                `/admin/campeonatos/${championshipId}/jogos/${match.id}/sumula`
              }
              items={rounds}
              moveTargets={moveTargets}
              onDeleteMatch={handleDeleteMatch}
              onDeleteRound={handleDeleteRound}
              onEditRound={handleEditRound}
              onMoveMatch={handleMoveMatch}
              onMoveTargetChange={(matchId, targetRoundId) =>
                setMoveTargets((current) => ({ ...current, [matchId]: targetRoundId }))
              }
              onStatusChange={handleStatusChange}
            />
          </section>

          <div className="space-y-5">
            <ChampionshipRoundForm
              isSaving={isSavingRound}
              onChange={setRoundFormValues}
              onReset={resetRoundForm}
              onSubmit={handleRoundSubmit}
              selectedRoundId={editingRoundId}
              values={roundFormValues}
            />

            <ChampionshipMatchForm
              groups={groups}
              isSaving={createMatchMutation.isPending}
              onChange={setMatchFormValues}
              onSubmit={handleMatchSubmit}
              rounds={rounds}
              values={matchFormValues}
            />

            <GenerateMatchesPanel
              isGenerating={generateMatchesMutation.isPending}
              onGenerate={() => void handleGenerateMatches()}
              onReplaceChange={setReplaceGenerated}
              replace={replaceGenerated}
            />
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function GenerateMatchesPanel({
  isGenerating,
  onGenerate,
  onReplaceChange,
  replace,
}: {
  isGenerating: boolean;
  onGenerate: () => void;
  onReplaceChange: (value: boolean) => void;
  replace: boolean;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-card p-5">
      <div>
        <h3 className="text-lg font-black text-white">Gerar jogos</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Cria confrontos automaticamente a partir dos grupos com equipes vinculadas.
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-semibold text-slate-200">
          <input
            type="checkbox"
            checked={replace}
            onChange={(event) => onReplaceChange(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-black text-primary focus:ring-primary"
          />
          Substituir jogos existentes
          <Wand2 className="ml-auto h-4 w-4 text-primary" />
        </label>

        <button
          type="button"
          disabled={isGenerating}
          onClick={onGenerate}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          Gerar confrontos
        </button>
      </div>
    </section>
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

function parseOptionalPositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function formatQueryError(error: unknown) {
  return error ? formatApiErrorMessage(error, "Nao foi possivel carregar dados.") : "";
}

function ChampionshipRoundsPage({ championshipId }: ChampionshipRoundsPageProps) {
  return <ChampionshipRoundsContent championshipId={championshipId} />;
}

export { ChampionshipRoundsContent, ChampionshipRoundsPage };
