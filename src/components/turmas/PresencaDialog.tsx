import { useEffect, useMemo, useState } from "react";
import { Check, X, CalendarCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { alunosStore } from "@/lib/alunos-store";
import { turmasStore, type Turma } from "@/lib/turmas-store";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  turma: Turma | null;
}

export function PresencaDialog({ open, onOpenChange, turma }: Props) {
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [registros, setRegistros] = useState<Record<string, boolean>>({});

  const alunos = useMemo(() => {
    if (!turma) return [];
    return turma.alunoIds
      .map((id) => alunosStore.getById(id))
      .filter((a): a is NonNullable<typeof a> => !!a);
  }, [turma]);

  useEffect(() => {
    if (open && turma) {
      const sessaoExistente = turma.presencas.find((p) => p.data === data);
      const init: Record<string, boolean> = {};
      for (const a of alunos) {
        const reg = sessaoExistente?.registros.find((r) => r.alunoId === a.id);
        init[a.id] = reg?.presente ?? true;
      }
      setRegistros(init);
    }
  }, [open, turma, data, alunos]);

  function toggleTodos(presente: boolean) {
    const novo: Record<string, boolean> = {};
    for (const a of alunos) novo[a.id] = presente;
    setRegistros(novo);
  }

  function salvar() {
    if (!turma) return;
    if (alunos.length === 0)
      return toast.error("Adicione alunos à turma antes de registrar presença");
    const lista = alunos.map((a) => ({ alunoId: a.id, presente: !!registros[a.id] }));
    turmasStore.registrarPresenca(turma.id, data, lista);
    const presentes = lista.filter((l) => l.presente).length;
    toast.success(`Presença registrada: ${presentes}/${lista.length} presentes`);
    onOpenChange(false);
  }

  if (!turma) return null;

  const totalPresentes = Object.values(registros).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" /> Registrar presença
          </DialogTitle>
          <DialogDescription>
            {turma.nome} · {turma.modalidade}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="data">Data da aula</Label>
            <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => toggleTodos(true)}
            >
              Todos presentes
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => toggleTodos(false)}
            >
              Todos faltaram
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto rounded-xl border border-border">
          {alunos.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhum aluno matriculado nesta turma.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {alunos.map((a) => {
                const presente = !!registros[a.id];
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{a.nome}</div>
                      <div className="text-xs text-muted-foreground">{a.modalidade}</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setRegistros((r) => ({ ...r, [a.id]: true }))}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1",
                          presente
                            ? "border-success bg-success/15 text-success"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Check className="h-3.5 w-3.5" /> Presente
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegistros((r) => ({ ...r, [a.id]: false }))}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1",
                          !presente
                            ? "border-destructive bg-destructive/15 text-destructive"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <X className="h-3.5 w-3.5" /> Falta
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {totalPresentes} de {alunos.length} marcado(s) como presente
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={alunos.length === 0}>
            Salvar presença
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
