import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Clock3, Lock, Save, Search, ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { usePortalAluno, usePortalPresencas } from "@/lib/aluno-portal";
import { getAccessibleClasses, getClassAccessRule } from "@/lib/presenca-access";
import { useProfessores } from "@/lib/professores-store";
import {
  formatDias,
  turmasStore,
  useTurmas,
  type PresencaRegistro,
  type SessaoPresenca,
} from "@/lib/turmas-store";
import { useAlunos } from "@/lib/alunos-store";
import { cn } from "@/lib/utils";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function PresencePage() {
  const { isSelfService } = useAuth();

  if (isSelfService) {
    return <StudentPresencePage />;
  }

  return <StaffPresencePage />;
}

function StaffPresencePage() {
  const { user, hasRole } = useAuth();
  const turmas = useTurmas();
  const alunos = useAlunos();
  const professores = useProfessores();

  const isPrivileged = hasRole("admin", "coordenador");
  const [professorFilter, setProfessorFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SessaoPresenca | null>(null);

  const accessibleTurmas = useMemo(() => getAccessibleClasses(user, turmas), [turmas, user]);

  const visibleTurmas = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return accessibleTurmas.filter((turma) => {
      if (isPrivileged && professorFilter !== "todos" && turma.professorId !== professorFilter) {
        return false;
      }

      if (!normalized) return true;

      return (
        turma.nome.toLowerCase().includes(normalized) ||
        turma.unidade.toLowerCase().includes(normalized) ||
        turma.modalidade.toLowerCase().includes(normalized) ||
        turma.professor.toLowerCase().includes(normalized)
      );
    });
  }, [accessibleTurmas, isPrivileged, professorFilter, search]);

  const selectedTurma = visibleTurmas.find((turma) => turma.id === selectedTurmaId) ?? null;
  const selectedTurmaAnyScope = turmas.find((turma) => turma.id === selectedTurmaId) ?? null;
  const accessRule = selectedTurmaAnyScope
    ? getClassAccessRule(user, selectedTurmaAnyScope)
    : { canView: false, canRegister: false, canEditHistory: false };

  const roster = useMemo(() => {
    if (!selectedTurma || !accessRule.canView) return [];

    return selectedTurma.alunoIds
      .map((alunoId) => alunos.find((aluno) => aluno.id === alunoId))
      .filter((aluno): aluno is NonNullable<typeof aluno> => Boolean(aluno))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [accessRule.canView, alunos, selectedTurma]);

  const currentSession = useMemo(() => {
    if (!selectedTurma || !accessRule.canView) return null;
    return selectedTurma.presencas.find((sessao) => sessao.data === selectedDate) ?? null;
  }, [accessRule.canView, selectedDate, selectedTurma]);

  const history = useMemo(() => {
    if (!selectedTurma || !accessRule.canView) return [];
    return [...selectedTurma.presencas].sort((a, b) => b.data.localeCompare(a.data));
  }, [accessRule.canView, selectedTurma]);

  const professorOptions = useMemo(
    () => professores.filter((professor) => professor.status === "ativo"),
    [professores],
  );

  const stats = useMemo(() => {
    const totalTurmas = accessibleTurmas.length;
    const totalAlunos = accessibleTurmas.reduce((sum, turma) => sum + turma.alunoIds.length, 0);
    const totalSessoes = accessibleTurmas.reduce((sum, turma) => sum + turma.presencas.length, 0);
    const selectedRate =
      currentSession && roster.length > 0
        ? Math.round(
            (currentSession.registros.filter((registro) => registro.presente).length /
              roster.length) *
              100,
          )
        : null;

    return {
      totalTurmas,
      totalAlunos,
      totalSessoes,
      selectedRate,
    };
  }, [accessibleTurmas, currentSession, roster.length]);

  useEffect(() => {
    if (!user) return;

    if (!isPrivileged) {
      if (accessibleTurmas.length === 1 && selectedTurmaId !== accessibleTurmas[0].id) {
        setSelectedTurmaId(accessibleTurmas[0].id);
      }

      if (selectedTurmaId && selectedTurmaAnyScope && !accessRule.canView) {
        setSelectedTurmaId("");
        toast.error("Voce nao tem permissao para acessar esta turma.");
      }
      return;
    }

    if (selectedTurmaId && selectedTurmaAnyScope && !accessRule.canView) {
      setSelectedTurmaId("");
      toast.error("Voce nao tem permissao para acessar esta turma.");
    }
  }, [
    accessRule.canView,
    accessibleTurmas,
    isPrivileged,
    selectedTurmaAnyScope,
    selectedTurmaId,
    user,
  ]);

  useEffect(() => {
    if (!selectedTurma || !accessRule.canView) {
      setDraft({});
      setEditingSessionId(null);
      return;
    }

    const session = selectedTurma.presencas.find((item) => item.data === selectedDate);
    const nextDraft = Object.fromEntries(
      roster.map((aluno) => {
        const saved = session?.registros.find((registro) => registro.alunoId === aluno.id);
        return [aluno.id, saved?.presente ?? false];
      }),
    );

    setDraft(nextDraft);
    setEditingSessionId(session?.id ?? null);
  }, [accessRule.canView, roster, selectedDate, selectedTurma]);

  function toggleAluno(alunoId: string, presente: boolean) {
    setDraft((current) => ({ ...current, [alunoId]: presente }));
  }

  async function handleSave() {
    if (!selectedTurma || !accessRule.canRegister) {
      toast.error("Voce nao tem permissao para registrar presenca nesta turma.");
      return;
    }

    const registros: PresencaRegistro[] = roster.map((aluno) => ({
      alunoId: aluno.id,
      presente: Boolean(draft[aluno.id]),
    }));

    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    try {
      turmasStore.registrarPresenca(selectedTurma.id, selectedDate, registros);
      toast.success(
        editingSessionId ? "Historico de presenca atualizado." : "Presenca registrada.",
      );
    } finally {
      setSaving(false);
    }
  }

  function loadHistory(sessao: SessaoPresenca) {
    if (!selectedTurma || !accessRule.canEditHistory) {
      toast.error("Voce nao tem permissao para editar o historico desta turma.");
      return;
    }

    setSelectedDate(sessao.data);
    setEditingSessionId(sessao.id);
    toast.success("Sessao carregada para edicao.");
  }

  function confirmDeleteHistory() {
    if (!selectedTurma || !deleteTarget) return;
    if (!accessRule.canEditHistory) {
      toast.error("Voce nao tem permissao para editar o historico desta turma.");
      return;
    }

    turmasStore.removerSessao(selectedTurma.id, deleteTarget.id);
    toast.success("Sessao de presenca removida.");
    if (editingSessionId === deleteTarget.id) {
      setEditingSessionId(null);
      setSelectedDate(todayIso());
    }
    setDeleteTarget(null);
  }

  const permissionDenied = Boolean(selectedTurmaAnyScope && !accessRule.canView);

  if (!user) return null;

  return (
    <AppShell title="Presenca">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Presenca</h2>
            <p className="text-sm text-muted-foreground">
              Controle de chamada com filtro por perfil, turma e historico no padrao visual do
              Dashboard.
            </p>
          </div>

          <div className="j12-surface-soft px-4 py-3 text-sm text-foreground/90">
            <div className="flex items-center gap-2">
              <div className="j12-icon-chip h-9 w-9">
                <ShieldAlert className="h-4 w-4" />
              </div>
              Perfil atual: <span className="font-semibold text-foreground">{user.role}</span>
              {user.teacherId ? (
                <span className="ml-2 text-muted-foreground">- vinculo {user.teacherId}</span>
              ) : null}
            </div>
          </div>
        </div>

        {user.role === "professor" && accessibleTurmas.length === 0 ? (
          <section className="j12-empty-state p-10 text-center">
            <div className="j12-icon-chip mx-auto flex h-14 w-14 items-center justify-center">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Nenhuma turma vinculada ao seu cadastro
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Quando houver turmas vinculadas ao seu professor, elas aparecerao automaticamente
              aqui.
            </p>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard
                label="Turmas acessiveis"
                value={String(stats.totalTurmas)}
                tone="text-white"
                icon={CalendarCheck}
              />
              <StatCard
                label="Alunos nas turmas"
                value={String(stats.totalAlunos)}
                tone="text-sky-300"
                icon={Users}
              />
              <StatCard
                label="Sessoes registradas"
                value={String(stats.totalSessoes)}
                tone="text-emerald-300"
                icon={Clock3}
              />
              <StatCard
                label="Taxa da sessao"
                value={stats.selectedRate === null ? "--" : `${stats.selectedRate}%`}
                tone="text-primary"
                icon={Save}
              />
            </section>

            <section className="j12-toolbar p-4">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_0.7fr]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar turma, modalidade, unidade ou professor..."
                    className="j12-field pl-9"
                  />
                </div>

                {isPrivileged ? (
                  <select
                    value={professorFilter}
                    onChange={(event) => setProfessorFilter(event.target.value)}
                    className="j12-field px-3 py-2 text-sm"
                  >
                    <option value="todos">Todos professores</option>
                    {professorOptions.map((professor) => (
                      <option key={professor.id} value={professor.id}>
                        {professor.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="j12-field flex items-center px-3 py-2 text-sm text-muted-foreground">
                    Somente suas turmas
                  </div>
                )}

                <select
                  value={selectedTurmaId}
                  onChange={(event) => setSelectedTurmaId(event.target.value)}
                  className="j12-field px-3 py-2 text-sm"
                >
                  <option value="">Selecione a turma</option>
                  {visibleTurmas.map((turma) => (
                    <option key={turma.id} value={turma.id}>
                      {turma.nome}
                    </option>
                  ))}
                </select>

                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="j12-field"
                />

                <Button
                  onClick={handleSave}
                  disabled={
                    !selectedTurma || !accessRule.canRegister || saving || roster.length === 0
                  }
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {saving ? "Salvando..." : editingSessionId ? "Salvar edicao" : "Salvar presenca"}
                </Button>
              </div>
            </section>

            {permissionDenied ? (
              <section className="j12-surface p-6 text-sm text-red-200">
                Voce nao tem permissao para acessar esta turma.
              </section>
            ) : null}

            {selectedTurma && accessRule.canView ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <section className="j12-surface p-5">
                  <div className="flex flex-col gap-2 border-b border-border/60 pb-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-foreground">
                        {selectedTurma.nome}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {selectedTurma.modalidade} - {selectedTurma.unidade} -{" "}
                        {selectedTurma.professor}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-primary/30 bg-primary/15 text-primary">
                        {formatDias(selectedTurma.diasSemana)}
                      </Badge>
                      <Badge className="border-border bg-background/60 text-foreground/80">
                        {selectedTurma.horarioInicio} - {selectedTurma.horarioFim}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {roster.length === 0 ? (
                      <div className="j12-empty-state p-8 text-center text-sm text-muted-foreground">
                        Nenhum aluno matriculado nesta turma.
                      </div>
                    ) : (
                      roster.map((aluno) => (
                        <div
                          key={aluno.id}
                          className="j12-panel-section flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="font-medium text-foreground">{aluno.nome}</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {aluno.responsavel || "Sem responsavel"} - {aluno.telefone}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant={draft[aluno.id] ? "default" : "outline"}
                              onClick={() => toggleAluno(aluno.id, true)}
                            >
                              Presente
                            </Button>
                            <Button
                              type="button"
                              variant={!draft[aluno.id] ? "default" : "outline"}
                              onClick={() => toggleAluno(aluno.id, false)}
                              className={
                                !draft[aluno.id] ? "bg-red-600 text-white hover:bg-red-700" : ""
                              }
                            >
                              Falta
                            </Button>
                            <label className="j12-field flex items-center gap-2 px-3 py-2 text-sm text-foreground/80">
                              <Checkbox
                                checked={Boolean(draft[aluno.id])}
                                onCheckedChange={(value) => toggleAluno(aluno.id, value === true)}
                              />
                              Presente
                            </label>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="j12-surface p-5">
                  <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
                    <div>
                      <div className="text-lg font-semibold text-foreground">Historico</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {accessRule.canEditHistory
                          ? "Clique em uma sessao para editar ou remover."
                          : "Visualizacao do historico da turma."}
                      </div>
                    </div>
                    {editingSessionId ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingSessionId(null);
                          setSelectedDate(todayIso());
                        }}
                      >
                        Nova lista
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-5 space-y-3">
                    {history.length === 0 ? (
                      <div className="j12-empty-state p-8 text-center text-sm text-muted-foreground">
                        Ainda nao existe historico de presenca para esta turma.
                      </div>
                    ) : (
                      history.map((sessao) => {
                        const presentes = sessao.registros.filter(
                          (registro) => registro.presente,
                        ).length;
                        const faltas = sessao.registros.length - presentes;
                        const isCurrent = editingSessionId === sessao.id;

                        return (
                          <div
                            key={sessao.id}
                            className={cn(
                              "rounded-2xl border p-4",
                              isCurrent
                                ? "border-primary/30 bg-primary/10"
                                : "border-border bg-background/40",
                            )}
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="font-medium text-foreground">{sessao.data}</div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  {presentes} presentes - {faltas} faltas
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => loadHistory(sessao)}
                                >
                                  Editar
                                </Button>
                                {accessRule.canEditHistory ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDeleteTarget(sessao)}
                                    className="border-red-400/30 text-red-300 hover:bg-red-500/10"
                                  >
                                    Excluir
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>
            ) : (
              <section className="j12-empty-state p-10 text-center text-sm text-muted-foreground">
                Selecione uma turma acessivel para registrar ou revisar a presenca.
              </section>
            )}
          </>
        )}
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(value) => !value && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sessao de presenca?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `A sessao do dia ${deleteTarget.data} sera removida do historico da turma.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteHistory}>Excluir sessao</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function StudentPresencePage() {
  const portalAluno = usePortalAluno(true);
  const portalPresencas = usePortalPresencas(true);

  const taxaPresenca =
    portalPresencas.data.length > 0
      ? Math.round(
          (portalPresencas.data.filter((registro) => registro.presente).length /
            portalPresencas.data.length) *
            100,
        )
      : 0;

  if (portalAluno.loading || portalPresencas.loading) {
    return (
      <AppShell title="Minha Presenca">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  if (portalAluno.error || portalPresencas.error) {
    return (
      <AppShell title="Minha Presenca">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          {portalAluno.error || portalPresencas.error}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Minha Presenca">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Minha Presenca</h2>
          <p className="text-sm text-muted-foreground">
            Consulte somente as aulas registradas para o aluno autenticado.
          </p>
        </div>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Aulas registradas"
            value={String(portalPresencas.data.length)}
            tone="text-foreground"
            icon={CalendarCheck}
          />
          <StatCard
            label="Presencas"
            value={String(portalPresencas.data.filter((registro) => registro.presente).length)}
            tone="text-emerald-300"
            icon={Users}
          />
          <StatCard
            label="Faltas"
            value={String(portalPresencas.data.filter((registro) => !registro.presente).length)}
            tone="text-warning"
            icon={ShieldAlert}
          />
          <StatCard
            label="Taxa geral"
            value={`${taxaPresenca}%`}
            tone="text-primary"
            icon={Clock3}
          />
        </section>

        <section className="j12-surface p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">HistÃ³rico do aluno</h3>
            <p className="text-sm text-muted-foreground">
              {portalAluno.data?.nome || "Aluno"} - {portalAluno.data?.turma || "Turma nÃ£o informada"}
            </p>
          </div>

          <div className="space-y-3">
            {portalPresencas.data.length === 0 ? (
              <div className="j12-empty-state p-8 text-center text-sm text-muted-foreground">
                Nenhuma presenÃ§a registrada para este aluno atÃ© o momento.
              </div>
            ) : (
              portalPresencas.data.map((registro) => (
                <div key={registro.id} className="rounded-2xl border border-border bg-background/40 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium text-foreground">{registro.turma}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {registro.modalidade} - {registro.dataAula}
                      </div>
                    </div>
                    <Badge
                      className={
                        registro.presente
                          ? "border-success/30 bg-success/15 text-success"
                          : "border-destructive/30 bg-destructive/15 text-destructive"
                      }
                    >
                      {registro.presente ? "Presente" : "Falta"}
                    </Badge>
                  </div>
                  {registro.observacao ? (
                    <div className="mt-3 text-sm text-muted-foreground">{registro.observacao}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: string;
  icon: typeof CalendarCheck;
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
