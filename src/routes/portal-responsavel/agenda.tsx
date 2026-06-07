import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Clock3, MapPin, Users } from "lucide-react";

import { PortalResponsavelLayout } from "@/components/PortalResponsavelLayout";
import { PortalHero, PortalKpiCard } from "@/components/shared/PortalPrimitives";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { useDashboardResponsavel } from "@/hooks/useDashboardResponsavel";
import { useResponsavelAlunos } from "@/hooks/useResponsavelAlunos";

export const Route = createFileRoute("/portal-responsavel/agenda")({
  component: AgendaResponsavelPage,
});

function AgendaResponsavelPage() {
  const { dados, loading, erro } = useDashboardResponsavel();
  const { isFamilyView, selectedStudent } = useResponsavelAlunos();
  const proximasAulas = dados?.proximasAulas || [];

  return (
    <PortalResponsavelLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Agenda"
          title={isFamilyView ? "Agenda da familia" : selectedStudent?.nome || "Agenda"}
          description="Proximas aulas e compromissos esportivos centralizados para acompanhamento familiar."
        />

        {loading ? (
          <SkeletonDashboard cards={3} panels={1} withHero={false} />
        ) : erro ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {erro}
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <PortalKpiCard
                label="Proximos treinos"
                value={String(proximasAulas.length)}
                detail="Aulas no radar"
                icon={CalendarDays}
              />
              <PortalKpiCard
                label="Alunos"
                value={String(dados?.alunos?.length || 0)}
                detail="Vinculos considerados"
                icon={Users}
                tone="success"
              />
              <PortalKpiCard
                label="Unidades"
                value={String(
                  new Set(proximasAulas.map((aula) => aula.unidade).filter(Boolean)).size,
                )}
                detail="Locais envolvidos"
                icon={MapPin}
                tone="warning"
              />
            </section>

            <section className="j12-surface p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Programacao</h2>
                  <p className="text-sm text-slate-400">Aulas programadas por aluno.</p>
                </div>
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>

              {proximasAulas.length === 0 ? (
                <div className="j12-empty-state p-8 text-center text-slate-300">
                  Nenhuma aula programada.
                </div>
              ) : (
                <div className="space-y-3">
                  {proximasAulas.map((aula) => (
                    <article
                      key={`${aula.alunoId}-${aula.turma}-${aula.horario}`}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="font-bold text-white">{aula.alunoNome}</h3>
                          <p className="mt-1 text-sm text-slate-400">
                            {[aula.modalidade, aula.turma, aula.unidade, aula.professor]
                              .filter(Boolean)
                              .join(" | ")}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-bold text-primary">
                          <Clock3 className="h-4 w-4" />
                          {aula.horario || "Horario a definir"}
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
    </PortalResponsavelLayout>
  );
}
