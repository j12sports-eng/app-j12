import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarCheck,
  CircleDollarSign,
  Clock3,
  FileSignature,
  GraduationCap,
  LayoutDashboard,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useAlunos } from "@/lib/alunos-store";
import { useContratos } from "@/lib/contratos-store";
import {
  calcStatus,
  formatBRL,
  getValorAtualizado,
  useRecorrenciasFinanceiras,
  useTransacoes,
} from "@/lib/financeiro-store";
import {
  usePortalAluno,
  usePortalContrato,
  usePortalFinanceiro,
  usePortalNotificacoes,
  usePortalPresencas,
} from "@/lib/aluno-portal";
import { getAccessibleClasses } from "@/lib/presenca-access";
import { useSettingsState } from "@/lib/settings/settings-store";
import { useTrialClasses } from "@/lib/trial-classes-store";
import { useTurmas } from "@/lib/turmas-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <RequireAuth>
      <DashboardPage />
    </RequireAuth>
  ),
});

type Tone = "primary" | "success" | "warning" | "destructive" | "neutral";

type Metric = {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
  tone?: Tone;
  to?: string;
};

const adminHeroBackground = {
  backgroundImage:
    "radial-gradient(circle at top left, rgba(28,195,182,0.24), transparent 32%), linear-gradient(135deg, rgba(8,18,31,0.98), rgba(5,12,22,0.96))",
};

const adminHeroGlow = {
  backgroundImage: "radial-gradient(circle at center, rgba(255,255,255,0.08), transparent 68%)",
};

function DashboardPage() {
  const { user, isSelfService } = useAuth();

  if (isSelfService) {
    return <StudentDashboardPage />;
  }

  if (user?.role === "professor") {
    return <ProfessorDashboardPage />;
  }

  return <AdminDashboardPage />;
}

function AdminDashboardPage() {
  const { user } = useAuth();
  const alunos = useAlunos();
  const transacoes = useTransacoes();
  const recorrencias = useRecorrenciasFinanceiras();
  const contratos = useContratos();
  const settings = useSettingsState();
  const turmas = useTurmas();
  const trialClasses = useTrialClasses();

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const todayLabel = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const analytics = useMemo(() => {
    const ativos = alunos.filter((aluno) => aluno.status === "ativo");
    const experimentais = alunos.filter((aluno) => aluno.status === "experimental");
    const matriculasMes = alunos.filter((aluno) => aluno.matriculaEm.slice(0, 7) === currentMonth);
    const aniversariantesHoje = alunos.filter(
      (aluno) => aluno.dataNascimento.slice(5) === todayMMDD(),
    );

    const chargesMonth = transacoes.filter(
      (transacao) => transacao.vencimento.slice(0, 7) === currentMonth,
    );
    const paidMonth = chargesMonth.filter((transacao) => calcStatus(transacao) === "pago");
    const overdue = transacoes.filter((transacao) => calcStatus(transacao) === "vencido");
    const openItems = chargesMonth.filter((transacao) => {
      const status = calcStatus(transacao);
      return status === "pendente" || status === "vencido" || status === "parcial";
    });

    const receivedMonth = paidMonth.reduce((sum, transacao) => sum + transacao.valor, 0);
    const projectedMonth = chargesMonth.reduce(
      (sum, transacao) => sum + getValorAtualizado(transacao),
      0,
    );
    const overdueAmount = overdue.reduce(
      (sum, transacao) => sum + getValorAtualizado(transacao),
      0,
    );
    const openAmount = openItems.reduce((sum, transacao) => sum + getValorAtualizado(transacao), 0);

    const overdueByStudent = Array.from(
      overdue.reduce((map, transacao) => {
        const current = map.get(transacao.alunoId) ?? {
          alunoId: transacao.alunoId,
          alunoNome: transacao.alunoNome,
          total: 0,
          itens: 0,
        };

        current.total += getValorAtualizado(transacao);
        current.itens += 1;
        map.set(transacao.alunoId, current);
        return map;
      }, new Map<string, { alunoId: string; alunoNome: string; total: number; itens: number }>()),
    )
      .map(([, item]) => item)
      .sort((left, right) => right.total - left.total)
      .slice(0, 5);

    const pipeline = {
      agendadas: trialClasses.filter((item) => item.status === "Agendada").length,
      confirmadas: trialClasses.filter((item) => item.status === "Confirmada").length,
      compareceu: trialClasses.filter((item) => item.status === "Compareceu").length,
      convertidas: trialClasses.filter((item) => item.status === "Convertida").length,
    };

    const activeClasses = turmas.filter((turma) => turma.ativa);
    const averageOccupancy =
      activeClasses.length === 0
        ? 0
        : Math.round(
            (activeClasses.reduce((sum, turma) => {
              if (!turma.capacidadeMaxima) return sum;
              return sum + turma.alunoIds.length / turma.capacidadeMaxima;
            }, 0) /
              activeClasses.length) *
              100,
          );

    const attendanceTotal = activeClasses.reduce((sum, turma) => {
      return (
        sum +
        turma.presencas.reduce((classSum, sessao) => {
          return classSum + sessao.registros.length;
        }, 0)
      );
    }, 0);

    const attendancePresent = activeClasses.reduce((sum, turma) => {
      return (
        sum +
        turma.presencas.reduce((classSum, sessao) => {
          return classSum + sessao.registros.filter((registro) => registro.presente).length;
        }, 0)
      );
    }, 0);

    const attendanceRate =
      attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : 0;

    const awaitingContracts = contratos.filter(
      (contrato) => contrato.status === "aguardando_assinatura",
    ).length;
    const draftContracts = contratos.filter((contrato) => contrato.status === "rascunho").length;
    const activeContracts = contratos.filter((contrato) => contrato.status === "ativo").length;

    const activeRecurrences = recorrencias.filter((item) => item.recorrenciaAtiva).length;
    const pausedRecurrences = recorrencias.filter((item) => !item.recorrenciaAtiva).length;

    const nextReceivables = openItems
      .slice()
      .sort((left, right) => left.vencimento.localeCompare(right.vencimento))
      .slice(0, 5);

    const modalityMix = Array.from(
      ativos.reduce((map, aluno) => {
        map.set(aluno.modalidade, (map.get(aluno.modalidade) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    )
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5);

    return {
      ativos,
      experimentais,
      matriculasMes,
      aniversariantesHoje,
      receivedMonth,
      projectedMonth,
      overdueAmount,
      openAmount,
      overdueByStudent,
      pipeline,
      averageOccupancy,
      attendanceRate,
      awaitingContracts,
      draftContracts,
      activeContracts,
      activeClasses,
      activeRecurrences,
      pausedRecurrences,
      nextReceivables,
      modalityMix,
      totalChargesMonth: chargesMonth.length,
    };
  }, [alunos, contratos, currentMonth, recorrencias, transacoes, trialClasses, turmas]);

  const metrics: Metric[] = [
    {
      label: "Base ativa",
      value: String(analytics.ativos.length),
      hint: `${analytics.matriculasMes.length} novas matriculas neste mes`,
      icon: Users,
      tone: "primary",
      to: "/alunos",
    },
    {
      label: "Receita recebida",
      value: formatBRL(analytics.receivedMonth),
      hint: `Meta do mes: ${formatBRL(analytics.projectedMonth)}`,
      icon: TrendingUp,
      tone: "success",
      to: "/financeiro",
    },
    {
      label: "A receber",
      value: formatBRL(analytics.openAmount),
      hint: `${analytics.totalChargesMonth} lancamentos no ciclo atual`,
      icon: CircleDollarSign,
      tone: "warning",
      to: "/financeiro",
    },
    {
      label: "Inadimplencia",
      value: formatBRL(analytics.overdueAmount),
      hint: `${analytics.overdueByStudent.length} aluno(s) no radar prioritario`,
      icon: AlertTriangle,
      tone: analytics.overdueAmount > 0 ? "destructive" : "success",
      to: "/financeiro",
    },
    {
      label: "Assinaturas",
      value: String(analytics.awaitingContracts),
      hint: `${analytics.activeContracts} contratos ativos e ${analytics.draftContracts} rascunhos`,
      icon: FileSignature,
      tone: analytics.awaitingContracts > 0 ? "warning" : "primary",
      to: "/contratos",
    },
    {
      label: "Saude da operacao",
      value: `${analytics.attendanceRate}%`,
      hint: `ocupacao media ${analytics.averageOccupancy}%`,
      icon: CalendarCheck,
      tone: analytics.attendanceRate >= 80 ? "success" : "warning",
      to: "/presenca",
    },
  ];

  const alerts = [
    analytics.overdueAmount > 0
      ? {
          title: "Recuperacao de receita precisa de acao",
          body: `${analytics.overdueByStudent.length} aluno(s) concentram ${formatBRL(analytics.overdueAmount)} em atraso.`,
          tone: "destructive" as Tone,
          to: "/financeiro",
        }
      : null,
    analytics.awaitingContracts > 0
      ? {
          title: "Contratos aguardando assinatura",
          body: `${analytics.awaitingContracts} contrato(s) ainda precisam ser finalizados pelo responsavel.`,
          tone: "warning" as Tone,
          to: "/contratos",
        }
      : null,
    analytics.pausedRecurrences > 0
      ? {
          title: "Recorrencias pausadas",
          body: `${analytics.pausedRecurrences} aluno(s) estao sem emissao automatica de mensalidade.`,
          tone: "primary" as Tone,
          to: "/financeiro",
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; body: string; tone: Tone; to: string }>;

  return (
    <AppShell title="Dashboard">
      <section
        className="relative overflow-hidden rounded-[28px] border border-white/10 p-6 shadow-[0_28px_80px_rgba(2,8,23,0.45)]"
        style={adminHeroBackground}
      >
        <div className="absolute inset-y-0 right-0 hidden w-80 lg:block" style={adminHeroGlow} />
        <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-primary/90">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Operating System
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Cockpit comercial, financeiro e operacional da{" "}
              {settings.general.companyName || "J12 Sports"}.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Tudo o que precisa de decisao hoje esta aqui: captacao, conversao, caixa, assinatura,
              presenca e capacidade da operacao.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/alunos"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Abrir CRM de alunos
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/financeiro"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Acompanhar caixa e cobrancas
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <HeroStat
              label="Receita do mes"
              value={formatBRL(analytics.receivedMonth)}
              hint={`projecao ${formatBRL(analytics.projectedMonth)}`}
            />
            <HeroStat
              label="Pipeline experimental"
              value={String(analytics.pipeline.compareceu + analytics.pipeline.confirmadas)}
              hint={`${analytics.pipeline.convertidas} conversoes em andamento`}
            />
            <HeroStat
              label="Hoje"
              value={todayLabel}
              hint={`${analytics.aniversariantesHoje.length} aniversario(s) e ${analytics.activeClasses.length} turma(s) ativas`}
            />
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="Centro de receita"
          subtitle="Progresso do caixa, recorrencia e riscos financeiros do ciclo atual."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Execucao do mes
              </div>
              <div className="mt-4 space-y-4">
                <ProgressRow
                  label="Recebido"
                  value={formatBRL(analytics.receivedMonth)}
                  progress={ratio(analytics.receivedMonth, analytics.projectedMonth)}
                  tone="success"
                />
                <ProgressRow
                  label="A receber"
                  value={formatBRL(analytics.openAmount)}
                  progress={ratio(analytics.openAmount, analytics.projectedMonth)}
                  tone="warning"
                />
                <ProgressRow
                  label="Vencido"
                  value={formatBRL(analytics.overdueAmount)}
                  progress={ratio(analytics.overdueAmount, analytics.projectedMonth)}
                  tone="destructive"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Motor recorrente
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <CompactStat
                  label="Recorrencias ativas"
                  value={String(analytics.activeRecurrences)}
                />
                <CompactStat
                  label="Recorrencias pausadas"
                  value={String(analytics.pausedRecurrences)}
                />
                <CompactStat label="Contratos ativos" value={String(analytics.activeContracts)} />
                <CompactStat
                  label="Assinaturas pendentes"
                  value={String(analytics.awaitingContracts)}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/40 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Proximos recebimentos</div>
                <div className="text-xs text-slate-400">Fila priorizada por vencimento.</div>
              </div>
              <Link to="/financeiro" className="text-sm font-medium text-primary hover:underline">
                Abrir financeiro
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {analytics.nextReceivables.length === 0 ? (
                <EmptyState message="Nenhuma cobranca em aberto para este mes." />
              ) : (
                analytics.nextReceivables.map((item) => (
                  <ListRow
                    key={item.id}
                    title={item.alunoNome}
                    subtitle={`${item.descricao} · vencimento ${formatDate(item.vencimento)}`}
                    value={formatBRL(getValorAtualizado(item))}
                    tone={calcStatus(item) === "vencido" ? "destructive" : "warning"}
                  />
                ))
              )}
            </div>
          </div>
        </Panel>

        <Panel
          title="Radar de atencao"
          subtitle="Riscos e gargalos que merecem acao rapida da operacao."
        >
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <EmptyState message="Nenhum alerta critico. Operacao estabilizada neste momento." />
            ) : (
              alerts.map((alert) => (
                <Link
                  key={alert.title}
                  to={alert.to}
                  className={cn(
                    "block rounded-3xl border p-4 transition hover:border-primary/30 hover:bg-white/5",
                    panelTone(alert.tone),
                  )}
                >
                  <div className="text-sm font-semibold text-white">{alert.title}</div>
                  <div className="mt-1 text-sm text-slate-300">{alert.body}</div>
                </Link>
              ))
            )}
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">
                  Alunos em maior risco financeiro
                </div>
                <div className="text-xs text-slate-400">Top 5 por valor vencido acumulado.</div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {analytics.overdueByStudent.length === 0 ? (
                <EmptyState message="Nenhum aluno com saldo vencido no momento." />
              ) : (
                analytics.overdueByStudent.map((item) => (
                  <ListRow
                    key={item.alunoId}
                    title={item.alunoNome}
                    subtitle={`${item.itens} cobranca(s) em atraso`}
                    value={formatBRL(item.total)}
                    tone="destructive"
                  />
                ))
              )}
            </div>
          </div>
        </Panel>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <Panel
          title="Pipeline comercial"
          subtitle="Da captacao ate a conversao, com foco no que alimenta a operacao."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <CompactStat
              label="Agendadas"
              value={String(analytics.pipeline.agendadas)}
              tone="primary"
            />
            <CompactStat
              label="Confirmadas"
              value={String(analytics.pipeline.confirmadas)}
              tone="warning"
            />
            <CompactStat
              label="Compareceu"
              value={String(analytics.pipeline.compareceu)}
              tone="success"
            />
            <CompactStat
              label="Convertidas"
              value={String(analytics.pipeline.convertidas)}
              tone="success"
            />
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold text-white">Mix de modalidades</div>
            <div className="mt-4 space-y-3">
              {analytics.modalityMix.length === 0 ? (
                <EmptyState message="Sem massa critica suficiente para o mix ainda." />
              ) : (
                analytics.modalityMix.map(([label, total]) => (
                  <ProgressRow
                    key={label}
                    label={label}
                    value={`${total} aluno(s)`}
                    progress={ratio(total, analytics.ativos.length)}
                    tone="primary"
                  />
                ))
              )}
            </div>
          </div>
        </Panel>

        <Panel
          title="Cockpit operacional"
          subtitle="Capacidade, presenca e governanca do dia a dia."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <CompactStat
              label="Turmas ativas"
              value={String(analytics.activeClasses.length)}
              tone="primary"
            />
            <CompactStat
              label="Ocupacao media"
              value={`${analytics.averageOccupancy}%`}
              tone="success"
            />
            <CompactStat
              label="Aniversarios hoje"
              value={String(analytics.aniversariantesHoje.length)}
              tone="warning"
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
              <div className="text-sm font-semibold text-white">Acoes rapidas</div>
              <div className="mt-4 space-y-3">
                <QuickLink
                  to="/matricula"
                  icon={Users}
                  title="Nova matricula"
                  subtitle="Cadastrar aluno e iniciar onboarding."
                />
                <QuickLink
                  to="/contratos"
                  icon={FileSignature}
                  title="Fechar contratos"
                  subtitle="Destravar assinaturas pendentes."
                />
                <QuickLink
                  to="/aula-experimental"
                  icon={Sparkles}
                  title="Ativar conversoes"
                  subtitle="Mover aulas experimentais para aluno pagante."
                />
                <QuickLink
                  to="/presenca"
                  icon={CalendarCheck}
                  title="Operar presenca"
                  subtitle="Registrar aulas e acompanhar comparecimento."
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">Lembretes de hoje</div>
              <div className="mt-2 text-xs text-slate-400">
                {settings.notifications.birthdayReminderEnabled
                  ? settings.notifications.birthdayReminderMessage
                  : "Lembretes automaticos desativados nas configuracoes."}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {analytics.aniversariantesHoje.length === 0 ? (
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
                    Nenhum aniversario hoje
                  </span>
                ) : (
                  analytics.aniversariantesHoje.map((aluno) => (
                    <span
                      key={aluno.id}
                      className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary"
                    >
                      {aluno.nome}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}

function ProfessorDashboardPage() {
  const { user } = useAuth();
  const turmas = useTurmas();
  const alunos = useAlunos();

  const minhasTurmas = useMemo(() => getAccessibleClasses(user, turmas), [turmas, user]);
  const meusAlunoIds = useMemo(
    () => new Set(minhasTurmas.flatMap((turma) => turma.alunoIds ?? [])),
    [minhasTurmas],
  );
  const meusAlunos = useMemo(
    () => alunos.filter((aluno) => meusAlunoIds.has(aluno.id)),
    [alunos, meusAlunoIds],
  );
  const chamadas = useMemo(
    () => minhasTurmas.reduce((sum, turma) => sum + turma.presencas.length, 0),
    [minhasTurmas],
  );
  const hoje = weekdaySlug(new Date());
  const aulasHoje = minhasTurmas.filter((turma) => turma.diasSemana.includes(hoje));

  return (
    <AppShell title="Dashboard">
      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(6,17,30,0.96),rgba(10,26,43,0.96))] p-6 shadow-[0_24px_70px_rgba(2,8,23,0.38)]">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Professor cockpit
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">
              Rotina de aula, chamada e acompanhamento em um unico painel.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Veja rapidamente suas turmas, quem precisa de atencao hoje e os proximos passos da
              operacao em sala.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/presenca"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Abrir presenca
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/turmas"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Ver minhas turmas
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <HeroStat
              label="Turmas no escopo"
              value={String(minhasTurmas.length)}
              hint="Visao filtrada pelo seu perfil"
            />
            <HeroStat
              label="Aulas hoje"
              value={String(aulasHoje.length)}
              hint="Turmas com encontro previsto no dia"
            />
            <HeroStat
              label="Alunos acompanhados"
              value={String(meusAlunos.length)}
              hint="Somente alunos das suas turmas"
            />
            <HeroStat
              label="Chamadas registradas"
              value={String(chamadas)}
              hint="Historico acumulado de presenca"
            />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <Panel
          title="Agenda do professor"
          subtitle="Turmas priorizadas para o dia e para a semana."
        >
          <div className="space-y-3">
            {(aulasHoje.length > 0 ? aulasHoje : minhasTurmas).slice(0, 6).map((turma) => (
              <ListRow
                key={turma.id}
                title={turma.nome}
                subtitle={`${turma.modalidade} · ${turma.unidade} · ${turma.horarioInicio} - ${turma.horarioFim}`}
                value={`${turma.alunoIds.length} aluno(s)`}
                tone="primary"
              />
            ))}
            {minhasTurmas.length === 0 ? (
              <EmptyState message="Nenhuma turma vinculada ao seu perfil." />
            ) : null}
          </div>
        </Panel>

        <Panel
          title="Base acompanhada"
          subtitle="Lista rapida dos alunos que dependem da sua rotina."
        >
          <div className="space-y-3">
            {meusAlunos.length === 0 ? (
              <EmptyState message="Ainda nao ha alunos vinculados as suas turmas." />
            ) : (
              meusAlunos
                .slice(0, 8)
                .map((aluno) => (
                  <ListRow
                    key={aluno.id}
                    title={aluno.nome}
                    subtitle={`${aluno.modalidade} · ${aluno.turma || "Turma nao definida"}`}
                    value={aluno.status}
                    tone={aluno.status === "ativo" ? "success" : "warning"}
                  />
                ))
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}

function StudentDashboardPage() {
  const portalAluno = usePortalAluno(true);
  const portalFinanceiro = usePortalFinanceiro(true);
  const portalPresencas = usePortalPresencas(true);
  const portalContrato = usePortalContrato(true);
  const portalNotificacoes = usePortalNotificacoes(true);

  if (
    portalAluno.loading ||
    portalFinanceiro.loading ||
    portalPresencas.loading ||
    portalContrato.loading ||
    portalNotificacoes.loading
  ) {
    return (
      <AppShell title="Meu Painel">
        <LoadingState />
      </AppShell>
    );
  }

  if (
    portalAluno.error ||
    portalFinanceiro.error ||
    portalPresencas.error ||
    portalContrato.error ||
    portalNotificacoes.error
  ) {
    return (
      <AppShell title="Meu Painel">
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          {portalAluno.error ||
            portalFinanceiro.error ||
            portalPresencas.error ||
            portalContrato.error ||
            portalNotificacoes.error}
        </div>
      </AppShell>
    );
  }

  const aluno = portalAluno.data;
  const presencas = portalPresencas.data;
  const cobrancas = portalFinanceiro.data;
  const contrato = portalContrato.data;
  const notificacoes = portalNotificacoes.data;

  const pagamentosEmAberto = cobrancas.filter((item) => calcStatus(item) !== "pago");
  const taxaPresenca =
    presencas.length > 0
      ? Math.round((presencas.filter((item) => item.presente).length / presencas.length) * 100)
      : 0;
  const proximaCobranca = pagamentosEmAberto
    .slice()
    .sort((left, right) => left.vencimento.localeCompare(right.vencimento))[0];

  return (
    <AppShell title="Meu Painel">
      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(6,17,30,0.96),rgba(10,26,43,0.96))] p-6 shadow-[0_24px_70px_rgba(2,8,23,0.38)]">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Meu painel
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">
              Acompanhe plano, presenca, notificacoes e mensalidades sem sair do app.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Um espaco simples para consultar sua rotina, conferir avisos e agir rapido quando algo
              precisar de voce.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/financeiro"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Ver financeiro
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/alunos"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Abrir meu perfil
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <HeroStat
              label="Plano atual"
              value={aluno?.plano || "Nao informado"}
              hint={aluno?.modalidade || "Modalidade"}
            />
            <HeroStat
              label="Presenca"
              value={`${taxaPresenca}%`}
              hint={`${presencas.length} aula(s) registradas`}
            />
            <HeroStat
              label="Mensalidades abertas"
              value={String(pagamentosEmAberto.length)}
              hint={
                proximaCobranca
                  ? `proximo vencimento ${formatDate(proximaCobranca.vencimento)}`
                  : "sem pendencias"
              }
            />
            <HeroStat
              label="Avisos nao lidos"
              value={String(notificacoes.filter((item) => !item.lida).length)}
              hint="comunicados recentes do seu painel"
            />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel title="Resumo do aluno" subtitle="Informacoes sincronizadas com o seu cadastro.">
          <div className="grid gap-3 md:grid-cols-2">
            <InfoPill label="Nome" value={aluno?.nome || "-"} />
            <InfoPill label="Responsavel" value={aluno?.responsavel || "-"} />
            <InfoPill label="Turma" value={aluno?.turma || "-"} />
            <InfoPill label="Plano" value={aluno?.plano || "-"} />
          </div>
          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            {contrato
              ? `Contrato disponivel: ${contrato.titulo} com status ${contrato.status}.`
              : "Nenhum contrato disponivel para leitura neste momento."}
          </div>
        </Panel>

        <Panel title="Agenda de atencao" subtitle="Pendencias e comunicados mais recentes.">
          <div className="space-y-3">
            {notificacoes.length === 0 ? (
              <EmptyState message="Nenhuma notificacao recente no momento." />
            ) : (
              notificacoes
                .slice(0, 4)
                .map((item) => (
                  <ListRow
                    key={item.id}
                    title={item.titulo}
                    subtitle={item.mensagem}
                    value={item.lida ? "Lida" : "Nova"}
                    tone={item.lida ? "neutral" : "warning"}
                  />
                ))
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  const content = (
    <div className="h-full rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(8,15,29,0.96))] p-5 shadow-[0_16px_50px_rgba(2,8,23,0.18)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/25">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-400">{metric.label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
            {metric.value}
          </div>
        </div>
        <div className={cn("rounded-2xl p-3", toneClasses(metric.tone))}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 text-xs leading-5 text-slate-400">{metric.hint}</div>
    </div>
  );

  return metric.to ? (
    <Link to={metric.to} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(8,15,29,0.96))] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.22)]">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function HeroStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-xs text-slate-400">{hint}</div>
    </div>
  );
}

function CompactStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <div className={cn("rounded-3xl border p-4", panelTone(tone))}>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  progress,
  tone = "primary",
}: {
  label: string;
  value: string;
  progress: number;
  tone?: Tone;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-slate-400">{value}</div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full", progressTone(tone))}
          style={{ width: `${Math.max(6, Math.round(progress * 100))}%` }}
        />
      </div>
    </div>
  );
}

function ListRow({
  title,
  subtitle,
  value,
  tone = "neutral",
}: {
  title: string;
  subtitle: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-white">{title}</div>
        <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
      </div>
      <span
        className={cn(
          "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium",
          pillTone(tone),
        )}
      >
        {value}
      </span>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  subtitle,
}: {
  to: string;
  icon: typeof Users;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-primary/25 hover:bg-white/10"
    >
      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
      </div>
    </Link>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
      {message}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function toneClasses(tone: Tone = "primary") {
  switch (tone) {
    case "success":
      return "bg-emerald-500/15 text-emerald-300";
    case "warning":
      return "bg-amber-500/15 text-amber-200";
    case "destructive":
      return "bg-rose-500/15 text-rose-200";
    case "neutral":
      return "bg-white/10 text-slate-200";
    default:
      return "bg-primary/15 text-primary";
  }
}

function pillTone(tone: Tone = "neutral") {
  switch (tone) {
    case "success":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "warning":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "destructive":
      return "border-rose-500/30 bg-rose-500/10 text-rose-200";
    case "primary":
      return "border-primary/30 bg-primary/10 text-primary";
    default:
      return "border-white/10 bg-white/5 text-slate-200";
  }
}

function panelTone(tone: Tone = "neutral") {
  switch (tone) {
    case "success":
      return "border-emerald-500/20 bg-emerald-500/8";
    case "warning":
      return "border-amber-500/20 bg-amber-500/8";
    case "destructive":
      return "border-rose-500/20 bg-rose-500/8";
    case "primary":
      return "border-primary/20 bg-primary/8";
    default:
      return "border-white/10 bg-white/5";
  }
}

function progressTone(tone: Tone = "primary") {
  switch (tone) {
    case "success":
      return "bg-emerald-400";
    case "warning":
      return "bg-amber-300";
    case "destructive":
      return "bg-rose-300";
    case "neutral":
      return "bg-slate-300";
    default:
      return "bg-primary";
  }
}

function ratio(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, value / total));
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function todayMMDD() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function weekdaySlug(date: Date) {
  const weekdays = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
  return weekdays[date.getDay()];
}
