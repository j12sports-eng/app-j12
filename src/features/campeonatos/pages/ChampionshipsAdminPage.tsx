import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CalendarRange,
  ClipboardCheck,
  Network,
  PlusCircle,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { formatApiErrorMessage } from "@/lib/api";

import { ChampionshipCard, ChampionshipFilters, ChampionshipForm } from "../components";
import {
  createDefaultChampionshipFormValues,
  toChampionshipFormValues,
  toChampionshipMutationPayload,
  validateChampionshipForm,
} from "../schemas/championship.schemas";
import {
  useArchiveChampionship,
  useChampionships,
  useCreateChampionship,
  useDeleteChampionship,
  usePublishChampionship,
  useUpdateChampionship,
} from "../hooks/useChampionships";

import type {
  Championship,
  ChampionshipFilters as ChampionshipFiltersValue,
} from "../types/championship.types";
import type {
  ChampionshipFormErrors,
  ChampionshipFormValues,
} from "../schemas/championship.schemas";

function ChampionshipsAdminContent() {
  const [filters, setFilters] = useState<ChampionshipFiltersValue>({
    limit: 100,
    search: "",
    status: "",
  });
  const [formValues, setFormValues] = useState<ChampionshipFormValues>(() =>
    createDefaultChampionshipFormValues(),
  );
  const [formErrors, setFormErrors] = useState<ChampionshipFormErrors>({});
  const [editingChampionshipId, setEditingChampionshipId] = useState<string | null>(null);
  const [busyChampionshipId, setBusyChampionshipId] = useState<string | null>(null);

  const queryFilters = useMemo(
    () => ({
      limit: filters.limit,
      search: filters.search,
      status: filters.status,
    }),
    [filters.limit, filters.search, filters.status],
  );
  const championshipsQuery = useChampionships(queryFilters);
  const archiveMutation = useArchiveChampionship();
  const createMutation = useCreateChampionship();
  const deleteMutation = useDeleteChampionship();
  const publishMutation = usePublishChampionship();
  const updateMutation = useUpdateChampionship();
  const championships = championshipsQuery.data?.items || [];
  const hasPublished = championships.filter((item) => item.status === "PUBLISHED").length;
  const hasDraft = championships.filter((item) => item.status === "DRAFT").length;
  const hasArchived = championships.filter((item) => item.status === "ARCHIVED").length;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const errorMessage = championshipsQuery.error
    ? formatApiErrorMessage(championshipsQuery.error, "Nao foi possivel carregar campeonatos.")
    : "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateChampionshipForm(formValues);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast.error("Revise os campos obrigatorios do campeonato.");
      return;
    }

    try {
      const payload = toChampionshipMutationPayload(formValues);

      if (editingChampionshipId) {
        await updateMutation.mutateAsync({
          championshipId: editingChampionshipId,
          payload,
        });
        toast.success("Campeonato atualizado.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Campeonato criado.");
      }

      resetForm();
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel salvar o campeonato."));
    }
  }

  function handleEdit(championship: Championship) {
    setEditingChampionshipId(championship.id);
    setFormValues(toChampionshipFormValues(championship));
    setFormErrors({});
  }

  async function handlePublish(championshipId: string) {
    setBusyChampionshipId(championshipId);

    try {
      await publishMutation.mutateAsync(championshipId);
      toast.success("Campeonato publicado.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel publicar o campeonato."));
    } finally {
      setBusyChampionshipId(null);
    }
  }

  async function handleArchive(championshipId: string) {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm("Arquivar este campeonato? Ele continuara disponivel no historico.");

    if (!confirmed) return;

    setBusyChampionshipId(championshipId);

    try {
      await archiveMutation.mutateAsync(championshipId);
      toast.success("Campeonato arquivado.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel arquivar o campeonato."));
    } finally {
      setBusyChampionshipId(null);
    }
  }

  async function handleDelete(championshipId: string) {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm("Remover este campeonato? Esta acao nao aparece mais na listagem.");

    if (!confirmed) return;

    setBusyChampionshipId(championshipId);

    try {
      await deleteMutation.mutateAsync(championshipId);
      if (editingChampionshipId === championshipId) resetForm();
      toast.success("Campeonato removido.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel remover o campeonato."));
    } finally {
      setBusyChampionshipId(null);
    }
  }

  function resetForm() {
    setEditingChampionshipId(null);
    setFormValues(createDefaultChampionshipFormValues());
    setFormErrors({});
  }

  if (championshipsQuery.isLoading) {
    return (
      <ProtectedRoute roles={["admin", "coordenador"]}>
        <AppShell title="Campeonatos">
          <SkeletonDashboard cards={4} panels={2} withHero />
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <AppShell title="Campeonatos" contentClassName="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,69,0,0.18),rgba(18,18,20,0.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <Trophy className="h-4 w-4" />
                Sprint 17.2
              </div>
              <h2 className="mt-4 text-2xl font-black text-white md:text-4xl">
                Gerenciamento de Campeonatos
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Cadastre, edite, publique, arquive e remova campeonatos mantendo o fluxo
                administrativo atual do sistema.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[560px]">
              <MetricCard icon={Trophy} label="Total" value={championships.length} />
              <MetricCard icon={CalendarRange} label="Publicados" value={hasPublished} />
              <MetricCard icon={Network} label="Rascunhos" value={hasDraft} />
              <MetricCard icon={Archive} label="Arquivados" value={hasArchived} />
            </div>
          </div>

          <div className="mt-5">
            <a
              href="/admin/campeonatos/inscricoes"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-black text-primary transition hover:bg-primary/20"
            >
              <ClipboardCheck className="h-4 w-4" />
              Inscricoes de equipes
            </a>
          </div>
        </section>

        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Falha ao carregar Campeonatos.</p>
              <p className="mt-1 text-red-100/80">{errorMessage}</p>
            </div>
          </div>
        ) : null}

        <ChampionshipFilters filters={filters} onChange={setFilters} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white">Campeonatos cadastrados</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Controle administrativo do ciclo de vida dos campeonatos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void championshipsQuery.refetch()}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Atualizar
              </button>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {championships.length > 0 ? (
                championships.map((championship) => (
                  <ChampionshipCard
                    key={championship.id}
                    championship={championship}
                    getGroupsHref={(item) => `/admin/campeonatos/${item.id}/grupos`}
                    getRoundsHref={(item) => `/admin/campeonatos/${item.id}/rodadas`}
                    getStandingsHref={(item) => `/admin/campeonatos/${item.id}/classificacao`}
                    getStatisticsHref={(item) => `/admin/campeonatos/${item.id}/estatisticas`}
                    getBracketHref={(item) => `/admin/campeonatos/${item.id}/mata-mata`}
                    isBusy={busyChampionshipId === championship.id}
                    onArchive={handleArchive}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onPublish={handlePublish}
                  />
                ))
              ) : (
                <EmptyState />
              )}
            </div>
          </section>

          <ChampionshipForm
            description={
              editingChampionshipId
                ? "Atualize dados cadastrais e status do campeonato selecionado."
                : "Cadastre um campeonato para gestao administrativa."
            }
            errors={formErrors}
            isSaving={isSaving}
            onChange={setFormValues}
            onCancel={editingChampionshipId ? resetForm : undefined}
            onSubmit={handleSubmit}
            submitLabel={editingChampionshipId ? "Salvar alteracoes" : "Criar campeonato"}
            title={editingChampionshipId ? "Editar campeonato" : "Novo campeonato"}
            values={formValues}
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

function EmptyState() {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
      <PlusCircle className="mx-auto h-8 w-8 text-slate-500" />
      <p className="mt-3 text-sm font-black text-white">Nenhum campeonato cadastrado</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Crie o primeiro campeonato para iniciar a gestao administrativa.
      </p>
    </div>
  );
}

function ChampionshipsAdminPage() {
  return <ChampionshipsAdminContent />;
}

export { ChampionshipsAdminContent, ChampionshipsAdminPage };
