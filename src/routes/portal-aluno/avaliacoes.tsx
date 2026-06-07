import { createFileRoute } from "@tanstack/react-router";
import { Activity, LineChart, ShieldCheck, Target, TrendingUp } from "lucide-react";

import FrequenciaChart from "@/components/FrequenciaChart";
import { PortalAlunoLayout } from "@/components/PortalAlunoLayout";
import { PortalHero, PortalKpiCard } from "@/components/shared/PortalPrimitives";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { usePresencasAluno } from "@/hooks/usePresencasAluno";

export const Route = createFileRoute("/portal-aluno/avaliacoes")({
  component: AvaliacoesAlunoPage,
});

function performanceLabel(percentual: number) {
  if (percentual >= 85) return "Excelente regularidade";
  if (percentual >= 70) return "Regularidade consistente";
  if (percentual > 0) return "Precisa de acompanhamento";
  return "Sem dados suficientes";
}

function AvaliacoesAlunoPage() {
  const { dados, loading, erro } = usePresencasAluno();
  const percentual = Number(dados?.resumo.percentual_presenca || 0);

  return (
    <PortalAlunoLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Avaliacoes"
          title="Evolucao e desempenho"
          description="Leitura automatica de frequencia e consistencia para acompanhar a jornada esportiva."
        />

        {loading ? (
          <SkeletonDashboard cards={4} panels={2} withHero={false} />
        ) : erro || !dados ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {erro || "Nao foi possivel carregar as avaliacoes."}
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <PortalKpiCard
                label="Desempenho"
                value={performanceLabel(percentual)}
                detail="Classificacao por frequencia"
                icon={TrendingUp}
              />
              <PortalKpiCard
                label="Frequencia"
                value={`${percentual}%`}
                detail="Aproveitamento geral"
                icon={ShieldCheck}
                tone="success"
              />
              <PortalKpiCard
                label="Presencas"
                value={String(dados.resumo.presentes)}
                detail="Treinos realizados"
                icon={Activity}
              />
              <PortalKpiCard
                label="Faltas"
                value={String(dados.resumo.faltas)}
                detail="Ausencias registradas"
                icon={Target}
                tone="warning"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="j12-surface p-5">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Resumo visual</h2>
                    <p className="text-sm text-slate-400">Presencas versus faltas.</p>
                  </div>
                  <LineChart className="h-5 w-5 text-primary" />
                </div>
                <FrequenciaChart
                  presentes={dados.resumo.presentes || 0}
                  faltas={dados.resumo.faltas || 0}
                />
              </div>

              <div className="j12-surface p-5">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-white">Leitura tecnica</h2>
                  <p className="text-sm text-slate-400">
                    Indicadores gerados a partir do historico de presenca.
                  </p>
                </div>
                <div className="space-y-3">
                  <InfoLine label="Regularidade" value={performanceLabel(percentual)} />
                  <InfoLine
                    label="Acompanhamento"
                    value={percentual >= 75 ? "Manter rotina atual" : "Reforcar participacao"}
                  />
                  <InfoLine
                    label="Base de calculo"
                    value={`${dados.resumo.total_aulas} treino(s) registrados`}
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </PortalAlunoLayout>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 font-bold text-white">{value}</p>
    </div>
  );
}
