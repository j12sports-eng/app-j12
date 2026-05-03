import { useMemo } from "react";
import {
  Eye,
  UserMinus,
  UserPlus,
  CalendarCheck,
  Users,
  MapPin,
  Clock,
  GraduationCap,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { alunosStore, type Aluno } from "@/lib/alunos-store";
import { calcStatus, useTransacoes } from "@/lib/financeiro-store";
import { formatDias, statsPresencaAluno, turmasStore, type Turma } from "@/lib/turmas-store";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  turma: Turma | null;
  onAdicionarAluno: () => void;
  onRegistrarPresenca: () => void;
  onAbrirAluno: (a: Aluno) => void;
}

function fmtBRDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function TurmaDetalheDialog({
  open,
  onOpenChange,
  turma,
  onAdicionarAluno,
  onRegistrarPresenca,
  onAbrirAluno,
}: Props) {
  const transacoes = useTransacoes();

  const alunos = useMemo(() => {
    if (!turma) return [];
    return turma.alunoIds.map((id) => alunosStore.getById(id)).filter((a): a is Aluno => !!a);
  }, [turma]);

  const situacaoFinanceira = useMemo(() => {
    const map: Record<string, "em_dia" | "atrasado"> = {};
    for (const a of alunos) {
      const minhas = transacoes.filter((t) => t.alunoId === a.id);
      const atrasada = minhas.some((t) => calcStatus(t) === "vencido");
      map[a.id] = atrasada ? "atrasado" : "em_dia";
    }
    return map;
  }, [alunos, transacoes]);

  if (!turma) return null;

  const ocupacao = Math.round((turma.alunoIds.length / turma.capacidadeMaxima) * 100);
  const sessoesPresenca = turma.presencas.length;

  function removerAluno(alunoId: string, nome: string) {
    if (!turma) return;
    turmasStore.removerAluno(turma.id, alunoId);
    toast.success(`${nome} removido(a) da turma`);
  }

  function removerSessao(sessaoId: string) {
    if (!turma) return;
    turmasStore.removerSessao(turma.id, sessaoId);
    toast.success("Sessão de presença removida");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="border-b border-border bg-card p-6">
          <SheetHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="text-xl">{turma.nome}</SheetTitle>
                <SheetDescription>
                  {turma.modalidade} · {turma.unidade}
                </SheetDescription>
              </div>
              <Badge variant={turma.ativa ? "default" : "outline"}>
                {turma.ativa ? "Ativa" : "Inativa"}
              </Badge>
            </div>
          </SheetHeader>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-background p-2.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <GraduationCap className="h-3.5 w-3.5" /> Professor
              </div>
              <div className="mt-0.5 font-medium truncate">{turma.professor}</div>
            </div>
            <div className="rounded-lg border border-border bg-background p-2.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Horário
              </div>
              <div className="mt-0.5 font-medium">
                {turma.horarioInicio}–{turma.horarioFim}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-2.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> Dias
              </div>
              <div className="mt-0.5 font-medium">{formatDias(turma.diasSemana)}</div>
            </div>
            <div className="rounded-lg border border-border bg-background p-2.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Vagas
              </div>
              <div className="mt-0.5 font-medium">
                {turma.alunoIds.length}/{turma.capacidadeMaxima}{" "}
                <span
                  className={cn(
                    "text-xs",
                    ocupacao >= 90 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  ({ocupacao}%)
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={onAdicionarAluno}
              disabled={turma.alunoIds.length >= turma.capacidadeMaxima}
            >
              <UserPlus className="mr-2 h-4 w-4" /> Adicionar aluno
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onRegistrarPresenca}
              disabled={alunos.length === 0}
            >
              <CalendarCheck className="mr-2 h-4 w-4" /> Registrar presença
            </Button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {/* Alunos */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-primary" /> Alunos matriculados ({alunos.length})
            </h3>
            {alunos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhum aluno matriculado nesta turma.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <ul className="divide-y divide-border">
                  {alunos.map((a) => {
                    const sit = situacaoFinanceira[a.id];
                    const stats = statsPresencaAluno(turma, a.id);
                    return (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{a.nome}</span>
                            {a.status !== "ativo" && (
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {a.status}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                sit === "atrasado"
                                  ? "border-destructive/40 text-destructive"
                                  : "border-success/40 text-success",
                              )}
                            >
                              {sit === "atrasado" ? "Atrasado" : "Em dia"}
                            </Badge>
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {stats.total > 0
                              ? `Frequência: ${stats.taxa}% (${stats.presentes}/${stats.total})`
                              : "Sem registros de presença"}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => onAbrirAluno(a)}
                            title="Ver perfil"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title="Remover da turma"
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover {a.nome} da turma?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O aluno será removido apenas desta turma. O cadastro continua no
                                  sistema.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removerAluno(a.id, a.nome)}>
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {/* Histórico de presença */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarCheck className="h-4 w-4 text-primary" /> Histórico de presença (
              {sessoesPresenca})
            </h3>
            {sessoesPresenca === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhuma sessão de presença registrada.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <ul className="max-h-72 divide-y divide-border overflow-y-auto">
                  {turma.presencas.map((s) => {
                    const presentes = s.registros.filter((r) => r.presente).length;
                    const taxa =
                      s.registros.length > 0
                        ? Math.round((presentes / s.registros.length) * 100)
                        : 0;
                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                      >
                        <div>
                          <div className="font-medium">{fmtBRDate(s.data)}</div>
                          <div className="text-xs text-muted-foreground">
                            {presentes}/{s.registros.length} presentes · {taxa}% de frequência
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removerSessao(s.id)}
                          title="Remover registro"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
