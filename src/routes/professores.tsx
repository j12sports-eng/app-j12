import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  Eye,
  FileSignature,
  Mail,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCog,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { ProfessorContractPreviewModal } from "@/components/professores/ProfessorContractPreviewModal";
import { ProfessorContractSignatureModal } from "@/components/professores/ProfessorContractSignatureModal";
import { ProfessorFormDialog } from "@/components/professores/ProfessorFormDialog";
import { ProfessorPerfilDrawer } from "@/components/professores/ProfessorPerfilDrawer";
import { ResourceSyncBanner } from "@/components/shared/ResourceSyncBanner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { type Modalidade } from "@/lib/alunos-store";
import {
  contratoProfessorBadgeClass,
  getProfessorInitials,
  getProfessorModalidadesLabel,
  getProfessorUnidadesLabel,
  nextProfessorPaymentDate,
  professoresStore,
  statusProfessorBadgeClass,
  STATUS_PROFESSOR_OPTIONS,
  useProfessores,
  useProfessoresStatus,
  type Professor,
  type StatusContratoProfessor,
  type StatusProfessor,
} from "@/lib/professores-store";
import { cn } from "@/lib/utils";
import { useSettingsState, useSettingsStatus } from "@/lib/settings/settings-store";

export const Route = createFileRoute("/professores")({
  component: () => (
    <RequireAuth roles={["admin", "coordenador"]}>
      <ProfessoresPage />
    </RequireAuth>
  ),
});

const STATUS_CONTRATO_OPTIONS: Array<{
  value: StatusContratoProfessor | "todos";
  label: string;
}> = [
  { value: "todos", label: "Todos contratos" },
  { value: "Não gerado", label: "Não gerado" },
  { value: "Pendente de assinatura", label: "Pendente" },
  { value: "Assinado", label: "Assinado" },
  { value: "Expirado", label: "Expirado" },
];

function ProfessoresPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin", "coordenador");
  const professores = useProfessores();
  const professoresStatus = useProfessoresStatus();
  const settings = useSettingsState();
  const settingsStatus = useSettingsStatus();
  const modalidadesDisponiveis = useMemo(
    () =>
      Array.from(
        new Set([
          ...settings.modalities.filter((item) => item.ativa).map((item) => item.nome),
          ...professores.flatMap((professor) => professor.modalidades),
        ]),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [professores, settings.modalities],
  );

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusProfessor | "todos">("todos");
  const [filtroContrato, setFiltroContrato] = useState<StatusContratoProfessor | "todos">("todos");
  const [filtroModalidade, setFiltroModalidade] = useState<Modalidade | "todas">("todas");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [perfilId, setPerfilId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [signatureId, setSignatureId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [regenerateId, setRegenerateId] = useState<string | null>(null);

  const editingProfessor = professores.find((professor) => professor.id === editingId) ?? null;
  const perfilProfessor = professores.find((professor) => professor.id === perfilId) ?? null;
  const previewProfessor = professores.find((professor) => professor.id === previewId) ?? null;
  const signatureProfessor = professores.find((professor) => professor.id === signatureId) ?? null;
  const deleteProfessor = professores.find((professor) => professor.id === deleteId) ?? null;
  const regenerateProfessor =
    professores.find((professor) => professor.id === regenerateId) ?? null;

  const professoresFiltrados = useMemo(() => {
    const search = busca.trim().toLowerCase();
    return professores.filter((professor) => {
      if (filtroStatus !== "todos" && professor.status !== filtroStatus) return false;
      if (filtroContrato !== "todos" && professor.contrato.status !== filtroContrato) return false;
      if (filtroModalidade !== "todas" && !professor.modalidades.includes(filtroModalidade)) {
        return false;
      }
      if (!search) return true;

      return (
        professor.nome.toLowerCase().includes(search) ||
        professor.email.toLowerCase().includes(search) ||
        professor.cpf.includes(search) ||
        professor.modalidades.some((modalidade) => modalidade.toLowerCase().includes(search)) ||
        professor.unidades.some((unidade) => unidade.toLowerCase().includes(search))
      );
    });
  }, [busca, filtroContrato, filtroModalidade, filtroStatus, professores]);

  const kpis = useMemo(() => {
    const pendentes = professores.filter(
      (professor) => professor.contrato.status === "Pendente de assinatura",
    ).length;
    const assinados = professores.filter(
      (professor) => professor.contrato.status === "Assinado",
    ).length;
    const folha = professores
      .filter((professor) => professor.status === "ativo")
      .reduce((total, professor) => total + professor.valorContrato, 0);

    return {
      total: professores.length,
      ativos: professores.filter((professor) => professor.status === "ativo").length,
      pendentes,
      assinados,
      folha,
    };
  }, [professores]);

  function openCreateProfessor() {
    setEditingId(null);
    setFormOpen(true);
  }

  function openEditProfessor(professor: Professor) {
    setEditingId(professor.id);
    setFormOpen(true);
  }

  function handleGenerateContract(professor: Professor) {
    if (professor.contrato.status === "Assinado") {
      setRegenerateId(professor.id);
      return;
    }

    professoresStore.generateContract(professor.id);
    toast.success("Contrato do professor gerado com sucesso.");
  }

  function confirmRegenerateContract() {
    if (!regenerateProfessor) return;
    professoresStore.generateContract(regenerateProfessor.id);
    toast.success("Novo contrato gerado e historico anterior preservado.");
    setRegenerateId(null);
  }

  function confirmDeleteProfessor() {
    if (!deleteProfessor) return;
    professoresStore.remove(deleteProfessor.id);
    toast.success("Professor removido.");
    setDeleteId(null);
    if (perfilId === deleteProfessor.id) setPerfilId(null);
    if (previewId === deleteProfessor.id) setPreviewId(null);
    if (signatureId === deleteProfessor.id) setSignatureId(null);
  }

  function handleOpenSignature(professor: Professor) {
    if (professor.contrato.status === "Não gerado") {
      toast.error("Gere o contrato antes de assinar.");
      return;
    }

    if (professor.contrato.status === "Assinado") {
      toast.error("Este contrato ja esta assinado. Gere um novo para nova assinatura.");
      return;
    }

    if (professor.contrato.status === "Expirado") {
      toast.error("Contrato expirado. Gere um novo contrato antes de assinar.");
      return;
    }

    setSignatureId(professor.id);
  }

  function contractQuickAction(professor: Professor) {
    if (professor.contrato.status === "Não gerado") {
      return (
        <Button size="sm" onClick={() => handleGenerateContract(professor)}>
          Gerar
        </Button>
      );
    }

    if (professor.contrato.status === "Pendente de assinatura") {
      return (
        <Button size="sm" onClick={() => handleOpenSignature(professor)}>
          Assinar
        </Button>
      );
    }

    return (
      <Button size="sm" variant="outline" onClick={() => setPreviewId(professor.id)}>
        Ver
      </Button>
    );
  }

  return (
    <AppShell title="Professores">
      <div className="space-y-6">
        <ResourceSyncBanner
          status={professoresStatus}
          resourceLabel="os professores"
          hasData={professores.length > 0}
        />
        {settingsStatus.error ? (
          <ResourceSyncBanner
            status={settingsStatus}
            resourceLabel="as configuracoes auxiliares"
            hasData={settings.modalities.length > 0 || settings.units.length > 0}
          />
        ) : null}

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Professores</h2>
            <p className="text-sm text-muted-foreground">
              Gestao da equipe, contratos e vinculos por multiplas unidades e modalidades no mesmo
              padrao visual do Dashboard J12.
            </p>
          </div>
          {canEdit && (
            <Button onClick={openCreateProfessor}>
              <Plus className="mr-2 h-4 w-4" />
              Novo professor
            </Button>
          )}
        </div>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <KpiCard
            label="Professores"
            value={String(kpis.total)}
            tone="text-white"
            icon={UserCog}
          />
          <KpiCard
            label="Ativos"
            value={String(kpis.ativos)}
            tone="text-emerald-300"
            icon={BadgeCheck}
          />
          <KpiCard
            label="Pendentes"
            value={String(kpis.pendentes)}
            tone="text-amber-300"
            icon={FileSignature}
          />
          <KpiCard
            label="Assinados"
            value={String(kpis.assinados)}
            tone="text-primary"
            icon={BadgeCheck}
          />
          <KpiCard
            label="Folha estimada"
            value={kpis.folha.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
            tone="text-primary"
            icon={Wallet}
          />
        </section>

        <section className="j12-toolbar p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, e-mail, CPF, unidade ou modalidade..."
                className="j12-field pl-9"
              />
            </div>

            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as StatusProfessor | "todos")}
              className="j12-field px-3 py-2 text-sm"
            >
              <option value="todos">Todos status</option>
              {STATUS_PROFESSOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filtroContrato}
              onChange={(e) =>
                setFiltroContrato(e.target.value as StatusContratoProfessor | "todos")
              }
              className="j12-field px-3 py-2 text-sm"
            >
              {STATUS_CONTRATO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filtroModalidade}
              onChange={(e) => setFiltroModalidade(e.target.value as Modalidade | "todas")}
              className="j12-field px-3 py-2 text-sm"
            >
              <option value="todas">Todas modalidades</option>
              {modalidadesDisponiveis.map((modalidade) => (
                <option key={modalidade} value={modalidade}>
                  {modalidade}
                </option>
              ))}
            </select>
          </div>
        </section>

        <div className="j12-table-shell hidden xl:block">
          <table className="w-full text-sm">
            <thead className="j12-table-head text-left text-xs uppercase tracking-[0.16em]">
              <tr>
                <th className="px-5 py-4">Professor</th>
                <th className="px-5 py-4">Contato</th>
                <th className="px-5 py-4">Atuacao</th>
                <th className="px-5 py-4">Turmas</th>
                <th className="px-5 py-4">Financeiro</th>
                <th className="px-5 py-4">Contrato</th>
                {canEdit && <th className="px-5 py-4 text-right">Acoes</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {professoresFiltrados.map((professor) => (
                <tr key={professor.id} className="j12-table-row">
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setPerfilId(professor.id)}
                      className="flex items-center gap-3 text-left"
                    >
                      <div className="j12-icon-chip flex h-11 w-11 items-center justify-center text-sm font-semibold">
                        {getProfessorInitials(professor.nome)}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{professor.nome}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge className={statusProfessorBadgeClass(professor.status)}>
                            {professor.status}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="px-5 py-4 text-foreground/90">
                    <div>{professor.email}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {professor.telefone} · CPF {professor.cpf}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-foreground/90">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Modalidades
                    </div>
                    <div className="mt-2">
                      <ScopeBadges values={professor.modalidades} tone="primary" />
                    </div>
                    <div className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Unidades
                    </div>
                    <div className="mt-2">
                      <ScopeBadges values={professor.unidades} tone="neutral" />
                    </div>
                  </td>
                  <td className="px-5 py-4 text-foreground/90">
                    <div className="max-w-[220px] truncate">
                      {professor.turmas.length
                        ? professor.turmas.join(", ")
                        : "Sem turmas vinculadas"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {professor.jornadaProfessor || "Jornada nao informada"}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-foreground/90">
                    <div>
                      {professor.valorContrato.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {professor.formaPagamentoProfessor} · {nextProfessorPaymentDate(professor)}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-2">
                      <Badge className={contratoProfessorBadgeClass(professor.contrato.status)}>
                        {professor.contrato.status}
                      </Badge>
                      {contractQuickAction(professor)}
                    </div>
                  </td>
                  {canEdit && (
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPerfilId(professor.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditProfessor(professor)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(professor.id)}
                          className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              {professoresFiltrados.length === 0 && (
                <tr>
                  <td
                    colSpan={canEdit ? 7 : 6}
                    className="px-5 py-12 text-center text-muted-foreground"
                  >
                    Nenhum professor encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:hidden">
          {professoresFiltrados.map((professor) => (
            <article key={professor.id} className="j12-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPerfilId(professor.id)}
                  className="min-w-0 text-left"
                >
                  <div className="font-semibold text-foreground">{professor.nome}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {getProfessorModalidadesLabel(professor)}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {getProfessorUnidadesLabel(professor)}
                  </div>
                </button>
                <Badge className={contratoProfessorBadgeClass(professor.contrato.status)}>
                  {professor.contrato.status}
                </Badge>
              </div>

              <div className="mt-4 space-y-3 text-sm text-foreground/90">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  {professor.email}
                </div>
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  {professor.valorContrato.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}{" "}
                  · {professor.formaPagamentoProfessor}
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Modalidades
                  </div>
                  <ScopeBadges values={professor.modalidades} tone="primary" />
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Unidades
                  </div>
                  <ScopeBadges values={professor.unidades} tone="neutral" />
                </div>
                <div className="text-xs text-muted-foreground">
                  Turmas: {professor.turmas.length ? professor.turmas.join(", ") : "Nenhuma"}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {contractQuickAction(professor)}
                <Button variant="outline" onClick={() => setPerfilId(professor.id)}>
                  Perfil
                </Button>
                {canEdit && (
                  <>
                    <Button variant="outline" onClick={() => openEditProfessor(professor)}>
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteId(professor.id)}
                      className="border-red-400/30 text-red-300 hover:bg-red-500/10"
                    >
                      Excluir
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))}

          {professoresFiltrados.length === 0 && (
            <div className="j12-empty-state p-10 text-center text-muted-foreground">
              Nenhum professor encontrado com os filtros atuais.
            </div>
          )}
        </div>
      </div>

      <ProfessorFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        professor={editingProfessor}
      />

      <ProfessorPerfilDrawer
        open={!!perfilProfessor}
        onOpenChange={(value) => !value && setPerfilId(null)}
        professor={perfilProfessor}
        onEditProfessor={openEditProfessor}
        onGenerateContract={handleGenerateContract}
        onOpenContract={(professor) => setPreviewId(professor.id)}
        onOpenSignature={handleOpenSignature}
      />

      <ProfessorContractPreviewModal
        open={!!previewProfessor}
        onOpenChange={(value) => !value && setPreviewId(null)}
        professor={previewProfessor}
        onOpenSignature={handleOpenSignature}
      />

      <ProfessorContractSignatureModal
        open={!!signatureProfessor}
        onOpenChange={(value) => !value && setSignatureId(null)}
        professor={signatureProfessor}
      />

      <AlertDialog open={!!deleteProfessor} onOpenChange={(value) => !value && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir professor?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteProfessor?.contrato.status === "Assinado" ? (
                <>
                  Este professor possui contrato assinado. A exclusao remove o cadastro e o
                  historico contratual, portanto confirme com atencao.
                </>
              ) : (
                <>Esta acao remove o professor e seus dados em memoria.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProfessor}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Excluir professor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!regenerateProfessor}
        onOpenChange={(value) => !value && setRegenerateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar novo contrato assinado?</AlertDialogTitle>
            <AlertDialogDescription>
              O contrato atual sera movido para o historico e um novo contrato pendente de
              assinatura sera criado. Use isso quando os dados do professor mudarem ou for
              necessario renovar o acordo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRegenerateContract}>
              Gerar novo contrato
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: string;
  icon: typeof UserCog;
}) {
  return (
    <div className="j12-kpi-card px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="j12-icon-chip h-9 w-9">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={cn("mt-2 text-2xl font-semibold", tone)}>{value}</div>
    </div>
  );
}

function ScopeBadges({ values, tone }: { values: string[]; tone: "primary" | "neutral" }) {
  if (values.length === 0) {
    return <div className="text-sm text-muted-foreground">Nao informado</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge
          key={value}
          className={
            tone === "primary"
              ? "border-primary/30 bg-primary/15 text-primary"
              : "border-border bg-card/70 text-foreground/80"
          }
        >
          {value}
        </Badge>
      ))}
    </div>
  );
}
