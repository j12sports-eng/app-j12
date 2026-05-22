import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Clock3,
  CreditCard,
  FileText,
  Gauge,
  GraduationCap,
  MapPin,
  Plus,
  ShieldAlert,
  Sparkles,
  Target,
  Trophy,
  UserPlus,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useFinanceiroAdmin, type Mensalidade } from "@/hooks/useFinanceiroAdmin";
import { useAuth } from "@/lib/auth";
import { useAlunos, useAlunosLoading, type Aluno } from "@/lib/alunos-store";
import { useProfessores, useProfessoresStatus, type Professor } from "@/lib/professores-store";
import { useTrialClasses, useTrialClassesStatus } from "@/lib/trial-classes-store";
import { useTurmas, useTurmasStatus, type DiaSemana, type Turma } from "@/lib/turmas-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

type AgendaFilter = "hoje" | "semana" | "arena" | "escola";
type Tone = "primary" | "success" | "warning" | "danger" | "info";

type AgendaItem = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  time: string;
  type: "aula" | "arena" | "experimental" | "aniversario";
  status: string;
  dayIndex: number;
};

type AlertItem = {
  id: string;
  title: string;
  description: string;
  priority: "critico" | "atencao" | "info" | "ok";
  badge: string;
  action: string;
  to: string;
  icon: LucideIcon;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const DIA_KEYS: DiaSemana[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const DIA_LABELS: Record<DiaSemana, string> = {
  seg: "Seg",
  ter: "Ter",
  qua: "Qua",
  qui: "Qui",
  sex: "Sex",
  sab: "Sab",
  dom: "Dom",
};

const CHART_COLORS = ["#ff4500", "#22c55e", "#f59e0b", "#38bdf8", "#a855f7", "#ef4444"];

function DashboardPage() {
  const { role } = useAuth();

  let destination = "/portal-aluno/dashboard";

  if (role === "professor") {
    destination = "/professor/presencas";
  } else if (role === "responsavel") {
    destination = "/portal-responsavel/dashboard";
  }

  return (
    <ProtectedRoute>
      {role === "admin" || role === "coordenador" ? (
        <ExecutiveDashboard />
      ) : (
        <Navigate to={destination} />
      )}
    </ProtectedRoute>
  );
}

function ExecutiveDashboard() {
  const alunos = useAlunos();
  const alunosLoading = useAlunosLoading();
  const turmas = useTurmas();
  const turmasStatus = useTurmasStatus();
  const professores = useProfessores();
  const professoresStatus = useProfessoresStatus();
  const trialClasses = useTrialClasses();
  const trialClassesStatus = useTrialClassesStatus();
  const financeiro = useFinanceiroAdmin();
  const [agendaFilter, setAgendaFilter] = useState<AgendaFilter>("hoje");

  const data = useMemo(
    () =>
      buildDashboardData({
        alunos,
        turmas,
        professores,
        mensalidades: financeiro.mensalidades,
        trialClasses,
      }),
    [alunos, financeiro.mensalidades, professores, trialClasses, turmas],
  );

  const loading =
    financeiro.loading ||
    alunosLoading ||
    turmasStatus.loading ||
    professoresStatus.loading ||
    trialClassesStatus.loading;

  const isInitialLoading =
    loading && alunos.length === 0 && turmas.length === 0 && financeiro.mensalidades.length === 0;

  if (isInitialLoading) {
    return <DashboardSkeleton />;
  }

  const agendaItems = filterAgenda(data.agenda, agendaFilter);

  return (
    <AppShell title="Dashboard Executivo J12" contentClassName="mx-auto max-w-[1600px] space-y-6">
      <section className="overflow-hidden rounded-3xl border border-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(255,69,0,0.22),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.36)] md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Visao executiva
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-white md:text-4xl">
              Operacao, crescimento e rotina da J12 em um unico painel.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
              Indicadores de escola, arena, presenca, alertas e crescimento. O financeiro aparece
              aqui apenas como sinal executivo, sem repetir a central financeira.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[440px]">
            <HeroPulse label="Operacao hoje" value={`${data.todayClasses.length} aulas`} />
            <HeroPulse label="Alertas ativos" value={`${data.alerts.length}`} tone="warning" />
            <HeroPulse label="Saude geral" value={`${data.healthScore}%`} tone="success" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.executiveCards.map((card) => (
          <ExecutiveCard key={card.title} {...card} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <SectionHeader
            eyebrow="Operacao diaria"
            title="Agenda do Dia"
            description="Aulas, arena, aniversarios e aulas experimentais em formato de timeline."
            icon={CalendarDays}
          />

          <div className="mt-5 flex flex-wrap gap-2">
            {[
              ["hoje", "Hoje"],
              ["semana", "Semana"],
              ["arena", "Arena"],
              ["escola", "Escola"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setAgendaFilter(value as AgendaFilter)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition",
                  agendaFilter === value
                    ? "border-primary/50 bg-primary text-black shadow-[0_0_22px_rgba(255,69,0,0.25)]"
                    : "border-white/10 bg-white/5 text-slate-400 hover:border-primary/30 hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {agendaItems.length > 0 ? (
              agendaItems.slice(0, 7).map((item) => <AgendaRow key={item.id} item={item} />)
            ) : (
              <EmptyState
                icon={CalendarCheck}
                title="Nenhum compromisso encontrado"
                description="A agenda aparece aqui assim que houver turmas, reservas ou aulas experimentais no periodo."
              />
            )}
          </div>
        </Panel>

        <Panel>
          <SectionHeader
            eyebrow="Inteligencia operacional"
            title="Alertas Importantes"
            description="Prioridades que exigem acao rapida da equipe."
            icon={ShieldAlert}
          />

          <div className="mt-5 space-y-3">
            {data.alerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel>
          <SectionHeader
            eyebrow="Performance"
            title="Indicadores de Performance"
            description="Crescimento de alunos, receita executiva e presenca mensal."
            icon={BarChart3}
          />
          <div className="mt-5 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.performanceSeries}>
                <defs>
                  <linearGradient id="studentsGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#ff4500" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#ff4500" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="presenceGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} width={34} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="alunos"
                  name="Novos alunos"
                  stroke="#ff4500"
                  fill="url(#studentsGradient)"
                  strokeWidth={3}
                />
                <Area
                  type="monotone"
                  dataKey="presenca"
                  name="Presenca media"
                  stroke="#22c55e"
                  fill="url(#presenceGradient)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <SectionHeader
            eyebrow="Receita resumida"
            title="Receita por Categoria"
            description="Apenas leitura executiva; detalhes ficam no Financeiro."
            icon={Wallet}
          />
          <div className="mt-5 grid gap-5 sm:grid-cols-[0.85fr_1fr] xl:grid-cols-1 2xl:grid-cols-[0.85fr_1fr]">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.revenueByCategory}
                    dataKey="valor"
                    nameKey="label"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={4}
                  >
                    {data.revenueByCategory.map((entry, index) => (
                      <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip moneyValues />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {data.revenueByCategory.map((item, index) => (
                <CompactMetric
                  key={item.label}
                  label={item.label}
                  value={money(item.valor)}
                  color={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <SectionHeader
            eyebrow="Crescimento"
            title="Crescimento do Negocio"
            description="Novos alunos, renovacao, metas e modalidades mais procuradas."
            icon={Target}
          />

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <GoalCard
              label="Novos alunos"
              value={data.newStudentsMonth}
              goal={data.studentGoal}
              suffix="mes"
              tone="primary"
            />
            <GoalCard
              label="Taxa de retencao"
              value={data.retentionRate}
              goal={90}
              suffix="%"
              tone="success"
            />
            <GoalCard
              label="Ocupacao semanal"
              value={data.weeklyArenaOccupation}
              goal={80}
              suffix="%"
              tone="warning"
            />
          </div>

          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.growthBars}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} width={34} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Alunos" radius={[10, 10, 0, 0]} fill="#ff4500" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <SectionHeader
            eyebrow="Demanda"
            title="Categorias mais procuradas"
            description="Modalidades com maior base ativa."
            icon={Trophy}
          />
          <div className="mt-5 space-y-4">
            {data.topModalities.map((item) => (
              <ProgressLine
                key={item.label}
                label={item.label}
                value={item.value}
                max={data.activeStudents}
              />
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel>
          <SectionHeader
            eyebrow="Arena"
            title="Ocupacao da Arena"
            description="Mapa semanal compacto de horarios ocupados e livres."
            icon={MapPin}
          />

          <div className="mt-5 grid grid-cols-7 gap-2">
            {data.arenaCalendar.map((day) => (
              <div key={day.key} className="rounded-2xl border border-white/10 bg-black/25 p-2">
                <div className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {day.label}
                </div>
                <div className="space-y-1.5">
                  {day.slots.map((slot) => (
                    <div
                      key={slot.hour}
                      className={cn(
                        "h-7 rounded-lg border text-center text-[10px] font-bold leading-7 transition",
                        slot.occupied
                          ? "border-primary/35 bg-primary/15 text-primary"
                          : "border-white/8 bg-white/[0.03] text-slate-500",
                      )}
                    >
                      {slot.hour}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <SmallStat label="Taxa hoje" value={`${data.dailyArenaOccupation}%`} icon={Gauge} />
            <SmallStat label="Reservas hoje" value={data.arenaReservationsToday} icon={Clock3} />
            <SmallStat
              label="Livre semana"
              value={`${100 - data.weeklyArenaOccupation}%`}
              icon={BadgeCheck}
            />
          </div>
        </Panel>

        <Panel>
          <SectionHeader
            eyebrow="Presenca"
            title="Controle de Presenca"
            description="Media geral, ausencias, ranking e turmas com risco."
            icon={CalendarCheck}
          />

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <PresenceHero value={data.presenceRate} />
            <SmallStat
              label="Ausentes hoje"
              value={data.absentToday}
              icon={AlertTriangle}
              tone="warning"
            />
            <SmallStat
              label="Turmas em risco"
              value={data.lowPresenceTurmas.length}
              icon={ShieldAlert}
              tone="danger"
            />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">
                Frequencia por turma
              </h3>
              <div className="mt-3 space-y-3">
                {data.presenceByClass.slice(0, 5).map((item) => (
                  <ProgressLine
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    max={100}
                    suffix="%"
                  />
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">
                Faltas consecutivas
              </h3>
              <div className="mt-3 space-y-2">
                {data.consecutiveAbsences.length > 0 ? (
                  data.consecutiveAbsences.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5"
                    >
                      <span className="truncate text-sm font-semibold text-white">{item.name}</span>
                      <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-200">
                        {item.absences} faltas
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                    Nenhum padrao critico de faltas consecutivas encontrado.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Panel>
      </section>

      <Panel>
        <SectionHeader
          eyebrow="Atalhos"
          title="Acoes Rapidas"
          description="Caminhos curtos para operar a rotina sem sair do painel executivo."
          icon={Zap}
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <QuickAction to="/alunos" label="Novo aluno" icon={UserPlus} />
          <QuickAction to="/admin/financeiro" label="Nova cobranca" icon={CreditCard} />
          <QuickAction to="/presencas" label="Registrar presenca" icon={CalendarCheck} />
          <QuickAction to="/turmas" label="Criar turma" icon={GraduationCap} />
          <QuickAction to="/turmas" label="Agendar arena" icon={MapPin} />
          <QuickAction to="/admin/financeiro" label="Gerar relatorio" icon={FileText} />
          <QuickAction to="/aula-experimental" label="Aula experimental" icon={Sparkles} />
        </div>
      </Panel>
    </AppShell>
  );
}

function buildDashboardData({
  alunos,
  turmas,
  professores,
  mensalidades,
  trialClasses,
}: {
  alunos: Aluno[];
  turmas: Turma[];
  professores: Professor[];
  mensalidades: Mensalidade[];
  trialClasses: Array<{
    id: string;
    studentName: string;
    date: string;
    time: string;
    professor: string;
    modality: string;
    unit: string;
    status: string;
  }>;
}) {
  const now = new Date();
  const todayIso = toDateInput(now);
  const todayKey = DIA_KEYS[now.getDay()];
  const activeStudents = alunos.filter((aluno) => normalizeText(aluno.status) === "ativo").length;
  const experimentalStudents = alunos.filter(
    (aluno) => normalizeText(aluno.status) === "experimental",
  ).length;
  const newStudentsMonth = alunos.filter((aluno) =>
    isCurrentMonth(readAlunoCreatedAt(aluno), now),
  ).length;
  const paidMonth = mensalidades
    .filter(
      (item) =>
        isPaidStatus(item.status) &&
        isCurrentMonth(item.data_pagamento || item.pago_em || item.data_vencimento, now),
    )
    .reduce((total, item) => total + Number(item.valor_atualizado || 0), 0);
  const overdue = mensalidades.filter((item) => isOverdueStatus(item.status));
  const overdueValue = overdue.reduce(
    (total, item) => total + Number(item.valor_atualizado || 0),
    0,
  );
  const dueSoon = mensalidades.filter(
    (item) => isPendingStatus(item.status) && isWithinNextDays(item.data_vencimento, now, 7),
  );
  const todayClasses = turmas.filter((turma) => turma.ativa && turma.diasSemana.includes(todayKey));
  const trialToday = trialClasses.filter((item) => item.date === todayIso);
  const presenceStats = buildPresenceStats(turmas, alunos, todayIso);
  const dailyArenaOccupation = calculateArenaOccupation(turmas, trialClasses, todayKey, todayIso);
  const weeklyArenaOccupation = calculateWeeklyArenaOccupation(turmas, trialClasses);
  const retentionRate = alunos.length > 0 ? Math.round((activeStudents / alunos.length) * 100) : 0;
  const healthScore = Math.round(
    clamp(
      (presenceStats.rate + retentionRate + (100 - Math.min(100, overdue.length * 4))) / 3,
      0,
      100,
    ),
  );

  const agenda = buildAgenda(turmas, alunos, trialClasses, todayIso, todayKey);
  const alerts = buildAlerts({
    overdue,
    dueSoon,
    todayClasses,
    trialToday,
    lowPresenceTurmas: presenceStats.lowPresenceTurmas,
    professores,
    todayIso,
  });

  const performanceSeries = buildPerformanceSeries(alunos, mensalidades, turmas, now);
  const revenueByCategory = buildRevenueByCategory(mensalidades);
  const topModalities = buildTopModalities(alunos);
  const arenaCalendar = buildArenaCalendar(turmas, trialClasses);

  return {
    activeStudents,
    newStudentsMonth,
    todayClasses,
    alerts,
    healthScore,
    presenceRate: presenceStats.rate,
    absentToday: presenceStats.absentToday,
    lowPresenceTurmas: presenceStats.lowPresenceTurmas,
    presenceByClass: presenceStats.byClass,
    consecutiveAbsences: presenceStats.consecutiveAbsences,
    dailyArenaOccupation,
    weeklyArenaOccupation,
    arenaReservationsToday: countArenaReservations(turmas, trialClasses, todayKey, todayIso),
    studentGoal: Math.max(12, Math.ceil((newStudentsMonth || 1) * 1.35)),
    retentionRate,
    performanceSeries,
    revenueByCategory,
    growthBars: topModalities.slice(0, 6).map((item) => ({ label: item.label, value: item.value })),
    topModalities,
    arenaCalendar,
    agenda,
    executiveCards: [
      {
        title: "Alunos ativos",
        value: numberFormatter.format(activeStudents),
        subtitle: `${experimentalStudents} em periodo experimental`,
        change: `+${newStudentsMonth} este mes`,
        trend: "up" as const,
        icon: Users,
        tone: "primary" as Tone,
      },
      {
        title: "Receita do mes",
        value: money(paidMonth),
        subtitle: "Recebido confirmado no periodo",
        change: buildRevenueChange(performanceSeries),
        trend: "up" as const,
        icon: Wallet,
        tone: "success" as Tone,
      },
      {
        title: "Inadimplencia",
        value: money(overdueValue),
        subtitle: `${overdue.length} cobrancas vencidas`,
        change: overdue.length > 0 ? "acao imediata" : "sem atraso critico",
        trend: overdue.length > 0 ? ("down" as const) : ("up" as const),
        icon: ShieldAlert,
        tone: overdue.length > 0 ? ("danger" as Tone) : ("success" as Tone),
      },
      {
        title: "Aulas do dia",
        value: numberFormatter.format(todayClasses.length),
        subtitle: `${professores.filter((item) => item.status === "ativo").length} professores ativos`,
        change: `${trialToday.length} experimentais`,
        trend: "up" as const,
        icon: CalendarCheck,
        tone: "info" as Tone,
      },
      {
        title: "Ocupacao arena",
        value: `${dailyArenaOccupation}%`,
        subtitle: "Uso previsto para hoje",
        change: `${weeklyArenaOccupation}% na semana`,
        trend: dailyArenaOccupation >= 70 ? ("up" as const) : ("neutral" as const),
        icon: Gauge,
        tone: "warning" as Tone,
      },
      {
        title: "Novos alunos",
        value: numberFormatter.format(newStudentsMonth),
        subtitle: "Matriculas no mes atual",
        change: `${retentionRate}% retencao`,
        trend: "up" as const,
        icon: UserPlus,
        tone: "primary" as Tone,
      },
      {
        title: "Presenca media",
        value: `${presenceStats.rate}%`,
        subtitle: "Base nas chamadas registradas",
        change: presenceStats.rate >= 85 ? "+ desempenho" : "monitorar turmas",
        trend: presenceStats.rate >= 75 ? ("up" as const) : ("down" as const),
        icon: Activity,
        tone: presenceStats.rate >= 75 ? ("success" as Tone) : ("warning" as Tone),
      },
      {
        title: "Proximos vencimentos",
        value: numberFormatter.format(dueSoon.length),
        subtitle: "Cobrancas nos proximos 7 dias",
        change: dueSoon.length > 0 ? "acompanhar" : "agenda limpa",
        trend: dueSoon.length > 0 ? ("neutral" as const) : ("up" as const),
        icon: Clock3,
        tone: "info" as Tone,
      },
    ],
  };
}

function buildAgenda(
  turmas: Turma[],
  alunos: Aluno[],
  trialClasses: Array<{
    id: string;
    studentName: string;
    date: string;
    time: string;
    professor: string;
    modality: string;
    unit: string;
    status: string;
  }>,
  todayIso: string,
  todayKey: DiaSemana,
): AgendaItem[] {
  const todayDayIndex = DIA_KEYS.indexOf(todayKey);
  const classItems = turmas
    .filter((turma) => turma.ativa)
    .flatMap((turma) =>
      turma.diasSemana.map((dia) => ({
        id: `turma-${turma.id}-${dia}`,
        title: turma.nome || "Turma sem nome",
        detail: `${turma.modalidade || "Modalidade"} com ${turma.professor || "professor a definir"}`,
        meta: turma.unidade || "Escola J12",
        time: turma.horarioInicio || "00:00",
        type: isArenaText(turma.unidade) || isArenaText(turma.nome) ? "arena" : "aula",
        status: dia === todayKey ? "Hoje" : DIA_LABELS[dia],
        dayIndex: DIA_KEYS.indexOf(dia),
      })),
    );

  const trialItems = trialClasses.map((item) => {
    const date = parseDate(item.date);
    return {
      id: `trial-${item.id}`,
      title: `Aula experimental - ${item.studentName}`,
      detail: `${item.modality || "Modalidade"} com ${item.professor || "professor a definir"}`,
      meta: item.unit || "Escola J12",
      time: item.time || "00:00",
      type: "experimental" as const,
      status: item.status || "Agendada",
      dayIndex: date ? date.getDay() : todayDayIndex,
    };
  });

  const birthdays = alunos
    .filter((aluno) => isBirthdayToday(aluno.dataNascimento, todayIso))
    .map((aluno) => ({
      id: `birthday-${aluno.id}`,
      title: `Aniversario - ${aluno.nome}`,
      detail: aluno.turma || aluno.modalidade || "Aluno J12",
      meta: "Relacionamento",
      time: "Hoje",
      type: "aniversario" as const,
      status: "Parabenizar",
      dayIndex: todayDayIndex,
    }));

  return [...classItems, ...trialItems, ...birthdays].sort((left, right) => {
    if (left.dayIndex !== right.dayIndex) return left.dayIndex - right.dayIndex;
    return left.time.localeCompare(right.time);
  });
}

function filterAgenda(items: AgendaItem[], filter: AgendaFilter) {
  const todayIndex = new Date().getDay();
  if (filter === "hoje") return items.filter((item) => item.dayIndex === todayIndex);
  if (filter === "arena") return items.filter((item) => item.type === "arena");
  if (filter === "escola")
    return items.filter((item) => item.type === "aula" || item.type === "experimental");
  return items;
}

function buildAlerts({
  overdue,
  dueSoon,
  todayClasses,
  trialToday,
  lowPresenceTurmas,
  professores,
  todayIso,
}: {
  overdue: Mensalidade[];
  dueSoon: Mensalidade[];
  todayClasses: Turma[];
  trialToday: unknown[];
  lowPresenceTurmas: Array<{ label: string; value: number }>;
  professores: Professor[];
  todayIso: string;
}): AlertItem[] {
  const missingCalls = todayClasses.filter(
    (turma) => !turma.presencas.some((sessao) => sessao.data === todayIso),
  );
  const contracts = professores.filter((professor) =>
    ["expirado", "pendente de assinatura"].includes(normalizeText(professor.contrato?.status)),
  );
  const alerts: AlertItem[] = [];

  if (overdue.length > 0) {
    alerts.push({
      id: "overdue",
      title: "Mensalidades vencidas",
      description: `${overdue.length} cobrancas precisam de acao da equipe financeira.`,
      priority: "critico",
      badge: "Urgente",
      action: "Abrir financeiro",
      to: "/admin/financeiro",
      icon: ShieldAlert,
    });
  }

  if (missingCalls.length > 0) {
    alerts.push({
      id: "missing-calls",
      title: "Chamadas pendentes",
      description: `${missingCalls.length} turma(s) de hoje ainda sem presenca lancada.`,
      priority: "atencao",
      badge: "Hoje",
      action: "Registrar",
      to: "/presencas",
      icon: CalendarCheck,
    });
  }

  if (lowPresenceTurmas.length > 0) {
    alerts.push({
      id: "low-presence",
      title: "Baixa presenca",
      description: `${lowPresenceTurmas.length} turma(s) abaixo de 70% de frequencia media.`,
      priority: "atencao",
      badge: "Risco",
      action: "Ver turmas",
      to: "/presencas",
      icon: AlertTriangle,
    });
  }

  if (contracts.length > 0) {
    alerts.push({
      id: "contracts",
      title: "Contratos de professores",
      description: `${contracts.length} contrato(s) expirados ou pendentes de assinatura.`,
      priority: "info",
      badge: "Contrato",
      action: "Revisar",
      to: "/professores",
      icon: FileText,
    });
  }

  if (dueSoon.length > 0) {
    alerts.push({
      id: "due-soon",
      title: "Proximos vencimentos",
      description: `${dueSoon.length} cobranca(s) vencem nos proximos 7 dias.`,
      priority: "info",
      badge: "7 dias",
      action: "Acompanhar",
      to: "/admin/financeiro",
      icon: Clock3,
    });
  }

  if (trialToday.length > 0) {
    alerts.push({
      id: "trial",
      title: "Aulas experimentais hoje",
      description: `${trialToday.length} lead(s) agendados para experiencia na J12.`,
      priority: "info",
      badge: "Lead",
      action: "Abrir",
      to: "/aula-experimental",
      icon: Sparkles,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "ok",
      title: "Operacao sem bloqueios criticos",
      description: "Nenhuma pendencia urgente encontrada nos dados atuais.",
      priority: "ok",
      badge: "OK",
      action: "Ver rotina",
      to: "/presencas",
      icon: BadgeCheck,
    });
  }

  return alerts.slice(0, 6);
}

function buildPresenceStats(turmas: Turma[], alunos: Aluno[], todayIso: string) {
  let total = 0;
  let present = 0;
  let absentToday = 0;
  const byClass = turmas.map((turma) => {
    let classTotal = 0;
    let classPresent = 0;
    for (const sessao of turma.presencas) {
      for (const registro of sessao.registros) {
        classTotal += 1;
        if (registro.presente) classPresent += 1;
      }
    }
    total += classTotal;
    present += classPresent;
    const rate = classTotal > 0 ? Math.round((classPresent / classTotal) * 100) : 0;
    const todaySession = turma.presencas.find((sessao) => sessao.data === todayIso);
    if (todaySession) {
      absentToday += todaySession.registros.filter((registro) => !registro.presente).length;
    }
    return { label: turma.nome || "Turma", value: rate };
  });

  const alunoMap = new Map(alunos.map((aluno) => [String(aluno.id), aluno.nome]));
  const consecutiveAbsences = buildConsecutiveAbsences(turmas, alunoMap);
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  return {
    rate,
    absentToday,
    byClass: byClass.sort((left, right) => right.value - left.value),
    lowPresenceTurmas: byClass.filter((item) => item.value > 0 && item.value < 70),
    consecutiveAbsences,
  };
}

function buildConsecutiveAbsences(turmas: Turma[], alunoMap: Map<string, string>) {
  const absences = new Map<string, number>();

  for (const turma of turmas) {
    const sessions = [...turma.presencas].sort((left, right) =>
      right.data.localeCompare(left.data),
    );
    const alunoIds = new Set(turma.alunoIds);

    for (const alunoId of alunoIds) {
      let count = 0;
      for (const sessao of sessions) {
        const registro = sessao.registros.find((item) => String(item.alunoId) === String(alunoId));
        if (!registro) continue;
        if (registro.presente) break;
        count += 1;
      }
      if (count >= 2) absences.set(alunoId, Math.max(absences.get(alunoId) || 0, count));
    }
  }

  return Array.from(absences.entries())
    .map(([id, count]) => ({ name: alunoMap.get(id) || "Aluno", absences: count }))
    .sort((left, right) => right.absences - left.absences)
    .slice(0, 4);
}

function buildPerformanceSeries(
  alunos: Aluno[],
  mensalidades: Mensalidade[],
  turmas: Turma[],
  now: Date,
) {
  return lastMonths(now, 6).map((month) => {
    const students = alunos.filter(
      (aluno) => monthKey(readAlunoCreatedAt(aluno)) === month.key,
    ).length;
    const revenue = mensalidades
      .filter(
        (item) =>
          isPaidStatus(item.status) &&
          monthKey(item.data_pagamento || item.pago_em || item.data_vencimento) === month.key,
      )
      .reduce((total, item) => total + Number(item.valor_atualizado || 0), 0);
    const presence = monthPresenceRate(turmas, month.key);

    return {
      month: month.label,
      alunos: students,
      receita: Number(revenue.toFixed(2)),
      presenca: presence,
    };
  });
}

function buildRevenueByCategory(mensalidades: Mensalidade[]) {
  const map = new Map<string, number>();

  for (const item of mensalidades) {
    if (!isPaidStatus(item.status)) continue;
    const label = formatCategory(item.tipo);
    map.set(label, (map.get(label) || 0) + Number(item.valor_atualizado || 0));
  }

  const items = Array.from(map.entries())
    .map(([label, valor]) => ({ label, valor: Number(valor.toFixed(2)) }))
    .sort((left, right) => right.valor - left.valor)
    .slice(0, 5);

  return items.length > 0 ? items : [{ label: "Sem receita", valor: 1 }];
}

function buildTopModalities(alunos: Aluno[]) {
  const map = new Map<string, number>();
  for (const aluno of alunos) {
    if (normalizeText(aluno.status) !== "ativo") continue;
    const label =
      aluno.modalidade || aluno.matricula?.esportivas?.modalidades?.[0] || "Sem modalidade";
    map.set(label, (map.get(label) || 0) + 1);
  }

  const items = Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);

  return items.length > 0 ? items : [{ label: "Sem modalidade", value: 0 }];
}

function buildArenaCalendar(
  turmas: Turma[],
  trialClasses: Array<{ date: string; time: string; unit: string }>,
) {
  const hours = ["07", "09", "11", "14", "16", "18", "20"];
  const today = new Date();

  return DIA_KEYS.map((key, index) => {
    const date = addDays(today, index - today.getDay());
    const dateIso = toDateInput(date);
    const occupied = new Set<string>();

    turmas
      .filter((turma) => turma.ativa && turma.diasSemana.includes(key))
      .forEach((turma) => occupied.add((turma.horarioInicio || "").slice(0, 2)));

    trialClasses
      .filter((item) => item.date === dateIso && isArenaText(item.unit))
      .forEach((item) => occupied.add((item.time || "").slice(0, 2)));

    return {
      key,
      label: DIA_LABELS[key],
      slots: hours.map((hour) => ({ hour, occupied: occupied.has(hour) })),
    };
  });
}

function calculateArenaOccupation(
  turmas: Turma[],
  trialClasses: Array<{ date: string; time: string; unit: string }>,
  todayKey: DiaSemana,
  todayIso: string,
) {
  const occupied = new Set<string>();
  turmas
    .filter((turma) => turma.ativa && turma.diasSemana.includes(todayKey))
    .forEach((turma) => occupied.add(turma.horarioInicio || turma.nome));
  trialClasses
    .filter((item) => item.date === todayIso && isArenaText(item.unit))
    .forEach((item) => occupied.add(item.time || item.date));

  return Math.round(clamp((occupied.size / 10) * 100, 0, 100));
}

function calculateWeeklyArenaOccupation(
  turmas: Turma[],
  trialClasses: Array<{ date: string; time: string; unit: string }>,
) {
  const occupied = new Set<string>();
  turmas
    .filter((turma) => turma.ativa)
    .forEach((turma) =>
      turma.diasSemana.forEach((dia) =>
        occupied.add(`${dia}:${turma.horarioInicio || turma.nome}`),
      ),
    );
  trialClasses
    .filter((item) => isArenaText(item.unit))
    .forEach((item) => occupied.add(`${item.date}:${item.time}`));

  return Math.round(clamp((occupied.size / 70) * 100, 0, 100));
}

function countArenaReservations(
  turmas: Turma[],
  trialClasses: Array<{ date: string; unit: string }>,
  todayKey: DiaSemana,
  todayIso: string,
) {
  const classCount = turmas.filter(
    (turma) => turma.ativa && turma.diasSemana.includes(todayKey),
  ).length;
  const trialCount = trialClasses.filter(
    (item) => item.date === todayIso && isArenaText(item.unit),
  ).length;
  return classCount + trialCount;
}

function monthPresenceRate(turmas: Turma[], key: string) {
  let total = 0;
  let present = 0;
  for (const turma of turmas) {
    for (const sessao of turma.presencas) {
      if (monthKey(sessao.data) !== key) continue;
      for (const registro of sessao.registros) {
        total += 1;
        if (registro.presente) present += 1;
      }
    }
  }

  return total > 0 ? Math.round((present / total) * 100) : 0;
}

function HeroPulse({
  label,
  value,
  tone = "primary",
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className={cn("mt-2 text-xl font-black", toneText(tone))}>{value}</p>
    </div>
  );
}

function ExecutiveCard({
  title,
  value,
  subtitle,
  change,
  trend,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: LucideIcon;
  tone: Tone;
}) {
  return (
    <article className="j12-kpi-card min-h-[168px] p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            {title}
          </p>
          <p className="mt-3 truncate text-2xl font-black text-white md:text-3xl">{value}</p>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-400">{subtitle}</p>
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
            toneBox(tone),
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div
        className={cn(
          "mt-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold",
          trend === "down"
            ? "border-red-400/20 bg-red-500/10 text-red-200"
            : trend === "up"
              ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
              : "border-white/10 bg-white/5 text-slate-300",
        )}
      >
        <ArrowUpRight className={cn("h-3.5 w-3.5", trend === "down" && "rotate-90")} />
        {change}
      </div>
    </article>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("j12-surface p-4 md:p-5", className)}>{children}</section>;
}

function SectionHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 text-lg font-black tracking-tight text-white md:text-xl">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function AgendaRow({ item }: { item: AgendaItem }) {
  const Icon =
    item.type === "experimental"
      ? Sparkles
      : item.type === "arena"
        ? MapPin
        : item.type === "aniversario"
          ? Trophy
          : GraduationCap;

  return (
    <article className="group grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 transition hover:border-primary/25 hover:bg-white/[0.04] sm:grid-cols-[74px_1fr_auto] sm:items-center">
      <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-center">
        <p className="text-xs font-black text-primary">{item.time}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          {item.status}
        </p>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="truncate text-sm font-black text-white">{item.title}</h3>
        </div>
        <p className="mt-1 truncate text-sm text-slate-400">{item.detail}</p>
      </div>
      <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">
        {item.meta}
      </span>
    </article>
  );
}

function AlertRow({ alert }: { alert: AlertItem }) {
  const Icon = alert.icon;

  return (
    <article
      className={cn(
        "rounded-2xl border p-3 transition hover:-translate-y-0.5",
        alert.priority === "critico" && "border-red-400/25 bg-red-500/10",
        alert.priority === "atencao" && "border-amber-400/25 bg-amber-500/10",
        alert.priority === "info" && "border-sky-400/20 bg-sky-500/10",
        alert.priority === "ok" && "border-emerald-400/20 bg-emerald-500/10",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black text-white">{alert.title}</h3>
            <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
              {alert.badge}
            </span>
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-300">{alert.description}</p>
          <Link
            to={alert.to}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-primary transition hover:text-primary/80"
          >
            {alert.action}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function GoalCard({
  label,
  value,
  goal,
  suffix,
  tone,
}: {
  label: string;
  value: number;
  goal: number;
  suffix: string;
  tone: Tone;
}) {
  const progress = goal > 0 ? Math.round(clamp((value / goal) * 100, 0, 100)) : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-black text-white">
        {value}
        <span className="ml-1 text-sm text-slate-500">{suffix}</span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full", toneBg(tone))}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-400">{progress}% da meta</p>
    </div>
  );
}

function ProgressLine({
  label,
  value,
  max,
  suffix = "",
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
}) {
  const progress = max > 0 ? Math.round(clamp((value / max) * 100, 0, 100)) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="truncate text-sm font-semibold text-slate-300">{label}</span>
        <span className="text-sm font-black text-white">
          {value}
          {suffix}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-primary shadow-[0_0_18px_rgba(255,69,0,0.35)]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function PresenceHero({ value }: { value: number }) {
  return (
    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-200">
            Presenca media
          </p>
          <p className="mt-3 text-3xl font-black text-white">{value}%</p>
        </div>
        <Activity className="h-8 w-8 text-emerald-200" />
      </div>
    </div>
  );
}

function SmallStat({
  label,
  value,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-xl font-black text-white">{value}</p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl border",
            toneBox(tone),
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function CompactMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate text-sm font-semibold text-slate-300">{label}</span>
      </div>
      <span className="text-sm font-black text-white">{value}</span>
    </div>
  );
}

function QuickAction({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <Link
      to={to}
      className="group flex min-h-[104px] flex-col justify-between rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/10 hover:shadow-[0_18px_45px_rgba(255,69,0,0.12)]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-sm font-black text-white">{label}</span>
        <Plus className="h-4 w-4 text-primary transition group-hover:rotate-90" />
      </div>
    </Link>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="j12-empty-state p-6 text-center">
      <Icon className="mx-auto h-8 w-8 text-primary" />
      <h3 className="mt-3 font-black text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <AppShell title="Dashboard Executivo J12" contentClassName="mx-auto max-w-[1600px] space-y-6">
      <div className="j12-skeleton h-56" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="j12-skeleton h-40" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="j12-skeleton h-96" />
        <div className="j12-skeleton h-96" />
      </div>
    </AppShell>
  );
}

function ChartTooltip({ active, payload, label, moneyValues }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/90 p-3 text-sm shadow-2xl">
      {label && <p className="mb-2 font-black text-white">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center justify-between gap-5">
            <span className="text-slate-400">{entry.name}</span>
            <span className="font-black text-white">
              {moneyValues || entry.name?.toLowerCase().includes("receita")
                ? money(entry.value)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function toneBox(tone: Tone) {
  return {
    primary: "border-primary/25 bg-primary/10 text-primary",
    success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    danger: "border-red-400/20 bg-red-500/10 text-red-200",
    info: "border-sky-400/20 bg-sky-500/10 text-sky-200",
  }[tone];
}

function toneText(tone: Tone) {
  return {
    primary: "text-primary",
    success: "text-emerald-200",
    warning: "text-amber-200",
    danger: "text-red-200",
    info: "text-sky-200",
  }[tone];
}

function toneBg(tone: Tone) {
  return {
    primary: "bg-primary",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-red-400",
    info: "bg-sky-400",
  }[tone];
}

function money(value: number | string | undefined) {
  return currencyFormatter.format(Number(value || 0));
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function isPaidStatus(status: string) {
  return ["pago", "recebido", "quitado"].includes(normalizeText(status));
}

function isPendingStatus(status: string) {
  return ["pendente", "aberto", "em aberto"].includes(normalizeText(status));
}

function isOverdueStatus(status: string) {
  return ["vencido", "atrasado"].includes(normalizeText(status));
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const normalized = String(value).slice(0, 10);
  const date = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthKey(value?: string | null) {
  const date = parseDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(now: Date, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    };
  });
}

function isCurrentMonth(value: string | undefined | null, now: Date) {
  const date = parseDate(value);
  return Boolean(
    date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(),
  );
}

function isWithinNextDays(value: string | undefined | null, now: Date, days: number) {
  const date = parseDate(value);
  if (!date) return false;
  const start = parseDate(toDateInput(now));
  const end = addDays(start || now, days);
  return Boolean(start && date >= start && date <= end);
}

function readAlunoCreatedAt(aluno: Aluno) {
  return aluno.matriculaEm || aluno.raw?.created_at || aluno.raw?.data_matricula || "";
}

function isBirthdayToday(value: string | undefined, todayIso: string) {
  const birthday = parseDate(value);
  const today = parseDate(todayIso);
  return Boolean(
    birthday &&
    today &&
    birthday.getMonth() === today.getMonth() &&
    birthday.getDate() === today.getDate(),
  );
}

function isArenaText(value: unknown) {
  const normalized = normalizeText(value);
  return (
    normalized.includes("arena") || normalized.includes("quadra") || normalized.includes("aluguel")
  );
}

function formatCategory(value: string | undefined | null) {
  const normalized = normalizeText(value || "outros").replace(/_/g, " ");
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Outros";
}

function buildRevenueChange(series: Array<{ receita: number }>) {
  const current = series.at(-1)?.receita || 0;
  const previous = series.at(-2)?.receita || 0;
  if (previous <= 0 && current > 0) return "+100% vs mes anterior";
  if (previous <= 0) return "sem base anterior";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change >= 0 ? "+" : ""}${change}% vs mes anterior`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
