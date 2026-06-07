import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  CreditCard,
  MessageSquareText,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";

import FrequenciaChart from "@/components/FrequenciaChart";
import { PortalResponsavelLayout } from "@/components/PortalResponsavelLayout";
import { StudentProfileSummaryCard } from "@/components/portal-responsavel/StudentProfileSummaryCard";
import { PortalHero, PortalKpiCard } from "@/components/shared/PortalPrimitives";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { useDashboardResponsavel } from "@/hooks/useDashboardResponsavel";

export const Route = createFileRoute("/portal-responsavel/dashboard")({
  component: DashboardResponsavelPage,
});

function formatCurrency(value: number | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function DashboardSkeleton() {
  return (
    <PortalResponsavelLayout>
      <SkeletonDashboard cards={4} panels={2} />
    </PortalResponsavelLayout>
  );
}

function DashboardResponsavelPage() {
  const { dados, loading, erro } = useDashboardResponsavel();

  if (loading) return <DashboardSkeleton />;

  if (erro) {
    return (
      <PortalResponsavelLayout>
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
          {erro}
        </div>
      </PortalResponsavelLayout>
    );
  }

  if (!dados) {
    return (
      <PortalResponsavelLayout>
        <div className="j12-empty-state p-8 text-center text-slate-300">
          Nenhum dado encontrado para este responsavel.
        </div>
      </PortalResponsavelLayout>
    );
  }

  const title = dados.familia ? "Familia completa" : dados.aluno?.nome || "Aluno";
  const totalAlunos = dados.alunos?.length || 0;
  const notificacoes = dados.notificacoes || [];
  const proximasAulas = dados.proximasAulas || [];
  const alunos = dados.alunos || [];

  return (
    <PortalResponsavelLayout>
      <div className="j12-page-enter space-y-8">
        <PortalHero eyebrow="Visao familiar" title={title}>
          <div className="mt-4 flex flex-wrap gap-2">
            {alunos.map((aluno) => (
              <span
                key={aluno.id}
                className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-semibold text-slate-200"
              >
                {[aluno.nome, aluno.modalidade, aluno.turma].filter(Boolean).join(" | ")}
              </span>
            ))}
          </div>
        </PortalHero>

        <section className={alunos.length > 1 ? "grid gap-4 xl:grid-cols-2" : ""}>
          {alunos.map((aluno) => (
            <StudentProfileSummaryCard
              key={aluno.id}
              student={{
                id: aluno.id,
                nome: aluno.nome,
                modalidade: aluno.modalidade,
                categoria: aluno.categoria || aluno.plano,
                turma: aluno.turma,
                professor: aluno.professor,
                status: aluno.status,
              }}
            />
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PortalKpiCard label="Alunos" value={String(totalAlunos || 1)} icon={Users} />
          <PortalKpiCard
            label="Presenca"
            value={`${dados.presenca?.percentual || 0}%`}
            icon={ShieldCheck}
            tone="success"
          />
          <PortalKpiCard
            label="Em aberto"
            value={formatCurrency(dados.financeiro?.totalAberto ?? dados.financeiro?.mensalidade)}
            icon={CreditCard}
            tone="warning"
          />
          <PortalKpiCard
            label="Pendencias"
            value={String(dados.financeiro?.pendentes || 0)}
            icon={Bell}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="j12-surface p-5">
            <Trophy className="mb-4 h-5 w-5 text-primary" />
            <p className="text-sm text-zinc-400">Status da matricula</p>
            <p className="mt-2 text-lg font-black text-white">
              {alunos.length === 1
                ? alunos[0]?.status || "ativo"
                : `${alunos.length} vinculos ativos`}
            </p>
          </div>
          <div className="j12-surface p-5">
            <CalendarDays className="mb-4 h-5 w-5 text-primary" />
            <p className="text-sm text-zinc-400">Calendario</p>
            <p className="mt-2 text-lg font-black text-white">
              {proximasAulas.length > 0
                ? `${proximasAulas.length} aula(s) no radar`
                : "Sem aulas programadas"}
            </p>
          </div>
          <div className="j12-surface p-5">
            <MessageSquareText className="mb-4 h-5 w-5 text-primary" />
            <p className="text-sm text-zinc-400">Mensagens recentes</p>
            <p className="mt-2 text-lg font-black text-white">
              {notificacoes.length > 0
                ? `${notificacoes.length} aviso(s)`
                : "Nenhuma mensagem nova"}
            </p>
          </div>
          <div className="j12-surface p-5">
            <ShieldCheck className="mb-4 h-5 w-5 text-primary" />
            <p className="text-sm text-zinc-400">Desempenho resumido</p>
            <p className="mt-2 text-lg font-black text-white">
              {(dados.presenca?.percentual || 0) >= 75
                ? "Frequencia consistente"
                : "Acompanhar presenca"}
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="j12-surface p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-white">Frequencia</h3>
                <p className="text-sm text-zinc-400">
                  {dados.presenca?.presentes || 0} presencas e {dados.presenca?.faltas || 0} faltas
                </p>
              </div>
              <span className="j12-icon-chip h-10 w-10">
                <ShieldCheck className="h-5 w-5" />
              </span>
            </div>
            <FrequenciaChart
              presentes={dados.presenca?.presentes || 0}
              faltas={dados.presenca?.faltas || 0}
            />
          </div>

          <div className="space-y-6">
            <div className="j12-surface p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <CalendarDays className="h-4 w-4 text-primary" />
                Proximas aulas
              </div>
              <div className="space-y-3">
                {proximasAulas.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma aula programada.</p>
                ) : (
                  proximasAulas.slice(0, 4).map((aula) => (
                    <div
                      key={`${aula.alunoId}-${aula.turma}-${aula.horario}`}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="font-bold text-white">{aula.alunoNome}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {[aula.modalidade, aula.turma, aula.horario].filter(Boolean).join(" | ")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="j12-surface p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <Bell className="h-4 w-4 text-primary" />
                Avisos recentes
              </div>
              <div className="space-y-3">
                {notificacoes.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma notificacao recente.</p>
                ) : (
                  notificacoes.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-bold text-white">{item.titulo}</div>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                            {item.mensagem}
                          </p>
                        </div>
                        {!item.lida && (
                          <span className="rounded-full bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
                            Nova
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </PortalResponsavelLayout>
  );
}
