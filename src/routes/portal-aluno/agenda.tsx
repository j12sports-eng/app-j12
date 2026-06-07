import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Clock3, MapPin, Target } from "lucide-react";

import { PortalAlunoLayout } from "@/components/PortalAlunoLayout";
import { PortalHero, PortalKpiCard } from "@/components/shared/PortalPrimitives";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { usePortalAluno } from "@/lib/aluno-portal";
import {
  formatAlunoScope,
  getAlunoHorarios,
  getAlunoModalidades,
  getAlunoTurmas,
  getAlunoUnidades,
} from "@/lib/alunos-store";

export const Route = createFileRoute("/portal-aluno/agenda")({
  component: AgendaAlunoPage,
});

function AgendaAlunoPage() {
  const { data: aluno, loading, error } = usePortalAluno(true);
  const horarios = getAlunoHorarios(aluno);
  const turmas = getAlunoTurmas(aluno);
  const modalidades = getAlunoModalidades(aluno);
  const unidades = getAlunoUnidades(aluno);

  return (
    <PortalAlunoLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Agenda"
          title="Agenda do aluno"
          description="Proximas atividades e rotina de treino apresentadas no mesmo formato de cards e listas do admin."
        />

        {loading ? (
          <SkeletonDashboard cards={3} panels={1} withHero={false} />
        ) : error || !aluno ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {error || "Nao foi possivel carregar a agenda."}
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <PortalKpiCard
                label="Treinos na agenda"
                value={String(horarios.length)}
                detail="Horarios cadastrados"
                icon={CalendarDays}
              />
              <PortalKpiCard
                label="Turmas"
                value={formatAlunoScope(turmas)}
                detail="Grupos vinculados"
                icon={Target}
                tone="success"
              />
              <PortalKpiCard
                label="Unidades"
                value={formatAlunoScope(unidades)}
                detail="Locais de atividade"
                icon={MapPin}
                tone="warning"
              />
            </section>

            <section className="j12-surface p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Programacao</h2>
                  <p className="text-sm text-slate-400">
                    Lista operacional de horarios vinculados ao aluno.
                  </p>
                </div>
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>

              {horarios.length === 0 ? (
                <div className="j12-empty-state p-8 text-center text-slate-300">
                  Nenhum horario publicado para este aluno.
                </div>
              ) : (
                <div className="space-y-3">
                  {horarios.map((horario) => (
                    <article
                      key={horario}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="font-bold text-white">{formatAlunoScope(modalidades)}</h3>
                          <p className="mt-1 text-sm text-slate-400">
                            {[formatAlunoScope(turmas), formatAlunoScope(unidades)].join(" | ")}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-bold text-primary">
                          <Clock3 className="h-4 w-4" />
                          {horario}
                        </span>
                      </div>
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
