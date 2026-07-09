import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ClipboardList, RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { formatApiErrorMessage } from "@/lib/api";

import {
  ChampionshipCardForm,
  ChampionshipGoalForm,
  ChampionshipMatchEventsList,
  ChampionshipMatchReportForm,
  ChampionshipMatchTimeline,
  ChampionshipSubstitutionForm,
} from "../components";
import { useChampionshipRegistrationPlayers } from "../hooks/useChampionshipRegistrationPlayers";
import {
  useCreateMatchEvent,
  useCreateMatchReport,
  useDeleteMatchEvent,
  useFinalizeMatchReport,
  useMatchReport,
  useOpenMatchReport,
  useReopenMatchReport,
  useUpdateMatchEvent,
  useUpdateMatchReport,
} from "../hooks/useMatchReport";
import { formatChampionshipDate } from "../utils/championship-formatters";

import type {
  ChampionshipMatch,
  ChampionshipMatchEventPayload,
  ChampionshipMatchEventUpdatePayload,
  ChampionshipMatchReport,
  ChampionshipMatchReportFinalizePayload,
  ChampionshipMatchReportPayload,
} from "../types/championship.types";

type ChampionshipMatchReportPageProps = {
  championshipId: string;
  matchId: string;
};

function ChampionshipMatchReportContent({
  championshipId,
  matchId,
}: ChampionshipMatchReportPageProps) {
  const [busyEventId, setBusyEventId] = useState<string | null>(null);

  const reportQuery = useMatchReport(matchId);
  const createReportMutation = useCreateMatchReport();
  const updateReportMutation = useUpdateMatchReport();
  const openReportMutation = useOpenMatchReport();
  const finalizeReportMutation = useFinalizeMatchReport();
  const reopenReportMutation = useReopenMatchReport();
  const createEventMutation = useCreateMatchEvent();
  const updateEventMutation = useUpdateMatchEvent();
  const deleteEventMutation = useDeleteMatchEvent();

  const report = reportQuery.data?.report || null;
  const match = report?.match || reportQuery.data?.match || null;
  const isFinished = report?.status === "FINISHED";
  const homePlayersQuery = useChampionshipRegistrationPlayers(match?.homeRegistrationId, {
    limit: 100,
    page: 1,
    sortBy: "shirtNumber",
    sortDirection: "ASC",
    status: "ACTIVE",
  });
  const awayPlayersQuery = useChampionshipRegistrationPlayers(match?.awayRegistrationId, {
    limit: 100,
    page: 1,
    sortBy: "shirtNumber",
    sortDirection: "ASC",
    status: "ACTIVE",
  });

  const teams = useMemo(() => buildTeamOptions(match), [match]);
  const playersByRegistration = useMemo(
    () => ({
      [match?.awayRegistrationId || "away"]: awayPlayersQuery.data?.items || [],
      [match?.homeRegistrationId || "home"]: homePlayersQuery.data?.items || [],
    }),
    [
      awayPlayersQuery.data?.items,
      homePlayersQuery.data?.items,
      match?.awayRegistrationId,
      match?.homeRegistrationId,
    ],
  );
  const events = report?.events || [];
  const eventMutationPending = createEventMutation.isPending || updateEventMutation.isPending;
  const errorMessage = reportQuery.error
    ? formatApiErrorMessage(reportQuery.error, "Nao foi possivel carregar a sumula.")
    : "";

  async function handleCreate(payload: ChampionshipMatchReportPayload) {
    try {
      await createReportMutation.mutateAsync({ matchId, payload });
      toast.success("Sumula criada.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel criar a sumula."));
    }
  }

  async function handleSave(payload: ChampionshipMatchReportPayload) {
    try {
      await updateReportMutation.mutateAsync({ matchId, payload });
      toast.success("Sumula atualizada.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel atualizar a sumula."));
    }
  }

  async function handleOpen() {
    try {
      await openReportMutation.mutateAsync({ matchId });
      toast.success("Partida aberta na sumula.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel abrir a sumula."));
    }
  }

  async function handleFinalize(payload: ChampionshipMatchReportFinalizePayload) {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm("Finalizar a sumula e sincronizar o placar do jogo?");

    if (!confirmed) return;

    try {
      await finalizeReportMutation.mutateAsync({ matchId, payload });
      toast.success("Sumula finalizada e placar sincronizado.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel finalizar a sumula."));
    }
  }

  async function handleReopen() {
    const confirmed = typeof window === "undefined" || window.confirm("Reabrir esta sumula?");

    if (!confirmed) return;

    try {
      await reopenReportMutation.mutateAsync({ matchId });
      toast.success("Sumula reaberta.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel reabrir a sumula."));
    }
  }

  async function handleCreateEvent(payload: ChampionshipMatchEventPayload) {
    try {
      await createEventMutation.mutateAsync({ matchId, payload });
      toast.success("Evento registrado.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel registrar o evento."));
    }
  }

  async function handleUpdateEvent(eventId: string, payload: ChampionshipMatchEventUpdatePayload) {
    setBusyEventId(eventId);

    try {
      await updateEventMutation.mutateAsync({ eventId, matchId, payload });
      toast.success("Evento atualizado.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel atualizar o evento."));
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    const confirmed = typeof window === "undefined" || window.confirm("Remover este evento?");

    if (!confirmed) return;

    setBusyEventId(eventId);

    try {
      await deleteEventMutation.mutateAsync({ eventId, matchId });
      toast.success("Evento removido.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel remover o evento."));
    } finally {
      setBusyEventId(null);
    }
  }

  if (reportQuery.isLoading) {
    return (
      <ProtectedRoute roles={["admin", "coordenador"]}>
        <AppShell title="Sumula Digital">
          <SkeletonDashboard cards={4} panels={2} withHero />
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <AppShell title="Sumula Digital" contentClassName="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,69,0,0.18),rgba(18,18,20,0.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <ClipboardList className="h-4 w-4" />
                Sprint 17.10
              </div>
              <h2 className="mt-4 text-2xl font-black text-white md:text-4xl">Sumula Digital</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Registre eventos da partida e finalize o placar oficial do campeonato.
              </p>
            </div>

            <Scoreboard match={match} report={report} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={`/admin/campeonatos/${championshipId}/rodadas`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Rodadas
            </a>
            <button
              type="button"
              onClick={() => void reportQuery.refetch()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-black text-primary transition hover:bg-primary/20"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </section>

        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Falha ao carregar sumula.</p>
              <p className="mt-1 text-red-100/80">{errorMessage}</p>
            </div>
          </div>
        ) : null}

        {!report ? (
          <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/5 p-5 text-sm leading-6 text-slate-300">
            Crie a sumula para liberar registros de gols, cartoes, faltas, substituicoes,
            observacoes e W.O.
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-5">
            <ChampionshipMatchTimeline events={events} />
            <ChampionshipMatchEventsList
              busyEventId={busyEventId}
              disabled={!report || isFinished}
              events={events}
              onDelete={(eventId) => void handleDeleteEvent(eventId)}
              onUpdate={(eventId, payload) => void handleUpdateEvent(eventId, payload)}
            />
          </div>

          <div className="space-y-5">
            <ChampionshipMatchReportForm
              isCreating={createReportMutation.isPending}
              isFinalizing={finalizeReportMutation.isPending}
              isOpening={openReportMutation.isPending}
              isReopening={reopenReportMutation.isPending}
              isSaving={updateReportMutation.isPending}
              report={report}
              onCreate={(payload) => void handleCreate(payload)}
              onFinalize={(payload) => void handleFinalize(payload)}
              onOpen={() => void handleOpen()}
              onReopen={() => void handleReopen()}
              onSave={(payload) => void handleSave(payload)}
            />

            <ChampionshipGoalForm
              disabled={!report || isFinished || teams.length === 0}
              isSaving={createEventMutation.isPending}
              playersByRegistration={playersByRegistration}
              teams={teams}
              onSubmit={(payload) => void handleCreateEvent(payload)}
            />

            <ChampionshipCardForm
              disabled={!report || isFinished || teams.length === 0}
              isSaving={eventMutationPending}
              playersByRegistration={playersByRegistration}
              teams={teams}
              onSubmit={(payload) => void handleCreateEvent(payload)}
            />

            <ChampionshipSubstitutionForm
              disabled={!report || isFinished || teams.length === 0}
              isSaving={eventMutationPending}
              playersByRegistration={playersByRegistration}
              teams={teams}
              onSubmit={(payload) => void handleCreateEvent(payload)}
            />
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function Scoreboard({
  match,
  report,
}: {
  match: ChampionshipMatch | null;
  report: ChampionshipMatchReport | null;
}) {
  const homeScore = report?.homeScore ?? match?.homeScore ?? 0;
  const awayScore = report?.awayScore ?? match?.awayScore ?? 0;

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] lg:min-w-[520px]">
      <TeamScore label={match?.homeTeamName || "Mandante"} score={homeScore} />
      <div className="flex min-h-20 items-center justify-center rounded-2xl border border-white/10 bg-black/35 px-4 text-2xl font-black text-primary">
        x
      </div>
      <TeamScore label={match?.awayTeamName || "Visitante"} score={awayScore} />
      <div className="sm:col-span-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-center text-xs font-semibold text-slate-400">
        {match?.groupName || "Grupo"} - {formatChampionshipDate(match?.matchDate)} -{" "}
        {match?.startTime || "sem horario"} - {match?.court || "sem quadra"}
      </div>
    </div>
  );
}

function TeamScore({ label, score }: { label: string; score: number | null }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/35 p-4 text-center">
      <Trophy className="mx-auto h-5 w-5 text-primary" />
      <p className="mt-2 truncate text-sm font-black text-white">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{score ?? 0}</p>
    </article>
  );
}

function buildTeamOptions(match: ChampionshipMatch | null) {
  if (!match) return [];

  return [
    {
      label: match.homeTeamName || match.homeRegistrationId,
      registrationId: match.homeRegistrationId,
    },
    {
      label: match.awayTeamName || match.awayRegistrationId,
      registrationId: match.awayRegistrationId,
    },
  ];
}

function ChampionshipMatchReportPage({
  championshipId,
  matchId,
}: ChampionshipMatchReportPageProps) {
  return <ChampionshipMatchReportContent championshipId={championshipId} matchId={matchId} />;
}

export { ChampionshipMatchReportContent, ChampionshipMatchReportPage };
