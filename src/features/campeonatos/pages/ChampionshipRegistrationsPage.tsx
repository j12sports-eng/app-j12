import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  RefreshCw,
  Search,
  Shield,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { formatApiErrorMessage } from "@/lib/api";

import {
  ChampionshipRegistrationFilters,
  ChampionshipRegistrationForm,
  ChampionshipRegistrationList,
  type ChampionshipRegistrationFormValues,
} from "../components";
import { useChampionships } from "../hooks/useChampionships";
import {
  useAvailableChampionshipTeams,
  useCancelRegistration,
  useChampionshipRegistrations,
  useRegisterTeam,
  useUpdateRegistration,
} from "../hooks/useChampionshipRegistrations";

import type {
  Championship,
  ChampionshipAvailableTeamFilters,
  ChampionshipRegistration,
  ChampionshipRegistrationFilters as RegistrationFiltersValue,
  ChampionshipRegistrationStatus,
} from "../types/championship.types";

const REGISTRATION_PAGE_SIZE = 10;
const AVAILABLE_TEAM_PAGE_SIZE = 8;

function ChampionshipRegistrationsContent() {
  const championshipsQuery = useChampionships({ limit: 100, search: "", status: "" });
  const championships = championshipsQuery.data?.items || [];
  const [selectedChampionshipId, setSelectedChampionshipId] = useState("");
  const [selectedRegistration, setSelectedRegistration] = useState<ChampionshipRegistration | null>(
    null,
  );
  const [busyRegistrationId, setBusyRegistrationId] = useState<string | null>(null);
  const [registrationFilters, setRegistrationFilters] = useState<RegistrationFiltersValue>({
    limit: REGISTRATION_PAGE_SIZE,
    page: 1,
    search: "",
    sortBy: "createdAt",
    sortDirection: "DESC",
    status: "",
  });
  const [availableTeamFilters, setAvailableTeamFilters] =
    useState<ChampionshipAvailableTeamFilters>({
      limit: AVAILABLE_TEAM_PAGE_SIZE,
      page: 1,
      search: "",
      sortBy: "name",
      sortDirection: "ASC",
    });
  const [formValues, setFormValues] = useState<ChampionshipRegistrationFormValues>({
    championshipId: "",
    confirm: false,
    observations: "",
    teamId: "",
  });

  useEffect(() => {
    if (!selectedChampionshipId && championships.length > 0) {
      const firstOpen = championships.find((item) => item.status !== "ARCHIVED") || championships[0];
      setSelectedChampionshipId(firstOpen.id);
      setFormValues((current) => ({ ...current, championshipId: firstOpen.id }));
    }
  }, [championships, selectedChampionshipId]);

  const selectedChampionship = useMemo(
    () => championships.find((item) => item.id === selectedChampionshipId) || null,
    [championships, selectedChampionshipId],
  );
  const registrationQueryFilters = useMemo(
    () => ({
      ...registrationFilters,
      championshipId: selectedChampionshipId,
      limit: REGISTRATION_PAGE_SIZE,
    }),
    [registrationFilters, selectedChampionshipId],
  );
  const availableQueryFilters = useMemo(
    () => ({
      ...availableTeamFilters,
      championshipId: selectedChampionshipId,
      limit: AVAILABLE_TEAM_PAGE_SIZE,
    }),
    [availableTeamFilters, selectedChampionshipId],
  );
  const registrationsQuery = useChampionshipRegistrations(registrationQueryFilters);
  const availableTeamsQuery = useAvailableChampionshipTeams(availableQueryFilters);
  const registerMutation = useRegisterTeam();
  const cancelMutation = useCancelRegistration();
  const updateMutation = useUpdateRegistration();
  const registrations = registrationsQuery.data?.items || [];
  const availableTeams = availableTeamsQuery.data?.items || [];
  const totalRegistrations = registrationsQuery.data?.total || 0;
  const totalAvailableTeams = availableTeamsQuery.data?.total || 0;
  const registrationPage = registrationFilters.page || 1;
  const availablePage = availableTeamFilters.page || 1;
  const hasNextRegistrationPage = registrationPage * REGISTRATION_PAGE_SIZE < totalRegistrations;
  const hasNextAvailablePage = availablePage * AVAILABLE_TEAM_PAGE_SIZE < totalAvailableTeams;
  const isLoading = championshipsQuery.isLoading;
  const errorMessage =
    formatQueryError(championshipsQuery.error) ||
    formatQueryError(registrationsQuery.error) ||
    formatQueryError(availableTeamsQuery.error);

  function handleChampionshipChange(championshipId: string) {
    setSelectedChampionshipId(championshipId);
    setSelectedRegistration(null);
    setRegistrationFilters((current) => ({ ...current, page: 1 }));
    setAvailableTeamFilters((current) => ({ ...current, page: 1 }));
    setFormValues({
      championshipId,
      confirm: false,
      observations: "",
      teamId: "",
    });
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formValues.championshipId || !formValues.teamId) {
      toast.error("Selecione campeonato e equipe.");
      return;
    }

    try {
      await registerMutation.mutateAsync({
        championshipId: formValues.championshipId,
        confirm: formValues.confirm,
        observations: formValues.observations.trim() || null,
        teamId: formValues.teamId,
      });
      toast.success("Equipe inscrita.");
      setFormValues((current) => ({
        ...current,
        confirm: false,
        observations: "",
        teamId: "",
      }));
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel inscrever a equipe."));
    }
  }

  async function handleCancelRegistration(registrationId: string) {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm("Cancelar esta inscricao de equipe no campeonato?");

    if (!confirmed) return;

    setBusyRegistrationId(registrationId);

    try {
      await cancelMutation.mutateAsync(registrationId);
      toast.success("Inscricao cancelada.");
      if (selectedRegistration?.id === registrationId) setSelectedRegistration(null);
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel cancelar a inscricao."));
    } finally {
      setBusyRegistrationId(null);
    }
  }

  async function handleStatusChange(
    registrationId: string,
    status: ChampionshipRegistrationStatus,
  ) {
    setBusyRegistrationId(registrationId);

    try {
      await updateMutation.mutateAsync({
        registrationId,
        payload: { status },
      });
      toast.success("Status da inscricao atualizado.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel atualizar a inscricao."));
    } finally {
      setBusyRegistrationId(null);
    }
  }

  function handleSelectRegistration(registration: ChampionshipRegistration) {
    setSelectedRegistration(registration);
    setFormValues({
      championshipId: registration.championshipId,
      confirm: registration.status === "CONFIRMED",
      observations: registration.observations || "",
      teamId: "",
    });
  }

  if (isLoading) {
    return (
      <ProtectedRoute roles={["admin", "coordenador"]}>
        <AppShell title="Inscricoes de Campeonatos">
          <SkeletonDashboard cards={4} panels={2} withHero />
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <AppShell title="Inscricoes de Campeonatos" contentClassName="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,69,0,0.18),rgba(18,18,20,0.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <ClipboardCheck className="h-4 w-4" />
                Sprint 17.4
              </div>
              <h2 className="mt-4 text-2xl font-black text-white md:text-4xl">
                Inscricao de Equipes
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Gerencie equipes inscritas sem criar atletas, jogos, grupos ou tabelas.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[560px]">
              <MetricCard icon={Trophy} label="Campeonatos" value={championships.length} />
              <MetricCard icon={ClipboardCheck} label="Inscricoes" value={totalRegistrations} />
              <MetricCard icon={Shield} label="Disponiveis" value={totalAvailableTeams} />
              <MetricCard
                icon={RefreshCw}
                label="Selecionado"
                value={selectedChampionship ? selectedChampionship.name : "-"}
              />
            </div>
          </div>
        </section>

        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Falha ao carregar inscricoes.</p>
              <p className="mt-1 text-red-100/80">{errorMessage}</p>
            </div>
          </div>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-card p-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">Campeonato</span>
            <select
              value={selectedChampionshipId}
              onChange={(event) => handleChampionshipChange(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
            >
              <option value="">Selecione</option>
              {championships.map((championship) => (
                <option key={championship.id} value={championship.id}>
                  {championship.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <ChampionshipRegistrationFilters
          filters={registrationFilters}
          onChange={setRegistrationFilters}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-white">Equipes inscritas</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {totalRegistrations} registro(s) dentro dos filtros atuais.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void registrationsQuery.refetch()}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </button>
            </div>

            <ChampionshipRegistrationList
              busyRegistrationId={busyRegistrationId}
              items={registrations}
              onCancel={handleCancelRegistration}
              onSelect={handleSelectRegistration}
              onStatusChange={handleStatusChange}
              selectedRegistrationId={selectedRegistration?.id}
            />

            <PaginationBar
              canPrevious={registrationPage > 1}
              canNext={hasNextRegistrationPage}
              page={registrationPage}
              onNext={() =>
                setRegistrationFilters((current) => ({
                  ...current,
                  page: (current.page || 1) + 1,
                }))
              }
              onPrevious={() =>
                setRegistrationFilters((current) => ({
                  ...current,
                  page: Math.max((current.page || 1) - 1, 1),
                }))
              }
            />
          </section>

          <div className="space-y-5">
            <ChampionshipRegistrationForm
              availableTeams={availableTeams}
              championships={championships}
              isCancelling={cancelMutation.isPending}
              isSaving={registerMutation.isPending}
              onCancelRegistration={
                selectedRegistration
                  ? () => void handleCancelRegistration(selectedRegistration.id)
                  : undefined
              }
              onChange={(values) => {
                setFormValues(values);
                if (values.championshipId !== selectedChampionshipId) {
                  handleChampionshipChange(values.championshipId);
                }
              }}
              onSubmit={handleRegister}
              selectedRegistrationId={selectedRegistration?.id}
              values={formValues}
            />

            <AvailableTeamsPanel
              filters={availableTeamFilters}
              isLoading={availableTeamsQuery.isFetching}
              items={availableTeams}
              onChange={setAvailableTeamFilters}
              onSelect={(teamId) => setFormValues((current) => ({ ...current, teamId }))}
              page={availablePage}
              total={totalAvailableTeams}
              canNext={hasNextAvailablePage}
            />
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function AvailableTeamsPanel({
  canNext,
  filters,
  isLoading,
  items,
  onChange,
  onSelect,
  page,
  total,
}: {
  canNext: boolean;
  filters: ChampionshipAvailableTeamFilters;
  isLoading: boolean;
  items: Array<{ acronym: string | null; category: string; id: string; modality: string | null; name: string }>;
  onChange: (filters: ChampionshipAvailableTeamFilters) => void;
  onSelect: (teamId: string) => void;
  page: number;
  total: number;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white">Equipes disponiveis</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">{total} equipe(s)</p>
        </div>
        {isLoading ? <RefreshCw className="h-5 w-5 animate-spin text-primary" /> : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
        <label className="relative block">
          <span className="sr-only">Buscar equipe disponivel</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={filters.search || ""}
            onChange={(event) => onChange({ ...filters, page: 1, search: event.target.value })}
            placeholder="Equipe"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-10 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <select
          value={filters.sortDirection || "ASC"}
          onChange={(event) =>
            onChange({
              ...filters,
              page: 1,
              sortDirection: event.target.value as ChampionshipAvailableTeamFilters["sortDirection"],
            })
          }
          className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
        >
          <option value="ASC">Asc</option>
          <option value="DESC">Desc</option>
        </select>
      </div>

      <div className="mt-4 grid gap-2">
        {items.length > 0 ? (
          items.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => onSelect(team.id)}
              className="rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-primary/40 hover:bg-primary/10"
            >
              <p className="truncate text-sm font-black text-white">{team.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {team.category} · {team.modality || "-"}
              </p>
            </button>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
            Nenhuma equipe disponivel.
          </div>
        )}
      </div>

      <PaginationBar
        canPrevious={page > 1}
        canNext={canNext}
        page={page}
        onNext={() => onChange({ ...filters, page: page + 1 })}
        onPrevious={() => onChange({ ...filters, page: Math.max(page - 1, 1) })}
      />
    </section>
  );
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

function ChampionshipRegistrationsPage() {
  return <ChampionshipRegistrationsContent />;
}

export { ChampionshipRegistrationsContent, ChampionshipRegistrationsPage };
