import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  CreditCard,
  LineChart,
  ShieldCheck,
  Target,
  Trophy,
} from "lucide-react";

import { PortalAlunoLayout } from "@/components/PortalAlunoLayout";
import { PortalHero, PortalKpiCard } from "@/components/shared/PortalPrimitives";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { useDashboardAluno } from "@/hooks/useDashboardAluno";
import { useNotificacoesAluno } from "@/hooks/useNotificacoesAluno";

export const Route = createFileRoute("/portal-aluno/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  return <DashboardContent />;
}

function formatCurrency(value: number | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function performanceLabel(percentual: number) {
  if (percentual >= 85) return "Alta performance";
  if (percentual >= 70) return "Consistente";
  if (percentual > 0) return "Em acompanhamento";
  return "Sem historico";
}

function DashboardContent() {
  const { data, loading, error } = useDashboardAluno();
  const { notificacoes } = useNotificacoesAluno();

  if (loading) {
    return (
      <PortalAlunoLayout>
        <SkeletonDashboard cards={4} panels={2} />
      </PortalAlunoLayout>
    );
  }

  if (error) {
    return (
      <PortalAlunoLayout>
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
          {error}
        </div>
      </PortalAlunoLayout>
    );
  }

  if (!data) {
    return (
      <PortalAlunoLayout>
        <div className="j12-empty-state p-8 text-center text-slate-300">
          Nenhum dado encontrado.
        </div>
      </PortalAlunoLayout>
    );
  }

  const percentual = Number(data.presenca?.percentual || 0);
  const avisosNovos = notificacoes.filter((item) => !item.lida).length;
  const avisosRecentes = notificacoes.slice(0, 3);

  return (
    <PortalAlunoLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Portal do aluno"
          title={`Ola, ${data.nome}`}
          description="Acompanhe rotina, frequencia, financeiro, comunicados e evolucao dentro do mesmo padrao profissional da J12."
        />

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PortalKpiCard
            label="Mensalidade"
            value={formatCurrency(data.financeiro?.mensalidade)}
            detail={data.financeiro?.status || "Status financeiro"}
            icon={CreditCard}
          />
          <PortalKpiCard
            label="Frequencia"
            value={`${percentual}%`}
            detail={`${data.presenca?.presentes || 0} presencas registradas`}
            icon={ShieldCheck}
            tone="success"
          />
          <PortalKpiCard
            label="Plano atual"
            value={data.plano?.nome || "Sem plano"}
            detail="Vinculo esportivo ativo"
            icon={Trophy}
            tone="warning"
          />
          <PortalKpiCard
            label="Avisos"
            value={String(avisosNovos)}
            detail="Comunicados nao lidos"
            icon={Bell}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="j12-surface p-5">
            <LineChart className="mb-4 h-5 w-5 text-primary" />
            <p className="text-sm text-slate-400">Desempenho</p>
            <p className="mt-2 text-lg font-bold text-white">{performanceLabel(percentual)}</p>
          </div>
          <div className="j12-surface p-5">
            <Target className="mb-4 h-5 w-5 text-primary" />
            <p className="text-sm text-slate-400">Proximos treinos</p>
            <p className="mt-2 text-lg font-bold text-white">
              {data.plano?.nome ? "Rotina ativa no plano" : "A definir"}
            </p>
          </div>
          <div className="j12-surface p-5">
            <ShieldCheck className="mb-4 h-5 w-5 text-primary" />
            <p className="text-sm text-slate-400">Evolucao</p>
            <p className="mt-2 text-lg font-bold text-white">
              {percentual >= 75 ? "Boa regularidade" : "Acompanhar frequencia"}
            </p>
          </div>
          <div className="j12-surface p-5">
            <CalendarDays className="mb-4 h-5 w-5 text-primary" />
            <p className="text-sm text-slate-400">Proximos eventos</p>
            <p className="mt-2 text-lg font-bold text-white">Sem eventos publicados</p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <div className="j12-surface p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Rotina do aluno</h2>
                <p className="text-sm text-slate-400">Resumo de treinos, plano e frequencia.</p>
              </div>
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Plano</p>
                <p className="mt-2 font-bold text-white">{data.plano?.nome || "A definir"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Presencas</p>
                <p className="mt-2 font-bold text-white">{data.presenca?.presentes || 0}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Faltas</p>
                <p className="mt-2 font-bold text-white">{data.presenca?.faltas || 0}</p>
              </div>
            </div>
          </div>

          <div className="j12-surface p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
              <Bell className="h-4 w-4 text-primary" />
              Comunicados recentes
            </div>
            <div className="space-y-3">
              {avisosRecentes.length === 0 ? (
                <div className="j12-empty-state p-5 text-sm text-slate-300">
                  Nenhum comunicado recente.
                </div>
              ) : (
                avisosRecentes.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-white">{item.titulo}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-400">{item.mensagem}</p>
                      </div>
                      {!item.lida && (
                        <span className="rounded-full bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
                          Novo
                        </span>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </PortalAlunoLayout>
  );
}
