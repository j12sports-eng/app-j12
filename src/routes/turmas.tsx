import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Pencil,
  Eye,
  UserPlus,
  PowerOff,
  Power,
  Trash2,
  Users,
  Clock,
  GraduationCap,
  MapPin,
  CalendarCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { ResourceSyncBanner } from "@/components/shared/ResourceSyncBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { TurmaFormDialog } from "@/components/turmas/TurmaFormDialog";
import { AdicionarAlunoDialog } from "@/components/turmas/AdicionarAlunoDialog";
import { PresencaDialog } from "@/components/turmas/PresencaDialog";
import { TurmaDetalheDialog } from "@/components/turmas/TurmaDetalheDialog";
import { AlunoPerfilDialog } from "@/components/alunos/AlunoPerfilDialog";
import { ContratoVisualizarDialog } from "@/components/contratos/ContratoVisualizarDialog";
import {
  formatDias,
  turmasStore,
  useTurmas,
  useTurmasStatus,
  type Turma,
} from "@/lib/turmas-store";
import { MODALIDADES, type Aluno, type Modalidade } from "@/lib/alunos-store";
import type { Contrato } from "@/lib/contratos-store";
import { useProfessoresStatus } from "@/lib/professores-store";
import { useSettingsState } from "@/lib/settings/settings-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/turmas")({
  component: () => (
    <RequireAuth roles={["admin", "coordenador", "professor"]}>
      <AppShell title="Turmas">
        <TurmasPage />
      </AppShell>
    </RequireAuth>
  ),
});

type StatusFiltro = "todas" | "ativas" | "inativas";

function TurmasPage() {
  const turmas = useTurmas();
  const turmasStatus = useTurmasStatus();
  const professoresStatus = useProfessoresStatus();
  const settings = useSettingsState();
  const [busca, setBusca] = useState("");
  const [modalidade, setModalidade] = useState<Modalidade | "todas">("todas");
  const [status, setStatus] = useState<StatusFiltro>("todas");

  const [formOpen, setFormOpen] = useState(false);
  const [editingTurma, setEditingTurma] = useState<Turma | null>(null);

  const [detalheOpen, setDetalheOpen] = useState(false);
  const [turmaSelecionada, setTurmaSelecionada] = useState<Turma | null>(null);

  const [addAlunoOpen, setAddAlunoOpen] = useState(false);
  const [presencaOpen, setPresencaOpen] = useState(false);

  const [confirmRemover, setConfirmRemover] = useState<Turma | null>(null);

  const [alunoPerfil, setAlunoPerfil] = useState<Aluno | null>(null);
  const [contratoVis, setContratoVis] = useState<Contrato | null>(null);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return turmas
      .filter((t) => modalidade === "todas" || t.modalidade === modalidade)
      .filter((t) => (status === "todas" ? true : status === "ativas" ? t.ativa : !t.ativa))
      .filter((t) => {
        if (!q) return true;
        return (
          t.nome.toLowerCase().includes(q) ||
          t.professor.toLowerCase().includes(q) ||
          t.unidade.toLowerCase().includes(q)
        );
      });
  }, [turmas, busca, modalidade, status]);

  const modalidadeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...settings.modalities.filter((item) => item.ativa).map((item) => item.nome),
          ...turmas.map((turma) => turma.modalidade),
          ...MODALIDADES,
        ]),
      ),
    [settings.modalities, turmas],
  );

  // Mantém turmaSelecionada sincronizada com a store (após editar/adicionar aluno/etc)
  const turmaAtualizada = useMemo(() => {
    if (!turmaSelecionada) return null;
    return turmas.find((t) => t.id === turmaSelecionada.id) ?? null;
  }, [turmas, turmaSelecionada]);

  function novaTurma() {
    setEditingTurma(null);
    setFormOpen(true);
  }
  function editarTurma(t: Turma) {
    setEditingTurma(t);
    setFormOpen(true);
  }
  function abrirDetalhe(t: Turma) {
    setTurmaSelecionada(t);
    setDetalheOpen(true);
  }
  function abrirAddAluno(t: Turma) {
    setTurmaSelecionada(t);
    setAddAlunoOpen(true);
  }
  function toggleAtiva(t: Turma) {
    turmasStore.toggleAtiva(t.id);
    toast.success(t.ativa ? "Turma inativada" : "Turma reativada");
  }
  function confirmarRemover() {
    if (!confirmRemover) return;
    turmasStore.remove(confirmRemover.id);
    toast.success("Turma removida");
    setConfirmRemover(null);
    if (turmaSelecionada?.id === confirmRemover.id) {
      setDetalheOpen(false);
      setTurmaSelecionada(null);
    }
  }

  return (
    <div className="space-y-5">
      <ResourceSyncBanner
        status={turmasStatus}
        resourceLabel="as turmas"
        hasData={turmas.length > 0}
      />
      {professoresStatus.error ? (
        <ResourceSyncBanner
          status={professoresStatus}
          resourceLabel="os professores vinculados"
          hasData={false}
        />
      ) : null}

      {/* Header / filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {turmas.length} turma(s) cadastrada(s) · {turmas.filter((t) => t.ativa).length} ativa(s)
          </p>
        </div>
        <Button onClick={novaTurma}>
          <Plus className="mr-2 h-4 w-4" /> Nova turma
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, professor ou unidade..."
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={modalidade} onValueChange={(v) => setModalidade(v as Modalidade | "todas")}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas modalidades</SelectItem>
            {modalidadeOptions.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFiltro)}>
          <SelectTrigger className="sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="ativas">Ativas</SelectItem>
            <SelectItem value="inativas">Inativas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid de turmas */}
      {filtradas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Nenhuma turma encontrada</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajuste os filtros ou crie uma nova turma.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((t) => {
            const ocupacao = Math.round((t.alunoIds.length / t.capacidadeMaxima) * 100);
            const lotada = t.alunoIds.length >= t.capacidadeMaxima;
            return (
              <article
                key={t.id}
                className={cn(
                  "group flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md",
                  t.ativa ? "border-border" : "border-border/50 opacity-70",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => abrirDetalhe(t)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold group-hover:text-primary">
                        {t.nome}
                      </h3>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{t.modalidade}</div>
                  </button>
                  <Badge variant={t.ativa ? "default" : "outline"} className="shrink-0">
                    {t.ativa ? "Ativa" : "Inativa"}
                  </Badge>
                </div>

                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t.professor}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t.unidade}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {formatDias(t.diasSemana)} · {t.horarioInicio}–{t.horarioFim}
                    </span>
                  </div>
                </div>

                {/* Ocupação */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> Alunos
                    </div>
                    <span className={cn("font-medium", lotada && "text-destructive")}>
                      {t.alunoIds.length}/{t.capacidadeMaxima}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full transition-all",
                        ocupacao >= 100
                          ? "bg-destructive"
                          : ocupacao >= 80
                            ? "bg-warning"
                            : "bg-primary",
                      )}
                      style={{ width: `${Math.min(ocupacao, 100)}%` }}
                    />
                  </div>
                </div>

                {t.presencas.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    {t.presencas.length} sessão(ões) de presença
                  </div>
                )}

                {/* Ações */}
                <div className="mt-4 flex flex-wrap gap-1 border-t border-border pt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => abrirDetalhe(t)}
                    title="Ver turma"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => editarTurma(t)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => abrirAddAluno(t)}
                    disabled={!t.ativa || lotada}
                    title={lotada ? "Turma lotada" : "Adicionar aluno"}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleAtiva(t)}
                    title={t.ativa ? "Inativar turma" : "Reativar turma"}
                  >
                    {t.ativa ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-destructive hover:text-destructive"
                    onClick={() => setConfirmRemover(t)}
                    title="Excluir turma"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <TurmaFormDialog open={formOpen} onOpenChange={setFormOpen} turma={editingTurma} />
      <AdicionarAlunoDialog
        open={addAlunoOpen}
        onOpenChange={setAddAlunoOpen}
        turma={turmaAtualizada}
      />
      <PresencaDialog open={presencaOpen} onOpenChange={setPresencaOpen} turma={turmaAtualizada} />
      <TurmaDetalheDialog
        open={detalheOpen}
        onOpenChange={setDetalheOpen}
        turma={turmaAtualizada}
        onAdicionarAluno={() => setAddAlunoOpen(true)}
        onRegistrarPresenca={() => setPresencaOpen(true)}
        onAbrirAluno={(a) => setAlunoPerfil(a)}
      />
      <AlunoPerfilDialog
        open={!!alunoPerfil}
        onOpenChange={(v) => !v && setAlunoPerfil(null)}
        aluno={alunoPerfil}
        onAbrirContrato={(c) => setContratoVis(c)}
      />
      <ContratoVisualizarDialog
        open={!!contratoVis}
        onOpenChange={(v) => !v && setContratoVis(null)}
        contrato={contratoVis}
      />

      <AlertDialog open={!!confirmRemover} onOpenChange={(v) => !v && setConfirmRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir turma {confirmRemover?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove a turma permanentemente, incluindo o histórico de presenças. Os
              alunos continuam cadastrados no sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarRemover}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
