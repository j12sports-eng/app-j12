import { useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  alunoPertenceATurma,
  alunoStatusLabel,
  getAlunosDaTurma,
  useAlunos,
} from "@/lib/alunos-store";
import { turmasStore, type Turma } from "@/lib/turmas-store";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  turma: Turma | null;
}

export function AdicionarAlunoDialog({ open, onOpenChange, turma }: Props) {
  const alunos = useAlunos();
  const [query, setQuery] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const disponiveis = useMemo(() => {
    if (!turma) return [];
    const q = query.trim().toLowerCase();
    return alunos
      .filter((a) => a.status !== "inativo")
      .filter((a) => !alunoPertenceATurma(a, turma))
      .filter((a) => !q || a.nome.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
      .slice(0, 50);
  }, [alunos, turma, query]);

  function adicionar() {
    if (!turma || !selecionado) return;
    const r = turmasStore.adicionarAluno(turma.id, selecionado);
    if (!r.ok) return toast.error(r.reason ?? "Erro ao adicionar");
    toast.success("Aluno adicionado à turma");
    setSelecionado(null);
    setQuery("");
    onOpenChange(false);
  }

  if (!turma) return null;

  const totalMatriculados = getAlunosDaTurma(turma, alunos).length;
  const lotada = turma.capacidadeMaxima > 0 && totalMatriculados >= turma.capacidadeMaxima;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Adicionar aluno à turma</DialogTitle>
          <DialogDescription>
            {turma.nome} · {totalMatriculados}/{turma.capacidadeMaxima} vagas ocupadas
          </DialogDescription>
        </DialogHeader>

        {lotada ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Turma lotada. Aumente a capacidade máxima para adicionar mais alunos.
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-border">
              {disponiveis.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum aluno disponível encontrado.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {disponiveis.map((a) => {
                    const ativo = selecionado === a.id;
                    const pendente = a.status === "pendente";
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => setSelecionado(a.id)}
                          disabled={pendente}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors",
                            ativo ? "bg-primary/10" : "hover:bg-accent",
                            pendente && "cursor-not-allowed opacity-60",
                          )}
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">{a.nome}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {a.modalidade} · {a.email}
                            </div>
                          </div>
                          {a.status === "experimental" && (
                            <Badge variant="outline" className="text-xs">
                              Experimental
                            </Badge>
                          )}
                          {pendente && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 bg-amber-500/10 text-xs text-amber-300"
                            >
                              {alunoStatusLabel(a.status)}
                            </Badge>
                          )}
                          {ativo && <UserPlus className="h-4 w-4 text-primary" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={adicionar} disabled={!selecionado || lotada}>
            <UserPlus className="mr-2 h-4 w-4" /> Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
