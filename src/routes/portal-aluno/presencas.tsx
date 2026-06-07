import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, ShieldCheck, XCircle } from "lucide-react";

import { PortalAlunoLayout } from "@/components/PortalAlunoLayout";
import { PortalHero, PortalKpiCard } from "@/components/shared/PortalPrimitives";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { usePresencasAluno } from "@/hooks/usePresencasAluno";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal-aluno/presencas")({
  component: PresencasPage,
});

function formatDate(value: string | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function PresencasPage() {
  const { dados, loading, erro } = usePresencasAluno();

  return (
    <PortalAlunoLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Frequencia"
          title="Historico de presencas"
          description="Acompanhe participacao nos treinos, faltas e justificativas usando o mesmo padrao operacional da J12."
        />

        {loading ? (
          <SkeletonDashboard cards={4} panels={1} withHero={false} />
        ) : erro || !dados ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {erro || "Nao foi possivel carregar as presencas."}
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <PortalKpiCard
                label="Frequencia"
                value={`${dados.resumo.percentual_presenca}%`}
                detail="Aproveitamento geral"
                icon={ShieldCheck}
                tone="success"
              />
              <PortalKpiCard
                label="Presentes"
                value={String(dados.resumo.presentes)}
                detail="Treinos realizados"
                icon={CalendarCheck}
              />
              <PortalKpiCard
                label="Faltas"
                value={String(dados.resumo.faltas)}
                detail="Ausencias registradas"
                icon={XCircle}
                tone="danger"
              />
              <PortalKpiCard
                label="Justificadas"
                value={String(dados.resumo.justificadas)}
                detail="Ausencias justificadas"
                icon={ShieldCheck}
                tone="warning"
              />
            </section>

            {dados.presencas.length === 0 ? (
              <div className="j12-empty-state p-8 text-center text-slate-300">
                Nenhuma presenca registrada.
              </div>
            ) : (
              <section className="space-y-3">
                {dados.presencas.map((item) => {
                  const present = item.status === "presente";

                  return (
                    <article
                      key={item.id}
                      className={cn(
                        "rounded-2xl border bg-card p-5 shadow-[var(--shadow-elegant)]",
                        present ? "border-emerald-500/25" : "border-red-500/25",
                      )}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {present ? (
                              <ShieldCheck className="h-5 w-5 text-emerald-200" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-200" />
                            )}
                            <h3 className="truncate text-lg font-bold text-white">
                              {item.turma || "Treino J12"}
                            </h3>
                          </div>
                          {item.observacao && (
                            <p className="mt-2 text-sm text-slate-400">{item.observacao}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-300">
                          <CalendarCheck className="h-4 w-4 text-primary" />
                          {formatDate(item.data_aula)}
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-bold",
                              present
                                ? "bg-emerald-500/10 text-emerald-200"
                                : "bg-red-500/10 text-red-200",
                            )}
                          >
                            {present ? "Presente" : "Falta"}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </PortalAlunoLayout>
  );
}
