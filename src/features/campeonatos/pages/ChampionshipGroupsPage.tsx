import { type FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ClipboardCheck,
  Network,
  RefreshCw,
  Shuffle,
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
  ChampionshipGroupFilters,
  ChampionshipGroupForm,
  ChampionshipGroupList,
  type ChampionshipGroupFormValues,
} from "../components";
import {
  useAssignRegistrationToGroup,
  useChampionshipGroups,
  useCreateChampionshipGroup,
  useDeleteChampionshipGroup,
  useDrawChampionshipGroups,
  useMoveRegistrationBetweenGroups,
  useRedistributeChampionshipGroups,
  useRemoveRegistrationFromGroup,
  useUpdateChampionshipGroup,
} from "../hooks/useChampionshipGroups";
import { useChampionship } from "../hooks/useChampionships";
import { useChampionshipRegistrations } from "../hooks/useChampionshipRegistrations";

import type {
  ChampionshipGroup,
  ChampionshipGroupFilters as GroupFiltersValue,
  ChampionshipRegistration,
} from "../types/championship.types";

const GROUP_PAGE_SIZE = 100;
const REGISTRATION_LIMIT = 100;

const EMPTY_GROUP_FORM_VALUES: ChampionshipGroupFormValues = {
  displayOrder: "",
  name: "",
};

type AssignmentFormValues = {
  drawPosition: string;
  groupId: string;
  registrationId: string;
};

type DrawFormValues = {
  groupCount: string;
  shuffle: boolean;
};

type ChampionshipGroupsPageProps = {
  championshipId: string;
};

function ChampionshipGroupsContent({ championshipId }: ChampionshipGroupsPageProps) {
  const [filters, setFilters] = useState<GroupFiltersValue>({
    limit: GROUP_PAGE_SIZE,
    page: 1,
    search: "",
    sortBy: "displayOrder",
    sortDirection: "ASC",
  });
  const [formValues, setFormValues] =
    useState<ChampionshipGroupFormValues>(EMPTY_GROUP_FORM_VALUES);
  const [assignmentValues, setAssignmentValues] = useState<AssignmentFormValues>({
    drawPosition: "",
    groupId: "",
    registrationId: "",
  });
  const [drawValues, setDrawValues] = useState<DrawFormValues>({
    groupCount: "4",
    shuffle: true,
  });
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null);
  const [busyRegistrationKey, setBusyRegistrationKey] = useState<string | null>(null);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});

  const championshipQuery = useChampionship(championshipId);
  const groupsQuery = useChampionshipGroups(championshipId, filters);
  const registrationsQuery = useChampionshipRegistrations({
    championshipId,
    limit: REGISTRATION_LIMIT,
    page: 1,
    search: "",
    sortBy: "teamName",
    sortDirection: "ASC",
    status: "",
  });
  const assignMutation = useAssignRegistrationToGroup();
  const createMutation = useCreateChampionshipGroup();
  const deleteMutation = useDeleteChampionshipGroup();
  const drawMutation = useDrawChampionshipGroups();
  const moveMutation = useMoveRegistrationBetweenGroups();
  const redistributeMutation = useRedistributeChampionshipGroups();
  const removeRegistrationMutation = useRemoveRegistrationFromGroup();
  const updateMutation = useUpdateChampionshipGroup();

  const groupItems = groupsQuery.data?.items;
  const registrationItems = registrationsQuery.data?.items;
  const groups = useMemo(() => groupItems || [], [groupItems]);
  const registrations = useMemo(() => registrationItems || [], [registrationItems]);
  const championship = championshipQuery.data || null;
  const assignedRegistrationIds = useMemo(
    () =>
      new Set(
        groups.flatMap((group) =>
          group.registrations.map((registration) => registration.registrationId),
        ),
      ),
    [groups],
  );
  const activeRegistrations = useMemo(
    () =>
      registrations.filter(
        (registration) => registration.status === "CONFIRMED" || registration.status === "PENDING",
      ),
    [registrations],
  );
  const unassignedRegistrations = useMemo(
    () =>
      activeRegistrations.filter((registration) => !assignedRegistrationIds.has(registration.id)),
    [activeRegistrations, assignedRegistrationIds],
  );
  const assignedTotal = assignedRegistrationIds.size;
  const isSavingGroup = createMutation.isPending || updateMutation.isPending;
  const isLoading = championshipQuery.isLoading || groupsQuery.isLoading;
  const errorMessage =
    formatQueryError(championshipQuery.error) ||
    formatQueryError(groupsQuery.error) ||
    formatQueryError(registrationsQuery.error);

  async function handleGroupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formValues.name.trim()) {
      toast.error("Informe o nome do grupo.");
      return;
    }

    const payload = {
      displayOrder: parseOptionalNumber(formValues.displayOrder),
      name: formValues.name.trim(),
    };

    try {
      if (editingGroupId) {
        await updateMutation.mutateAsync({
          championshipId,
          groupId: editingGroupId,
          payload,
        });
        toast.success("Grupo atualizado.");
      } else {
        await createMutation.mutateAsync({ championshipId, payload });
        toast.success("Grupo criado.");
      }

      resetGroupForm();
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel salvar o grupo."));
    }
  }

  function handleEditGroup(group: ChampionshipGroup) {
    setEditingGroupId(group.id);
    setFormValues({
      displayOrder: String(group.displayOrder ?? ""),
      name: group.name,
    });
  }

  async function handleDeleteGroup(groupId: string) {
    const confirmed =
      typeof window === "undefined" || window.confirm("Remover este grupo vazio do campeonato?");

    if (!confirmed) return;

    setBusyGroupId(groupId);

    try {
      await deleteMutation.mutateAsync({ championshipId, groupId });
      if (editingGroupId === groupId) resetGroupForm();
      toast.success("Grupo removido.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel remover o grupo."));
    } finally {
      setBusyGroupId(null);
    }
  }

  async function handleAssignRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!assignmentValues.groupId || !assignmentValues.registrationId) {
      toast.error("Selecione grupo e equipe inscrita.");
      return;
    }

    const registration = registrations.find((item) => item.id === assignmentValues.registrationId);

    setBusyRegistrationKey(`${assignmentValues.groupId}:${assignmentValues.registrationId}`);

    try {
      await assignMutation.mutateAsync({
        championshipId,
        groupId: assignmentValues.groupId,
        payload: {
          drawPosition: parseOptionalNumber(assignmentValues.drawPosition),
          registrationId: assignmentValues.registrationId,
        },
      });
      toast.success(`${registration?.teamName || "Equipe"} vinculada ao grupo.`);
      setAssignmentValues((current) => ({
        ...current,
        drawPosition: "",
        registrationId: "",
      }));
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel vincular a equipe."));
    } finally {
      setBusyRegistrationKey(null);
    }
  }

  async function handleRemoveRegistration(groupId: string, registrationId: string) {
    const confirmed =
      typeof window === "undefined" || window.confirm("Retirar esta equipe do grupo selecionado?");

    if (!confirmed) return;

    setBusyRegistrationKey(`${groupId}:${registrationId}`);

    try {
      await removeRegistrationMutation.mutateAsync({ championshipId, groupId, registrationId });
      toast.success("Equipe retirada do grupo.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel retirar a equipe."));
    } finally {
      setBusyRegistrationKey(null);
    }
  }

  async function handleMoveRegistration(input: {
    groupId: string;
    registrationId: string;
    targetGroupId: string;
  }) {
    setBusyRegistrationKey(`${input.groupId}:${input.registrationId}`);

    try {
      await moveMutation.mutateAsync({
        championshipId,
        groupId: input.groupId,
        payload: {
          targetGroupId: input.targetGroupId,
        },
        registrationId: input.registrationId,
      });
      setMoveTargets((current) => ({ ...current, [input.registrationId]: "" }));
      toast.success("Equipe movida de grupo.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel mover a equipe."));
    } finally {
      setBusyRegistrationKey(null);
    }
  }

  async function handleDrawGroups() {
    try {
      await drawMutation.mutateAsync({
        championshipId,
        payload: buildDrawPayload(drawValues),
      });
      toast.success("Grupos sorteados.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel sortear os grupos."));
    }
  }

  async function handleRedistributeGroups() {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm("Redistribuir todas as equipes entre os grupos? Os vinculos atuais mudarao.");

    if (!confirmed) return;

    try {
      await redistributeMutation.mutateAsync({
        championshipId,
        payload: buildDrawPayload(drawValues),
      });
      toast.success("Equipes redistribuidas.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel redistribuir os grupos."));
    }
  }

  function resetGroupForm() {
    setEditingGroupId(null);
    setFormValues(EMPTY_GROUP_FORM_VALUES);
  }

  if (isLoading) {
    return (
      <ProtectedRoute roles={["admin", "coordenador"]}>
        <AppShell title="Grupos do Campeonato">
          <SkeletonDashboard cards={4} panels={2} withHero />
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <AppShell title="Grupos do Campeonato" contentClassName="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,69,0,0.18),rgba(18,18,20,0.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <Network className="h-4 w-4" />
                Sprint 17.6
              </div>
              <h2 className="mt-4 text-2xl font-black text-white md:text-4xl">
                Grupos do Campeonato
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Organize equipes inscritas em grupos administrativos sem criar jogos, rodadas,
                classificacao, sumulas ou mata-mata.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[560px]">
              <MetricCard icon={Trophy} label="Campeonato" value={championship?.name || "-"} />
              <MetricCard icon={Network} label="Grupos" value={groups.length} />
              <MetricCard icon={UsersRound} label="Vinculadas" value={assignedTotal} />
              <MetricCard
                icon={ClipboardCheck}
                label="Disponiveis"
                value={unassignedRegistrations.length}
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
              href="/admin/campeonatos/inscricoes"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-black text-primary transition hover:bg-primary/20"
            >
              <ClipboardCheck className="h-4 w-4" />
              Inscricoes
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
              <p className="font-bold">Falha ao carregar grupos.</p>
              <p className="mt-1 text-red-100/80">{errorMessage}</p>
            </div>
          </div>
        ) : null}

        <ChampionshipGroupFilters filters={filters} onChange={setFilters} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-white">Grupos cadastrados</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {groupsQuery.data?.total || 0} grupo(s) dentro dos filtros atuais.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void groupsQuery.refetch()}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </button>
            </div>

            <ChampionshipGroupList
              busyGroupId={busyGroupId}
              busyRegistrationKey={busyRegistrationKey}
              items={groups}
              moveTargets={moveTargets}
              onDelete={handleDeleteGroup}
              onEdit={handleEditGroup}
              onMoveRegistration={handleMoveRegistration}
              onMoveTargetChange={(registrationId, targetGroupId) =>
                setMoveTargets((current) => ({ ...current, [registrationId]: targetGroupId }))
              }
              onRemoveRegistration={handleRemoveRegistration}
            />
          </section>

          <div className="space-y-5">
            <ChampionshipGroupForm
              isSaving={isSavingGroup}
              onChange={setFormValues}
              onReset={resetGroupForm}
              onSubmit={handleGroupSubmit}
              selectedGroupId={editingGroupId}
              values={formValues}
            />

            <AssignRegistrationPanel
              groups={groups}
              isSaving={assignMutation.isPending}
              registrations={unassignedRegistrations}
              values={assignmentValues}
              onChange={setAssignmentValues}
              onSubmit={handleAssignRegistration}
            />

            <DrawGroupsPanel
              isDrawing={drawMutation.isPending}
              isRedistributing={redistributeMutation.isPending}
              values={drawValues}
              onChange={setDrawValues}
              onDraw={() => void handleDrawGroups()}
              onRedistribute={() => void handleRedistributeGroups()}
            />
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function AssignRegistrationPanel({
  groups,
  isSaving,
  onChange,
  onSubmit,
  registrations,
  values,
}: {
  groups: ChampionshipGroup[];
  isSaving: boolean;
  onChange: (values: AssignmentFormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  registrations: ChampionshipRegistration[];
  values: AssignmentFormValues;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <div>
        <h3 className="text-lg font-black text-white">Vincular equipe</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Use apenas equipes pendentes ou confirmadas que ainda nao estao em grupo.
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">Grupo</span>
          <select
            value={values.groupId}
            onChange={(event) => onChange({ ...values, groupId: event.target.value })}
            className={fieldClassName}
            required
          >
            <option value="">Selecione</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">Equipe inscrita</span>
          <select
            value={values.registrationId}
            onChange={(event) => onChange({ ...values, registrationId: event.target.value })}
            className={fieldClassName}
            required
          >
            <option value="">Selecione</option>
            {registrations.map((registration) => (
              <option key={registration.id} value={registration.id}>
                {registration.teamName || registration.teamId}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">Posicao</span>
          <input
            value={values.drawPosition}
            onChange={(event) => onChange({ ...values, drawPosition: event.target.value })}
            className={fieldClassName}
            inputMode="numeric"
            min={0}
            placeholder="Automatico"
            type="number"
          />
        </label>

        <button
          type="submit"
          disabled={isSaving || !values.groupId || !values.registrationId}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UsersRound className="h-4 w-4" />
          Vincular equipe
        </button>
      </div>
    </form>
  );
}

function DrawGroupsPanel({
  isDrawing,
  isRedistributing,
  onChange,
  onDraw,
  onRedistribute,
  values,
}: {
  isDrawing: boolean;
  isRedistributing: boolean;
  onChange: (values: DrawFormValues) => void;
  onDraw: () => void;
  onRedistribute: () => void;
  values: DrawFormValues;
}) {
  const isBusy = isDrawing || isRedistributing;

  return (
    <section className="rounded-2xl border border-white/10 bg-card p-5">
      <div>
        <h3 className="text-lg font-black text-white">Sorteio de grupos</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Distribui equipes inscritas entre grupos existentes ou cria grupos basicos.
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-300">Quantidade</span>
          <input
            value={values.groupCount}
            onChange={(event) => onChange({ ...values, groupCount: event.target.value })}
            className={fieldClassName}
            inputMode="numeric"
            min={1}
            max={64}
            type="number"
          />
        </label>

        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-semibold text-slate-200">
          <input
            type="checkbox"
            checked={values.shuffle}
            onChange={(event) => onChange({ ...values, shuffle: event.target.checked })}
            className="h-4 w-4 rounded border-white/20 bg-black text-primary focus:ring-primary"
          />
          Embaralhar ordem
          <Shuffle className="ml-auto h-4 w-4 text-primary" />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={onDraw}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Shuffle className="h-4 w-4" />
            Sortear
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onRedistribute}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            Redistribuir
          </button>
        </div>
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

function parseOptionalNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() ? Math.max(Math.trunc(parsed), 0) : null;
}

function buildDrawPayload(values: DrawFormValues) {
  return {
    groupCount: parseOptionalNumber(values.groupCount),
    shuffle: values.shuffle,
  };
}

function formatQueryError(error: unknown) {
  return error ? formatApiErrorMessage(error, "Nao foi possivel carregar dados.") : "";
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60";

function ChampionshipGroupsPage({ championshipId }: ChampionshipGroupsPageProps) {
  return <ChampionshipGroupsContent championshipId={championshipId} />;
}

export { ChampionshipGroupsContent, ChampionshipGroupsPage };
