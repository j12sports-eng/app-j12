import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Clock3, History, MapPin, Target } from "lucide-react";

import { PortalAlunoLayout } from "@/components/PortalAlunoLayout";
import { PortalHero, PortalKpiCard } from "@/components/shared/PortalPrimitives";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { usePortalAgenda, type PortalAgendaAula } from "@/lib/aluno-portal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal-aluno/agenda")({
  component: AgendaAlunoPage,
});

function AgendaAlunoPage() {
  const { data: agenda, loading, error } = usePortalAgenda(true);
  const proximasAulas = agenda.proximasAulas || [];
  const eventos = agenda.eventos || [];
  const historico = agenda.historico || [];

  return (
    <PortalAlunoLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Agenda"
          title="Agenda do aluno"
          description="Aulas, detalhes e historico conectados ao modulo Agenda e as presencas do aluno."
        />

        {loading ? (
          <SkeletonDashboard cards={3} panels={2} withHero={false} />
        ) : error ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {error}
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <PortalKpiCard
                label="Aulas"
                value={String(agenda.scheduleCount || agenda.aulas.length)}
                detail={agenda.agendaSource || "Fonte da agenda"}
                icon={CalendarDays}
              />
              <PortalKpiCard
                label="Proximas"
                value={String(proximasAulas.length)}
                detail="Aulas futuras"
                icon={Target}
                tone="success"
              />
              <PortalKpiCard
                label="Historico"
                value={String(historico.length)}
                detail="Registros de presenca"
                icon={History}
                tone="warning"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
              <div className="j12-surface p-5 md:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Proximas aulas</h2>
                    <p className="text-sm text-slate-400">
                      Detalhes de turma, horario, unidade e professor.
                    </p>
                  </div>
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>

                {proximasAulas.length === 0 ? (
                  <div className="j12-empty-state p-8 text-center text-slate-300">
                    Nenhuma aula publicada para este aluno.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {proximasAulas.map((aula) => (
                      <AgendaCard key={aula.id} aula={aula} />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <section className="j12-surface p-5 md:p-6">
                  <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                    <Target className="h-4 w-4 text-primary" />
                    Proximos eventos
                  </div>
                  {eventos.length === 0 ? (
                    <div className="j12-empty-state p-5 text-sm text-slate-300">
                      Nenhum evento publicado.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {eventos.slice(0, 4).map((evento) => (
                        <AgendaCard key={evento.id} aula={evento} compact />
                      ))}
                    </div>
                  )}
                </section>

                <section className="j12-surface p-5 md:p-6">
                  <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                    <History className="h-4 w-4 text-primary" />
                    Historico
                  </div>
                  {historico.length === 0 ? (
                    <div className="j12-empty-state p-5 text-sm text-slate-300">
                      Nenhum historico de aula encontrado.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historico.slice(0, 8).map((item) => (
                        <article
                          key={item.id}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate font-bold text-white">
                                {item.className || "Aula J12"}
                              </h3>
                              <p className="mt-1 text-sm text-slate-400">
                                {[formatDate(item.scheduleDate || item.date), item.modality]
                                  .filter(Boolean)
                                  .join(" | ")}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-xs font-bold",
                                item.present
                                  ? "bg-emerald-500/10 text-emerald-200"
                                  : "bg-red-500/10 text-red-200",
                              )}
                            >
                              {item.present ? "Presente" : "Falta"}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </section>
          </>
        )}
      </div>
    </PortalAlunoLayout>
  );
}

function AgendaCard({ aula, compact = false }: { aula: PortalAgendaAula; compact?: boolean }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-white">
            {aula.className || aula.turmaName || "Aula J12"}
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            {[aula.modality, aula.professorName, aula.unitName].filter(Boolean).join(" | ")}
          </p>
          {!compact && (
            <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {aula.agendaSource || aula.source || "agenda"}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-bold text-primary">
          <Clock3 className="h-4 w-4" />
          {[formatDate(aula.scheduleDate || aula.dayOfWeek), aula.startTime].filter(Boolean).join(" | ")}
        </span>
      </div>
    </article>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
