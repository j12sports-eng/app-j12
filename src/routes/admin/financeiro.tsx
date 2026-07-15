import { useMemo, useState } from "react";
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownToLine,
  Banknote,
  Bot,
  CheckCircle2,
  Clock3,
  CreditCard,
  Filter,
  LineChart as LineChartIcon,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
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
import { FinancialMovementModal } from "@/components/financeiro/movement-modal";
import {
  formatBRLFromNumber,
  formatBRLInput,
  parseBRL,
} from "@/components/financeiro/movement-modal/movement-form";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SkeletonDashboard, SkeletonTable } from "@/components/ui/skeleton";
import { FinancialAdminEnrollmentPanel } from "@/features/financial/pages/FinancialAdminEnrollmentPanel";
import {
  useFinanceiroAdmin,
  type DespesaFinanceira,
  type Mensalidade,
} from "@/hooks/useFinanceiroAdmin";
import { formatApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/financeiro")({
  component: FinanceiroAdminPage,
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const compactFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const STATUS_COLORS: Record<string, string> = {
  pago: "#22c55e",
  pendente: "#f59e0b",
  atrasado: "#ef4444",
  vencido: "#ef4444",
  cancelado: "#64748b",
  cancelada: "#64748b",
};

const CATEGORY_LABELS: Record<string, string> = {
  mensalidade: "Mensalidade",
  aula_avulsa: "Aula Avulsa",
  campeonato: "Campeonato",
  uniforme: "Uniforme",
  patrocinio: "Patrocinio",
  evento: "Evento",
  aluguel: "Aluguel",
  energia: "Energia",
  agua: "Agua",
  funcionarios: "Funcionarios",
  material_esportivo: "Material esportivo",
  marketing: "Marketing",
  manutencao: "Manutencao",
  arbitragem: "Arbitragem",
  impostos: "Impostos",
  outros: "Outros",
};

function money(value: number | string | undefined) {
  return currencyFormatter.format(Number(value || 0));
}

function normalizeStatus(status: string) {
  const normalized = String(status || "pendente").toLowerCase();
  return normalized === "vencido" ? "atrasado" : normalized;
}

function formatDate(value: string | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function formatCategory(value: string | undefined | null) {
  const normalized = String(value || "outros").toLowerCase();
  return CATEGORY_LABELS[normalized] || normalized.replace(/_/g, " ");
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold capitalize",
        normalized === "pago" && "bg-emerald-500/15 text-emerald-200",
        normalized === "pendente" && "bg-amber-500/15 text-amber-200",
        normalized === "atrasado" && "bg-red-500/15 text-red-200",
        normalized === "cancelado" && "bg-slate-500/15 text-slate-200",
      )}
    >
      {normalized}
    </span>
  );
}

function KpiCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "primary",
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Banknote;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    primary: "border-primary/25 bg-primary/10 text-primary",
    success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    danger: "border-red-400/20 bg-red-500/10 text-red-200",
  }[tone];

  return (
    <div className="j12-kpi-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {title}
          </p>
          <p className="mt-3 text-2xl font-bold text-white md:text-3xl">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{detail}</p>
        </div>
        <div
          className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", toneClass)}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function CategoryBreakdown({
  title,
  detail,
  items,
}: {
  title: string;
  detail: string;
  items: Array<{ categoria: string; label: string; valor: number }>;
}) {
  return (
    <div className="j12-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="text-sm text-slate-400">{detail}</p>
        </div>
        <ReceiptText className="h-5 w-5 text-primary" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.categoria}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <span className="text-sm font-semibold text-slate-300">{item.label}</span>
            <span className="text-sm font-black text-white">{money(item.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <AppShell title="Financeiro J12">
      <div className="space-y-6">
        <SkeletonDashboard cards={8} panels={2} />
        <SkeletonTable columns={6} rows={6} />
      </div>
    </AppShell>
  );
}

function FinanceiroAdminPage() {
  const location = useLocation();
  if (location.pathname !== "/admin/financeiro") {
    return <Outlet />;
  }

  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <FinanceiroAdminContent />
    </ProtectedRoute>
  );
}

function FinanceiroAdminContent() {
  const {
    resumo,
    mensalidades,
    loading,
    actionLoading,
    error,
    message,
    automacao,
    despesas,
    fluxoCaixa,
    atualizar,
    receberMensalidade,
    criarCobranca,
    atualizarCobranca,
    excluirCobranca,
    criarDespesa,
    atualizarDespesa,
    excluirDespesa,
    gerarMensalidades,
    atualizarAtrasadas,
  } = useFinanceiroAdmin();

  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [mesFiltro, setMesFiltro] = useState("");
  const [modalPagamento, setModalPagamento] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementInitialType, setMovementInitialType] = useState<"receita" | "despesa">("receita");
  const [editingMovement, setEditingMovement] = useState<
    { type: "receita"; item: Mensalidade } | { type: "despesa"; item: DespesaFinanceira } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "receita"; id: string; label: string }
    | { type: "despesa"; id: string; label: string }
    | null
  >(null);
  const [mensalidadeSelecionada, setMensalidadeSelecionada] = useState<{
    id: string;
    aluno_nome: string;
    valor_atualizado: number;
  } | null>(null);
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [recebimentoData, setRecebimentoData] = useState(new Date().toISOString().slice(0, 10));
  const [recebimentoValor, setRecebimentoValor] = useState("");
  const [recebimentoObservacao, setRecebimentoObservacao] = useState("");

  const mensalidadesFiltradas = useMemo(() => {
    return mensalidades.filter((item) => {
      const nome = item.aluno_nome || "";
      const status = normalizeStatus(item.status || "");
      const competencia = item.data_vencimento
        ? new Date(item.data_vencimento).toISOString().slice(0, 7)
        : item.competencia || "";

      const matchBusca = nome.toLowerCase().includes(busca.toLowerCase());
      const matchStatus = statusFiltro === "todos" ? true : status === statusFiltro;
      const matchMes = !mesFiltro ? true : competencia === mesFiltro;

      return matchBusca && matchStatus && matchMes;
    });
  }, [mensalidades, busca, statusFiltro, mesFiltro]);

  const charts = useMemo(() => {
    const monthly = new Map<string, { competencia: string; recebido: number; aberto: number }>();
    const status = new Map<string, number>();

    for (const item of mensalidades) {
      const competencia =
        item.competencia ||
        (item.data_vencimento
          ? new Date(item.data_vencimento).toISOString().slice(0, 7)
          : "Sem data");
      const current = monthly.get(competencia) || {
        competencia,
        recebido: 0,
        aberto: 0,
      };
      const value = Number(item.valor_atualizado || 0);
      const normalizedStatus = normalizeStatus(item.status);

      if (normalizedStatus === "pago") {
        current.recebido += value;
      } else if (normalizedStatus !== "cancelado") {
        current.aberto += value;
      }

      monthly.set(competencia, current);
      status.set(normalizedStatus, (status.get(normalizedStatus) || 0) + 1);
    }

    return {
      monthly: Array.from(monthly.values()).sort((a, b) =>
        a.competencia.localeCompare(b.competencia),
      ),
      status: Array.from(status.entries()).map(([name, value]) => ({ name, value })),
    };
  }, [mensalidades]);

  const forecast = useMemo(() => {
    const aberto = Number(resumo?.total_a_receber || resumo?.a_receber_mes || 0);
    const atrasado = Number(resumo?.total_atrasado || 0);
    const recebido = Number(resumo?.total_recebido || resumo?.recebido_mes || 0);
    const eficiencia =
      recebido + aberto > 0 ? Math.round((recebido / (recebido + aberto)) * 100) : 0;

    return {
      eficiencia,
      risco: aberto > 0 ? Math.round((atrasado / aberto) * 100) : 0,
    };
  }, [resumo]);

  function exportCsv() {
    const rows = [
      ["Aluno", "Valor", "Status", "Vencimento", "Competencia"],
      ...mensalidadesFiltradas.map((item) => [
        item.aluno_nome,
        String(item.valor_atualizado || 0).replace(".", ","),
        normalizeStatus(item.status),
        item.data_vencimento || "",
        item.competencia || "",
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `j12-financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openCreateMovement(type: "receita" | "despesa" = "receita") {
    setEditingMovement(null);
    setMovementInitialType(type);
    setMovementModalOpen(true);
  }

  function openEditReceita(item: Mensalidade) {
    setMovementInitialType("receita");
    setEditingMovement({ type: "receita", item });
    setMovementModalOpen(true);
  }

  function openEditDespesa(item: DespesaFinanceira) {
    setMovementInitialType("despesa");
    setEditingMovement({ type: "despesa", item });
    setMovementModalOpen(true);
  }

  function openReceiveModal(item: Mensalidade) {
    setMensalidadeSelecionada({
      id: item.id,
      aluno_nome: item.aluno_nome,
      valor_atualizado: item.valor_atualizado,
    });
    setFormaPagamento(item.forma_pagamento || "pix");
    setRecebimentoData(new Date().toISOString().slice(0, 10));
    setRecebimentoValor(formatBRLFromNumber(item.valor_atualizado));
    setRecebimentoObservacao("");
    setModalPagamento(true);
  }

  function closeReceiveModal() {
    setModalPagamento(false);
    setMensalidadeSelecionada(null);
    setRecebimentoData(new Date().toISOString().slice(0, 10));
    setRecebimentoValor("");
    setRecebimentoObservacao("");
    setFormaPagamento("pix");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === "receita") {
        await excluirCobranca(deleteTarget.id);
        toast.success("Cobranca excluida.");
      } else {
        await excluirDespesa(deleteTarget.id);
        toast.success("Despesa excluida.");
      }
      setDeleteTarget(null);
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel excluir o registro."));
    }
  }

  if (loading) {
    return <LoadingState />;
  }

  return (
    <AppShell title="Financeiro J12">
      <div className="j12-page-enter space-y-6">
        <section className="j12-surface overflow-hidden p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <LineChartIcon className="h-3.5 w-3.5" />
                Receita, inadimplencia e automacoes
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-5xl">
                Central financeira com leitura executiva.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-300 md:text-base">
                Acompanhe mensalidades, gere cobrancas recorrentes, baixe pagamentos e exporte dados
                sem sair do fluxo operacional.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[520px]">
              <button
                onClick={() => openCreateMovement("receita")}
                disabled={actionLoading}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Nova cobranca
              </button>
              <button
                onClick={gerarMensalidades}
                disabled={actionLoading}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
                Gerar mensalidades
              </button>
              <button
                onClick={atualizarAtrasadas}
                disabled={actionLoading}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw className={cn("h-4 w-4", actionLoading && "animate-spin")} />
                Atualizar atrasadas
              </button>
              <button
                onClick={exportCsv}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <ArrowDownToLine className="h-4 w-4" />
                Exportar CSV
              </button>
              <button
                onClick={() => void atualizar()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <RefreshCcw className="h-4 w-4" />
                Recarregar
              </button>
            </div>
          </div>

          {(error || message) && (
            <div
              className={cn(
                "mt-5 rounded-2xl border px-4 py-3 text-sm",
                error
                  ? "border-red-400/25 bg-red-500/10 text-red-100"
                  : "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
              )}
            >
              {error || message}
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Recebido"
            value={money(resumo?.recebido_mes)}
            detail={`${forecast.eficiencia}% de eficiencia no ciclo`}
            icon={Banknote}
            tone="success"
          />
          <KpiCard
            title="A receber"
            value={money(resumo?.a_receber_mes)}
            detail="Carteira aberta e recorrente"
            icon={CreditCard}
          />
          <KpiCard
            title="Inadimplentes"
            value={compactFormatter.format(resumo?.inadimplentes || 0)}
            detail={`${forecast.risco}% de risco sobre aberto`}
            icon={AlertTriangle}
            tone="danger"
          />
          <KpiCard
            title="Vencidas"
            value={compactFormatter.format(resumo?.mensalidades_vencidas || 0)}
            detail="Cobrancas que exigem follow-up"
            icon={Clock3}
            tone="warning"
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Entradas"
            value={money(fluxoCaixa.entradas)}
            detail="Receita confirmada no caixa"
            icon={Wallet}
            tone="success"
          />
          <KpiCard
            title="Saidas"
            value={money(fluxoCaixa.saidas)}
            detail={`${despesas.length} despesa(s) operacional(is)`}
            icon={ArrowDownToLine}
            tone="danger"
          />
          <KpiCard
            title="Lucro liquido"
            value={money(fluxoCaixa.lucroLiquido)}
            detail="Entradas confirmadas menos saidas"
            icon={TrendingUp}
            tone={fluxoCaixa.lucroLiquido >= 0 ? "success" : "danger"}
          />
          <KpiCard
            title="Saldo operacional"
            value={money(fluxoCaixa.saldoOperacional)}
            detail="Caixa realizado com carteira aberta"
            icon={Banknote}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <CategoryBreakdown
            title="Entradas por categoria"
            detail="Mensalidades, matriculas, uniformes, arena e eventos."
            items={fluxoCaixa.entradasPorCategoria}
          />
          <CategoryBreakdown
            title="Despesas operacionais"
            detail="Aluguel, IPTU, equipe, reformas, manutencao e fornecedores."
            items={fluxoCaixa.saidasPorCategoria}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="j12-surface p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Fluxo mensal</h2>
                <p className="text-sm text-slate-400">Recebido versus carteira em aberto.</p>
              </div>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.monthly}>
                  <defs>
                    <linearGradient id="recebido" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="aberto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff4500" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ff4500" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="competencia" stroke="rgba(255,255,255,0.48)" tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.48)" tickLine={false} width={72} />
                  <Tooltip
                    contentStyle={{
                      background: "#111113",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 12,
                      color: "#fff",
                    }}
                    formatter={(value) => money(Number(value))}
                  />
                  <Area
                    type="monotone"
                    dataKey="recebido"
                    stroke="#22c55e"
                    fill="url(#recebido)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="aberto"
                    stroke="#ff4500"
                    fill="url(#aberto)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="j12-surface p-5">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white">Status das cobrancas</h2>
              <p className="text-sm text-slate-400">Distribuicao operacional atual.</p>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.status}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={78}
                  >
                    {charts.status.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#111113",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 12,
                      color: "#fff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid gap-2">
              {charts.status.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 capitalize text-slate-300">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: STATUS_COLORS[item.name] || "#94a3b8" }}
                    />
                    {item.name}
                  </span>
                  <span className="font-bold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="j12-surface p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Automacoes inteligentes</h2>
                <p className="text-sm text-slate-400">
                  Rotinas prontas para financeiro e atendimento.
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Proximos vencimentos
                </p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {automacao?.proximosVencimentos || 0}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Pendentes</p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {automacao?.mensalidadesPendentes || 0}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Inadimplencia</p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {automacao?.inadimplentes || 0}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {(automacao?.alertas || []).slice(0, 4).map((alerta) => (
                <div
                  key={`${alerta.tipo}-${alerta.titulo}`}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-bold text-white">{alerta.titulo}</p>
                      <p className="mt-1 text-sm text-slate-400">{alerta.descricao}</p>
                    </div>
                  </div>
                </div>
              ))}
              {!automacao?.alertas?.length && (
                <div className="j12-empty-state p-5 text-sm text-slate-300">
                  Nenhum alerta critico. As rotinas de cobranca seguem disponiveis para execucao
                  manual.
                </div>
              )}
            </div>
          </div>

          <div className="j12-surface p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Performance por competencia</h2>
                <p className="text-sm text-slate-400">Volume financeiro agregado por mes.</p>
              </div>
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.monthly}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="competencia" stroke="rgba(255,255,255,0.48)" tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.48)" tickLine={false} width={72} />
                  <Tooltip
                    contentStyle={{
                      background: "#111113",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 12,
                      color: "#fff",
                    }}
                    formatter={(value) => money(Number(value))}
                  />
                  <Bar dataKey="recebido" fill="#22c55e" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="aberto" fill="#ff4500" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <FinancialAdminEnrollmentPanel />

        <section className="j12-surface p-4 md:p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Mensalidades</h2>
              <p className="text-sm text-slate-400">
                {mensalidadesFiltradas.length} registro(s) dentro dos filtros atuais.
              </p>
            </div>

            <div className="grid gap-2 md:grid-cols-[1fr_160px_160px] lg:min-w-[680px]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar aluno..."
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  className="j12-field h-12 w-full pl-10 pr-4 text-sm"
                />
              </label>

              <label className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <select
                  value={statusFiltro}
                  onChange={(event) => setStatusFiltro(event.target.value)}
                  className="j12-field h-12 w-full appearance-none pl-10 pr-4 text-sm"
                >
                  <option value="todos">Todos</option>
                  <option value="pendente">Pendentes</option>
                  <option value="pago">Pagos</option>
                  <option value="atrasado">Atrasados</option>
                </select>
              </label>

              <input
                type="month"
                value={mesFiltro}
                onChange={(event) => setMesFiltro(event.target.value)}
                className="j12-field h-12 w-full px-4 text-sm"
              />
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-white/10 lg:block">
            <table className="w-full">
              <thead className="j12-table-head">
                <tr className="text-left text-xs uppercase tracking-[0.14em]">
                  <th className="px-4 py-4">Aluno</th>
                  <th className="px-4 py-4">Valor</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Vencimento</th>
                  <th className="px-4 py-4 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {mensalidadesFiltradas.map((item) => (
                  <tr key={item.id} className="j12-table-row border-t border-white/8">
                    <td className="px-4 py-4 font-semibold text-white">{item.aluno_nome}</td>
                    <td className="px-4 py-4 text-slate-200">{money(item.valor_atualizado)}</td>
                    <td className="px-4 py-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-4 text-slate-300">{formatDate(item.data_vencimento)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          onClick={() => openReceiveModal(item)}
                          disabled={normalizeStatus(item.status) === "pago"}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Receber
                        </button>
                        <button
                          onClick={() => openEditReceita(item)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-black transition hover:bg-amber-300"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              type: "receita",
                              id: item.id,
                              label: item.descricao || item.aluno_nome,
                            })
                          }
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {mensalidadesFiltradas.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white">{item.aluno_nome}</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {formatDate(item.data_vencimento)}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xl font-bold text-white">{money(item.valor_atualizado)}</p>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => openReceiveModal(item)}
                    disabled={normalizeStatus(item.status) === "pago"}
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-black disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Receber
                  </button>
                  <button
                    onClick={() => openEditReceita(item)}
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-black"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    onClick={() =>
                      setDeleteTarget({
                        type: "receita",
                        id: item.id,
                        label: item.descricao || item.aluno_nome,
                      })
                    }
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>

          {mensalidadesFiltradas.length === 0 && (
            <div className="j12-empty-state mt-4 p-8 text-center">
              <p className="font-bold text-white">Nenhuma mensalidade encontrada.</p>
              <p className="mt-2 text-sm text-slate-400">
                Ajuste os filtros ou gere as mensalidades do ciclo atual.
              </p>
            </div>
          )}
        </section>

        <section className="j12-surface p-5 md:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-red-200">
                <ReceiptText className="h-3.5 w-3.5" />
                Despesas operacionais
              </div>
              <h2 className="mt-3 text-2xl font-bold text-white">Despesas</h2>
              <p className="mt-1 text-sm text-slate-400">
                Edite ou remova custos sem recarregar a tela financeira.
              </p>
            </div>

            <button
              onClick={() => openCreateMovement("despesa")}
              disabled={actionLoading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Nova despesa
            </button>
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-white/10 lg:block">
            <table className="w-full">
              <thead className="j12-table-head">
                <tr className="text-left text-xs uppercase tracking-[0.14em]">
                  <th className="px-4 py-4">Descricao</th>
                  <th className="px-4 py-4">Categoria</th>
                  <th className="px-4 py-4">Valor</th>
                  <th className="px-4 py-4">Data</th>
                  <th className="px-4 py-4 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {despesas.map((item) => (
                  <tr key={item.id} className="j12-table-row border-t border-white/8">
                    <td className="px-4 py-4 font-semibold text-white">{item.descricao}</td>
                    <td className="px-4 py-4 text-slate-300">{formatCategory(item.categoria)}</td>
                    <td className="px-4 py-4 text-slate-200">{money(item.valor)}</td>
                    <td className="px-4 py-4 text-slate-300">
                      {formatDate(item.vencimento || item.pagoEm || undefined)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          onClick={() => openEditDespesa(item)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-black transition hover:bg-amber-300"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              type: "despesa",
                              id: item.id,
                              label: item.descricao,
                            })
                          }
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {despesas.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white">{item.descricao}</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {formatCategory(item.categoria)} |{" "}
                      {formatDate(item.vencimento || item.pagoEm || undefined)}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-4 text-xl font-bold text-white">{money(item.valor)}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openEditDespesa(item)}
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-black"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    onClick={() =>
                      setDeleteTarget({
                        type: "despesa",
                        id: item.id,
                        label: item.descricao,
                      })
                    }
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>

          {despesas.length === 0 && (
            <div className="j12-empty-state mt-4 p-8 text-center">
              <p className="font-bold text-white">Nenhuma despesa registrada.</p>
              <p className="mt-2 text-sm text-slate-400">
                Crie uma despesa operacional para acompanhar o fluxo de caixa.
              </p>
            </div>
          )}
        </section>

        <FinancialMovementModal
          open={movementModalOpen}
          onOpenChange={(open) => {
            setMovementModalOpen(open);
            if (!open) setEditingMovement(null);
          }}
          initialType={movementInitialType}
          editing={editingMovement}
          actionLoading={actionLoading}
          onCreateReceita={criarCobranca}
          onUpdateReceita={atualizarCobranca}
          onCreateDespesa={criarDespesa}
          onUpdateDespesa={atualizarDespesa}
        />

        {modalPagamento && mensalidadeSelecionada && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur sm:items-center">
            <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-5 shadow-2xl md:p-7">
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  Baixa financeira
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">Receber mensalidade</h2>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-slate-400">Aluno</p>
                    <p className="mt-1 truncate text-lg font-bold text-white">
                      {mensalidadeSelecionada.aluno_nome}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                    <p className="text-sm text-emerald-100">Valor original</p>
                    <p className="mt-1 text-lg font-bold text-white">
                      {money(mensalidadeSelecionada.valor_atualizado)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-300">
                      Valor recebido
                    </span>
                    <input
                      value={recebimentoValor}
                      onChange={(event) => setRecebimentoValor(formatBRLInput(event.target.value))}
                      className="j12-field h-12 w-full px-4"
                      inputMode="numeric"
                      placeholder="R$ 0,00"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-300">
                      Recebido em
                    </span>
                    <input
                      type="date"
                      value={recebimentoData}
                      onChange={(event) => setRecebimentoData(event.target.value)}
                      className="j12-field h-12 w-full px-4"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">
                    Forma de pagamento
                  </span>
                  <select
                    value={formaPagamento}
                    onChange={(event) => setFormaPagamento(event.target.value)}
                    className="j12-field h-12 w-full px-4"
                  >
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao">Cartao</option>
                    <option value="boleto">Boleto</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">
                    Observacoes
                  </span>
                  <textarea
                    value={recebimentoObservacao}
                    onChange={(event) => setRecebimentoObservacao(event.target.value)}
                    className="j12-field min-h-24 w-full px-4 py-3"
                    placeholder="Ex.: pago parcialmente, comprovante conferido, desconto autorizado"
                  />
                </label>

                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                    <div>
                      <p className="font-bold text-white">Confirme a baixa financeira</p>
                      <p className="mt-1 text-sm text-emerald-100">
                        O registro sera marcado como pago em {formatDate(recebimentoData)} e a
                        tabela sera atualizada automaticamente.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={closeReceiveModal}
                  className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-bold text-white transition hover:bg-white/10"
                >
                  Cancelar
                </button>

                <button
                  onClick={async () => {
                    const valorRecebido = parseBRL(recebimentoValor);
                    if (!recebimentoData) {
                      toast.error("Informe a data do recebimento.");
                      return;
                    }
                    if (valorRecebido <= 0) {
                      toast.error("Informe um valor recebido valido.");
                      return;
                    }

                    try {
                      await receberMensalidade(mensalidadeSelecionada.id, {
                        formaPagamento,
                        pagoEm: recebimentoData,
                        dataPagamento: recebimentoData,
                        valorRecebido,
                        observacao: recebimentoObservacao.trim(),
                      });
                      toast.success("Pagamento confirmado.");
                      closeReceiveModal();
                    } catch (error) {
                      toast.error(
                        formatApiErrorMessage(error, "Nao foi possivel confirmar pagamento."),
                      );
                    }
                  }}
                  disabled={actionLoading}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar pagamento
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur sm:items-center">
            <div className="w-full max-w-md rounded-3xl border border-red-400/20 bg-zinc-950 p-5 shadow-2xl md:p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-400/25 bg-red-500/10 text-red-200">
                  <Trash2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-200">
                    Confirmar exclusao
                  </p>
                  <h2 className="mt-2 text-xl font-black text-white">
                    Excluir {deleteTarget.type === "receita" ? "cobranca" : "despesa"}?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Esta acao remove o registro financeiro e atualiza a tabela automaticamente.
                  </p>
                  <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white">
                    {deleteTarget.label}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-bold text-white transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={actionLoading}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
