import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, UserRound } from "lucide-react";

import { alunoStatusClass, alunoStatusLabel, normalizeAlunoStatus } from "@/lib/alunos-store";
import { cn } from "@/lib/utils";

export type StudentProfileSummary = {
  id: string;
  nome: string;
  fotoUrl?: string | null;
  categoria?: string;
  modalidade?: string;
  turma?: string;
  professor?: string;
  status?: string;
  statusMatricula?: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function StudentProfileSummaryCard({
  student,
  compact = false,
  className,
}: {
  student: StudentProfileSummary;
  compact?: boolean;
  className?: string;
}) {
  const status = student.statusMatricula || student.status || "ativo";
  const normalizedStatus = normalizeAlunoStatus(status);
  const category = student.categoria || student.modalidade || "Categoria J12";

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-primary/25 bg-zinc-950 p-5 shadow-[0_0_42px_rgba(255,106,0,0.08)] transition hover:border-primary/45 hover:shadow-[0_0_58px_rgba(255,106,0,0.18)]",
        compact ? "md:p-5" : "md:p-6",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-primary/25 bg-primary/10 text-2xl font-black text-primary">
            {student.fotoUrl ? (
              <img
                src={student.fotoUrl}
                alt={student.nome}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initials(student.nome) || <UserRound className="h-7 w-7" />}</span>
            )}
          </div>

          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em]",
                  alunoStatusClass(normalizedStatus),
                )}
              >
                {alunoStatusLabel(normalizedStatus)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300">
                {category}
              </span>
            </div>

            <h3 className="truncate text-2xl font-black text-white md:text-3xl">{student.nome}</h3>
            <p className="mt-2 text-sm text-slate-400">
              {[student.modalidade, student.turma, student.professor || "Professor a definir"]
                .filter(Boolean)
                .join(" | ")}
            </p>
          </div>
        </div>

        <Link
          to="/dashboard/aluno/$id"
          params={{ id: student.id }}
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground transition hover:brightness-110"
        >
          Ver Perfil Completo
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ["Turma", student.turma || "A definir"],
          ["Modalidade", student.modalidade || "A definir"],
          ["Professor", student.professor || "A definir"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
              {label}
            </p>
            <p className="mt-1 truncate text-sm font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 opacity-10 transition group-hover:opacity-20">
        <ShieldCheck className="h-20 w-20 text-primary" />
      </div>
    </article>
  );
}
