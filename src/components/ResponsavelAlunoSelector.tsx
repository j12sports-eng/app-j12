import { Users } from "lucide-react";

import { useResponsavelAlunos } from "@/hooks/useResponsavelAlunos";
import { cn } from "@/lib/utils";

export function ResponsavelAlunoSelector() {
  const { alunos, loading, erro, selectedStudentId, isFamilyView, selectStudent } =
    useResponsavelAlunos();

  if (loading) {
    return <div className="j12-skeleton h-12 w-full max-w-xl" />;
  }

  if (erro) {
    return (
      <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {erro}
      </div>
    );
  }

  if (alunos.length === 0) {
    return (
      <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
        Nenhum aluno vinculado ao responsavel.
      </div>
    );
  }

  if (alunos.length === 1) {
    const aluno = alunos[0];

    return (
      <div className="inline-flex max-w-full items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3">
        <span className="j12-icon-chip h-9 w-9">
          <Users className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-white">{aluno.nome}</div>
          <div className="truncate text-xs text-muted-foreground">
            {[aluno.modalidade, aluno.turma].filter(Boolean).join(" | ") || "Aluno vinculado"}
          </div>
        </div>
      </div>
    );
  }

  const currentValue = isFamilyView ? "" : selectedStudentId || "";

  return (
    <div className="w-full space-y-3">
      <div className="md:hidden">
        <select
          value={currentValue}
          onChange={(event) => {
            selectStudent(event.target.value || null);
          }}
          className="j12-field min-h-12 w-full px-4 text-sm font-semibold"
        >
          <option value="">Familia completa</option>
          {alunos.map((aluno) => (
            <option key={aluno.id} value={aluno.id}>
              {aluno.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden flex-wrap gap-2 md:flex">
        <button
          type="button"
          onClick={() => selectStudent(null)}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold transition",
            isFamilyView
              ? "border-primary/40 bg-primary text-primary-foreground shadow-[0_0_34px_rgba(255,106,0,0.22)]"
              : "border-white/10 bg-white/5 text-slate-300 hover:border-primary/25 hover:bg-primary/10 hover:text-white",
          )}
        >
          <Users className="h-4 w-4" />
          Familia
        </button>

        {alunos.map((aluno) => {
          const active = selectedStudentId === aluno.id;

          return (
            <button
              key={aluno.id}
              type="button"
              onClick={() => selectStudent(aluno.id)}
              className={cn(
                "inline-flex min-h-11 max-w-[240px] items-center rounded-2xl border px-4 py-2 text-sm font-bold transition",
                active
                  ? "border-primary/40 bg-primary text-primary-foreground shadow-[0_0_34px_rgba(255,106,0,0.22)]"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-primary/25 hover:bg-primary/10 hover:text-white",
              )}
            >
              <span className="truncate">{aluno.nome}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
