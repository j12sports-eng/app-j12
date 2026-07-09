import { type FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Crown,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { formatApiErrorMessage } from "@/lib/api";

import {
  ChampionshipRegistrationPlayerForm,
  ChampionshipRegistrationPlayersFilters,
  ChampionshipRegistrationPlayersList,
  type ChampionshipRegistrationPlayerFormValues,
} from "../components";
import { useChampionshipRegistration } from "../hooks/useChampionshipRegistrations";
import {
  useChampionshipRegistrationPlayers,
  useCreateRegistrationPlayer,
  useDeleteRegistrationPlayer,
  useSetCaptain,
  useUpdateRegistrationPlayer,
} from "../hooks/useChampionshipRegistrationPlayers";

import type {
  ChampionshipRegistrationPlayer,
  ChampionshipRegistrationPlayerFilters as PlayerFiltersValue,
} from "../types/championship.types";

const PLAYER_PAGE_SIZE = 10;

const EMPTY_FORM_VALUES: ChampionshipRegistrationPlayerFormValues = {
  active: true,
  athleteId: "",
  birthDate: "",
  captain: false,
  document: "",
  name: "",
  position: "",
  shirtNumber: "",
};

type ChampionshipRegistrationPlayersPageProps = {
  registrationId: string;
};

function ChampionshipRegistrationPlayersContent({
  registrationId,
}: ChampionshipRegistrationPlayersPageProps) {
  const registrationQuery = useChampionshipRegistration(registrationId);
  const [selectedPlayer, setSelectedPlayer] = useState<ChampionshipRegistrationPlayer | null>(null);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);
  const [filters, setFilters] = useState<PlayerFiltersValue>({
    limit: PLAYER_PAGE_SIZE,
    page: 1,
    position: "",
    search: "",
    sortBy: "shirtNumber",
    sortDirection: "ASC",
    status: "ACTIVE",
  });
  const [formValues, setFormValues] =
    useState<ChampionshipRegistrationPlayerFormValues>(EMPTY_FORM_VALUES);
  const queryFilters = useMemo(
    () => ({
      ...filters,
      limit: PLAYER_PAGE_SIZE,
    }),
    [filters],
  );
  const playersQuery = useChampionshipRegistrationPlayers(registrationId, queryFilters);
  const createMutation = useCreateRegistrationPlayer();
  const updateMutation = useUpdateRegistrationPlayer();
  const deleteMutation = useDeleteRegistrationPlayer();
  const captainMutation = useSetCaptain();
  const registration = registrationQuery.data || null;
  const players = playersQuery.data?.items || [];
  const totalPlayers = playersQuery.data?.total || 0;
  const page = filters.page || 1;
  const hasNextPage = page * PLAYER_PAGE_SIZE < totalPlayers;
  const isCancelled = registration?.status === "CANCELLED";
  const captainName = players.find((player) => player.captain)?.name || "-";
  const errorMessage =
    formatQueryError(registrationQuery.error) || formatQueryError(playersQuery.error);

  function resetForm() {
    setSelectedPlayer(null);
    setFormValues(EMPTY_FORM_VALUES);
  }

  function handleEdit(player: ChampionshipRegistrationPlayer) {
    setSelectedPlayer(player);
    setFormValues({
      active: player.active,
      athleteId: player.athleteId || "",
      birthDate: player.birthDate ? player.birthDate.slice(0, 10) : "",
      captain: player.captain,
      document: player.document || "",
      name: player.name,
      position: player.position || "",
      shirtNumber: String(player.shirtNumber || ""),
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isCancelled) {
      toast.error("Inscricao cancelada nao permite alteracoes no elenco.");
      return;
    }

    const payload = buildPlayerPayload(formValues);

    if (!payload) {
      toast.error("Informe nome e numero de camisa validos.");
      return;
    }

    try {
      if (selectedPlayer) {
        await updateMutation.mutateAsync({
          payload,
          playerId: selectedPlayer.id,
          registrationId,
        });
        toast.success("Atleta atualizado.");
      } else {
        await createMutation.mutateAsync({
          payload,
          registrationId,
        });
        toast.success("Atleta cadastrado.");
      }

      resetForm();
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel salvar o atleta."));
    }
  }

  async function handleDelete(playerId: string) {
    if (isCancelled) {
      toast.error("Inscricao cancelada nao permite alteracoes no elenco.");
      return;
    }

    const confirmed =
      typeof window === "undefined" || window.confirm("Excluir este atleta do elenco?");

    if (!confirmed) return;

    setBusyPlayerId(playerId);

    try {
      await deleteMutation.mutateAsync({ playerId, registrationId });
      toast.success("Atleta removido do elenco.");
      if (selectedPlayer?.id === playerId) resetForm();
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel excluir o atleta."));
    } finally {
      setBusyPlayerId(null);
    }
  }

  async function handleSetCaptain(playerId: string) {
    if (isCancelled) {
      toast.error("Inscricao cancelada nao permite alteracoes no elenco.");
      return;
    }

    setBusyPlayerId(playerId);

    try {
      await captainMutation.mutateAsync({ playerId, registrationId });
      toast.success("Capitao atualizado.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel definir o capitao."));
    } finally {
      setBusyPlayerId(null);
    }
  }

  if (registrationQuery.isLoading) {
    return (
      <ProtectedRoute roles={["admin", "coordenador"]}>
        <AppShell title="Elenco da Inscricao">
          <SkeletonDashboard cards={4} panels={2} withHero />
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <AppShell title="Elenco da Inscricao" contentClassName="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,69,0,0.18),rgba(18,18,20,0.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <UsersRound className="h-4 w-4" />
                Sprint 17.5
              </div>
              <h2 className="mt-4 text-2xl font-black text-white md:text-4xl">
                Atletas da Equipe Inscrita
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Gerencie o elenco da inscricao sem criar jogos, grupos, sumulas ou upload de
                documentos.
              </p>
              <a
                href="/admin/campeonatos/inscricoes"
                className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para inscricoes
              </a>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[560px]">
              <MetricCard
                icon={ShieldCheck}
                label="Equipe"
                value={registration?.teamName || registration?.teamId || "-"}
              />
              <MetricCard icon={UsersRound} label="Atletas" value={totalPlayers} />
              <MetricCard icon={Crown} label="Capitao" value={captainName} />
              <MetricCard
                icon={UserRound}
                label="Status"
                value={isCancelled ? "Cancelada" : "Ativa"}
              />
            </div>
          </div>
        </section>

        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Falha ao carregar elenco.</p>
              <p className="mt-1 text-red-100/80">{errorMessage}</p>
            </div>
          </div>
        ) : null}

        {isCancelled ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Inscricao cancelada.</p>
              <p className="mt-1 text-amber-100/80">
                O elenco permanece consultavel, mas cadastros e alteracoes ficam bloqueados.
              </p>
            </div>
          </div>
        ) : null}

        <ChampionshipRegistrationPlayersFilters filters={filters} onChange={setFilters} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-white">Elenco cadastrado</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {totalPlayers} atleta(s) dentro dos filtros atuais.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void playersQuery.refetch()}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </button>
            </div>

            <ChampionshipRegistrationPlayersList
              busyPlayerId={busyPlayerId}
              items={players}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onSetCaptain={handleSetCaptain}
              selectedPlayerId={selectedPlayer?.id}
            />

            <PaginationBar
              canPrevious={page > 1}
              canNext={hasNextPage}
              page={page}
              onNext={() =>
                setFilters((current) => ({ ...current, page: (current.page || 1) + 1 }))
              }
              onPrevious={() =>
                setFilters((current) => ({
                  ...current,
                  page: Math.max((current.page || 1) - 1, 1),
                }))
              }
            />
          </section>

          <ChampionshipRegistrationPlayerForm
            disabled={isCancelled}
            isSaving={createMutation.isPending || updateMutation.isPending}
            onChange={setFormValues}
            onReset={resetForm}
            onSubmit={handleSubmit}
            selectedPlayerId={selectedPlayer?.id}
            values={formValues}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function buildPlayerPayload(values: ChampionshipRegistrationPlayerFormValues) {
  const shirtNumber = Number(values.shirtNumber);

  if (!values.name.trim() || !Number.isFinite(shirtNumber) || shirtNumber <= 0) {
    return null;
  }

  return {
    active: values.active,
    athleteId: values.athleteId.trim() || null,
    birthDate: values.birthDate || null,
    captain: values.captain,
    document: values.document.trim() || null,
    name: values.name.trim(),
    position: values.position.trim() || null,
    shirtNumber: Math.trunc(shirtNumber),
  };
}

function PaginationBar({
  canNext,
  canPrevious,
  onNext,
  onPrevious,
  page,
}: {
  canNext: boolean;
  canPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  page: number;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <button
        type="button"
        disabled={!canPrevious}
        onClick={onPrevious}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Anterior
      </button>
      <span className="text-sm font-black text-slate-400">Pagina {page}</span>
      <button
        type="button"
        disabled={!canNext}
        onClick={onNext}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Proxima
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
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

function ChampionshipRegistrationPlayersPage({
  registrationId,
}: ChampionshipRegistrationPlayersPageProps) {
  return <ChampionshipRegistrationPlayersContent registrationId={registrationId} />;
}

export { ChampionshipRegistrationPlayersContent, ChampionshipRegistrationPlayersPage };
