import { createFileRoute } from "@tanstack/react-router";
import { Clock3, MapPin, Target, Trophy, Users } from "lucide-react";

import { PortalAlunoLayout } from "@/components/PortalAlunoLayout";
import { PortalHero, PortalKpiCard } from "@/components/shared/PortalPrimitives";
import { usePortalAluno } from "@/lib/aluno-portal";
import {
  formatAlunoScope,
  getAlunoHorarios,
  getAlunoModalidades,
  getAlunoTurmas,
  getAlunoUnidades,
} from "@/lib/alunos-store";

export const Route = createFileRoute("/portal-aluno/treinos")({
  component: TreinosAlunoPage,
});

function TreinosAlunoPage() {
  const { data: aluno, loading, error } = usePortalAluno(true);
  const horarios = getAlunoHorarios(aluno);
  const turmas = getAlunoTurmas(aluno);
  const modalidades = getAlunoModalidades(aluno);
  const unidades = getAlunoUnidades(aluno);

  return (
    <PortalAlunoLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Treinos"
          title="Rotina esportiva"
          description="Turmas, modalidades, unidades e horarios reunidos no mesmo padrao visual do admin."
        />

        {loading ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="j12-skeleton h-32" />
              <div className="j12-skeleton h-32" />
              <div className="j12-skeleton h-32" />
              <div className="j12-skeleton h-32" />
            </div>
            <div className="j12-skeleton h-72" />
          </div>
        ) : error || !aluno ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {error || "Nao foi possivel carregar os treinos."}
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <PortalKpiCard
                label="Modalidades"
                value={formatAlunoScope(modalidades)}
                detail="Atividades vinculadas"
                icon={Target}
              />
              <PortalKpiCard
                label="Turmas"
                value={formatAlunoScope(turmas)}
                detail="Grupos de treino"
                icon={Users}
                tone="success"
              />
              <PortalKpiCard
                label="Unidades"
                value={formatAlunoScope(unidades)}
                detail="Locais de treino"
                icon={MapPin}
                tone="warning"
              />
              <PortalKpiCard
                label="Plano"
                value={aluno.plano || "A definir"}
                detail="Plano esportivo"
                icon={Trophy}
              />
            </section>

            <section className="j12-surface p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Grade de treinos</h2>
                  <p className="text-sm text-slate-400">
                    Horarios cadastrados na matricula do aluno.
                  </p>
                </div>
                <Clock3 className="h-5 w-5 text-primary" />
              </div>

              {horarios.length === 0 ? (
                <div className="j12-empty-state p-8 text-center text-slate-300">
                  Nenhum horario de treino cadastrado.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {horarios.map((horario) => (
                    <article key={horario} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                        Treino
                      </p>
                      <h3 className="mt-2 font-bold text-white">{horario}</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {[formatAlunoScope(modalidades), formatAlunoScope(turmas)].join(" | ")}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PortalAlunoLayout>
  );
}
