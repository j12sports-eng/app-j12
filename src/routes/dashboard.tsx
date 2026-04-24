import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Users,
  DollarSign,
  AlertTriangle,
  Sparkles,
  CalendarCheck,
  FileSignature,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useAlunos } from "@/lib/alunos-store";
import { useTransacoes, calcStatus, formatBRL } from "@/lib/financeiro-store";
import { useContratos } from "@/lib/contratos-store";
import { useSettingsState } from "@/lib/settings/settings-store";
import { useTurmas } from "@/lib/turmas-store";
import { getAccessibleClasses } from "@/lib/presenca-access";
import {
  usePortalAluno,
  usePortalContrato,
  usePortalFinanceiro,
  usePortalNotificacoes,
  usePortalPresencas,
} from "@/lib/aluno-portal";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <RequireAuth>
      <DashboardPage />
    </RequireAuth>
  ),
});

type Kpi = {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
  tone?: "primary" | "success" | "warning" | "destructive";
  to?: string;
};

function toneClasses(tone: Kpi["tone"]) {
  switch (tone) {
    case "success": return "text-success bg-success/10";
    case "warning": return "text-warning bg-warning/10";
    case "destructive": return "text-destructive bg-destructive/10";
    default: return "text-primary bg-primary/10";
  }
}

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
  const contratos = useContratos();
  const settings = useSettingsState();

  const kpis: Kpi[] = useMemo(() => {
    const ativos = alunos.filter((a) => a.status === "ativo").length;
    const experimentais = alunos.filter((a) => a.status === "experimental").length;

    const mesAtual = new Date().toISOString().slice(0, 7);
    const recebidoMes = transacoes
      .filter((t) => t.pagoEm && t.pagoEm.slice(0, 7) === mesAtual)
      .reduce((s, t) => s + t.valor, 0);
    const previstoMes = transacoes
      .filter((t) => t.vencimento.slice(0, 7) === mesAtual)
      .reduce((s, t) => s + t.valor, 0);

    const vencidas = transacoes.filter((t) => calcStatus(t) === "vencido");
    const totalVencido = vencidas.reduce((s, t) => s + t.valor, 0);
    const alunosInadimplentes = new Set(vencidas.map((t) => t.alunoId)).size;

    const aguardando = contratos.filter((c) => c.status === "aguardando_assinatura").length;
    const ativosContratos = contratos.filter((c) => c.status === "ativo").length;

    const matriculasMes = alunos.filter(
      (a) => a.matriculaEm.slice(0, 7) === mesAtual,
    ).length;

    return [
      {
        label: "Alunos ativos",
        value: String(ativos),
        hint: matriculasMes > 0 ? `+${matriculasMes} este mês` : "Nenhuma matrícula este mês",
        icon: Users,
        tone: "primary",
        to: "/alunos",
      },
      {
        label: "Receita do mês",
        value: formatBRL(recebidoMes),
        hint: `Previsto: ${formatBRL(previstoMes)}`,
        icon: DollarSign,
        tone: "success",
        to: "/financeiro",
      },
      {
        label: "Inadimplência",
        value: formatBRL(totalVencido),
        hint:
          alunosInadimplentes > 0
            ? `${alunosInadimplentes} aluno${alunosInadimplentes > 1 ? "s" : ""} em atraso`
            : "Nenhum aluno em atraso",
        icon: AlertTriangle,
        tone: totalVencido > 0 ? "destructive" : "success",
        to: "/financeiro",
      },
      {
        label: "Contratos aguardando assinatura",
        value: String(aguardando),
        hint: `${ativosContratos} contrato${ativosContratos !== 1 ? "s" : ""} ativo${ativosContratos !== 1 ? "s" : ""}`,
        icon: FileSignature,
        tone: aguardando > 0 ? "warning" : "primary",
        to: "/contratos",
      },
      {
        label: "Aulas experimentais",
        value: String(experimentais),
        hint: "Alunos em fase experimental",
        icon: Sparkles,
        tone: "primary",
        to: "/aula-experimental",
      },
      {
        label: "Presença média",
        value: "—",
        hint: "Em breve",
        icon: CalendarCheck,
        tone: "warning",
      },
    ];
  }, [alunos, transacoes, contratos]);

  const aniversariantes = useMemo(() => {
    const now = new Date();
    const today = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    return alunos.filter((aluno) => {
      if (!aluno.dataNascimento) return false;
      return aluno.dataNascimento.slice(5) === today;
    });
  }, [alunos]);

  return (
    <AppShell title="Dashboard">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Olá, {user?.nome.split(" ")[0]} 👋</h2>
        <p className="text-sm text-muted-foreground">
          Visão geral da operação da J12 Sports.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const card = (
            <div className="h-full rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-[var(--shadow-glow)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{kpi.label}</div>
                  <div className="mt-1 text-2xl font-bold">{kpi.value}</div>
                </div>
                <div className={`rounded-lg p-2.5 ${toneClasses(kpi.tone)}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">{kpi.hint}</div>
            </div>
          );
          return kpi.to ? (
            <Link key={kpi.label} to={kpi.to}>
              {card}
            </Link>
          ) : (
            <div key={kpi.label}>{card}</div>
          );
        })}
      </div>

      {settings.notifications.birthdayReminderEnabled && aniversariantes.length > 0 ? (
        <div className="mt-8 rounded-xl border border-primary/20 bg-card p-6">
          <div className="text-sm font-semibold text-primary">Lembrete de aniversário do aluno</div>
          <div className="mt-2 text-sm text-muted-foreground">
            {settings.notifications.birthdayReminderMessage}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {aniversariantes.map((aluno) => (
              <div
                key={aluno.id}
                className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm text-primary"
              >
                {aluno.nome}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8 rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
        <div className="font-semibold text-foreground mb-1">Próximos passos</div>
        Os indicadores acima são calculados em tempo real a partir dos módulos
        Alunos, Financeiro e Contratos. Clique em qualquer card para abrir o
        módulo correspondente.
      </div>
    </AppShell>
  );
}

function ProfessorDashboardPage() {
  const { user } = useAuth();
  const turmas = useTurmas();
  const alunos = useAlunos();

  const minhasTurmas = useMemo(() => getAccessibleClasses(user, turmas), [turmas, user]);
  const meusAlunoIds = useMemo(
    () =>
      new Set(
        minhasTurmas.flatMap((turma) =>
          Array.isArray(turma.alunoIds) ? turma.alunoIds : [],
        ),
      ),
    [minhasTurmas],
  );
  const meusAlunos = useMemo(
    () => alunos.filter((aluno) => meusAlunoIds.has(aluno.id)),
    [alunos, meusAlunoIds],
  );
  const sessoes = useMemo(
    () => minhasTurmas.reduce((accumulator, turma) => accumulator + turma.presencas.length, 0),
    [minhasTurmas],
  );

  return (
    <AppShell title="Dashboard">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">OlÃ¡, {user?.nome.split(" ")[0]}</h2>
        <p className="text-sm text-muted-foreground">
          Aqui vocÃª acompanha somente as turmas, alunos e chamadas vinculadas ao seu cadastro.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Turmas vinculadas"
          value={String(minhasTurmas.length)}
          hint="Escopo liberado para este professor"
          icon={CalendarCheck}
          tone="primary"
        />
        <KpiCard
          label="Alunos nas turmas"
          value={String(meusAlunos.length)}
          hint="Somente alunos das suas aulas"
          icon={Users}
          tone="success"
        />
        <KpiCard
          label="Chamadas registradas"
          value={String(sessoes)}
          hint="HistÃ³rico de presenÃ§a das turmas vinculadas"
          icon={ShieldCheck}
          tone="warning"
        />
        <KpiCard
          label="PrÃ³ximos passos"
          value={minhasTurmas.length > 0 ? "Operando" : "Sem turmas"}
          hint={minhasTurmas.length > 0 ? "Abra PresenÃ§a para registrar a aula." : "Aguardando vinculaÃ§Ã£o de turma."}
          icon={Sparkles}
          tone={minhasTurmas.length > 0 ? "primary" : "warning"}
        />
      </div>

      <div className="mt-8 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Minhas turmas</h3>
              <p className="text-sm text-muted-foreground">
                Somente turmas que pertencem ao seu escopo.
              </p>
            </div>
            <Link to="/presenca" className="text-sm font-medium text-primary hover:underline">
              Abrir PresenÃ§a
            </Link>
          </div>
          <div className="space-y-3">
            {minhasTurmas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
                Nenhuma turma vinculada ao seu perfil.
              </div>
            ) : (
              minhasTurmas.map((turma) => (
                <div key={turma.id} className="rounded-xl border border-border bg-background/40 p-4">
                  <div className="font-semibold">{turma.nome}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {turma.modalidade} - {turma.unidade}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {turma.alunoIds.length} aluno(s) - {turma.horarioInicio} atÃ© {turma.horarioFim}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold">Alunos vinculados</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Lista rÃ¡pida dos alunos que vocÃª acompanha.
          </p>
          <div className="space-y-3">
            {meusAlunos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
                Ainda nÃ£o hÃ¡ alunos vinculados Ã s suas turmas.
              </div>
            ) : (
              meusAlunos.slice(0, 8).map((aluno) => (
                <div key={aluno.id} className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3">
                  <div>
                    <div className="font-medium">{aluno.nome}</div>
                    <div className="text-xs text-muted-foreground">{aluno.modalidade}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{aluno.status}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
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
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
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
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
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

  return (
    <AppShell title="Meu Painel">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">OlÃ¡, {aluno?.nome.split(" ")[0]}</h2>
        <p className="text-sm text-muted-foreground">
          Aqui vocÃª acompanha seu perfil, plano, financeiro, presenÃ§a e avisos em um Ãºnico lugar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Plano atual"
          value={aluno?.plano || "NÃ£o informado"}
          hint={aluno?.modalidade || "Modalidade nÃ£o informada"}
          icon={Sparkles}
          tone="primary"
        />
        <KpiCard
          label="Mensalidades em aberto"
          value={String(pagamentosEmAberto.length)}
          hint={pagamentosEmAberto.length > 0 ? "Acompanhe vencimentos no financeiro." : "Nenhuma pendÃªncia financeira."}
          icon={DollarSign}
          tone={pagamentosEmAberto.length > 0 ? "warning" : "success"}
        />
        <KpiCard
          label="PresenÃ§a"
          value={`${taxaPresenca}%`}
          hint={`${presencas.length} aula(s) registradas`}
          icon={CalendarCheck}
          tone="success"
        />
        <KpiCard
          label="NotificaÃ§Ãµes"
          value={String(notificacoes.filter((item) => !item.lida).length)}
          hint="Avisos e comunicados do seu perfil"
          icon={Bell}
          tone="warning"
        />
      </div>

      <div className="mt-8 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Resumo do aluno</h3>
              <p className="text-sm text-muted-foreground">Dados vinculados ao seu acesso autenticado.</p>
            </div>
            <Link to="/alunos" className="text-sm font-medium text-primary hover:underline">
              Ver perfil
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoPill label="Nome" value={aluno?.nome || "-"} />
            <InfoPill label="ResponsÃ¡vel" value={aluno?.responsavel || "-"} />
            <InfoPill label="Plano" value={aluno?.plano || "-"} />
            <InfoPill label="Turma" value={aluno?.turma || "-"} />
          </div>
          <div className="mt-4 rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
            {contrato
              ? `Contrato disponÃ­vel: ${contrato.titulo} (${contrato.status}).`
              : "Nenhum contrato disponÃ­vel para leitura no momento."}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">PrÃ³ximas atenÃ§Ãµes</h3>
              <p className="text-sm text-muted-foreground">PendÃªncias e lembretes mais recentes.</p>
            </div>
            <Link to="/notificacoes" className="text-sm font-medium text-primary hover:underline">
              Abrir avisos
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {notificacoes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
                Nenhuma notificaÃ§Ã£o disponÃ­vel.
              </div>
            ) : (
              notificacoes.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-xl border border-border bg-background/40 p-4">
                  <div className="font-medium">{item.titulo}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.mensagem}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
