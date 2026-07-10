import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Minus,
  WalletCards,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatApiErrorMessage } from "@/lib/api";
import { useBiFinancial } from "../hooks/useBiFinancial";
import type { BiFinancialBreakdown, BiFinancialMetric } from "../types/bi-financial.types";
import type { BiFoundationFilters, BiPeriod } from "../types/bi-foundation.types";

const PERIODS: Array<{ value: BiPeriod; label: string }> = [
  { value: "TODAY", label: "Hoje" },
  { value: "LAST_7_DAYS", label: "Ultimos 7 dias" },
  { value: "LAST_30_DAYS", label: "Ultimos 30 dias" },
  { value: "CURRENT_MONTH", label: "Mes atual" },
  { value: "PREVIOUS_MONTH", label: "Mes anterior" },
  { value: "CURRENT_QUARTER", label: "Trimestre" },
  { value: "CURRENT_YEAR", label: "Ano atual" },
  { value: "CUSTOM", label: "Personalizado" },
];
const KPI_LABELS: Record<string, string> = {
  receivedRevenue: "Receita recebida",
  expectedRevenue: "Receita prevista",
  pendingRevenue: "Receita pendente",
  overdueRevenue: "Receita vencida",
  averageTicket: "Ticket medio",
  expenses: "Despesas pagas",
};
const COLORS = ["#ff5a1f", "#f59e0b", "#22c55e", "#38bdf8", "#a78bfa", "#f472b6"];

export function BiFinancialDashboard() {
  const [filters, setFilters] = useState<BiFoundationFilters>({ period: "CURRENT_MONTH" });
  const valid =
    filters.period !== "CUSTOM" ||
    Boolean(filters.startDate && filters.endDate && filters.startDate <= filters.endDate);
  const query = useBiFinancial(filters, valid);
  return (
    <AppShell title="BI Financeiro">
      <div className="space-y-6">
        <header className="j12-surface p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <WalletCards className="h-4 w-4" /> BI Financeiro
              </div>
              <h1 className="text-3xl font-black text-white">Analise financeira consolidada</h1>
              <p className="mt-2 text-sm text-slate-400">
                Uma unica fonte de valor, sem dupla contagem entre cobrancas, mensalidades e
                pagamentos.
              </p>
            </div>
            <Filters filters={filters} onChange={setFilters} />
          </div>
          {!valid && (
            <p className="mt-4 text-sm text-amber-300">
              Informe um intervalo personalizado valido.
            </p>
          )}
        </header>
        {query.isLoading && (
          <State
            icon={<Loader2 className="h-6 w-6 animate-spin" />}
            text="Consolidando dados financeiros..."
          />
        )}
        {query.isError && (
          <State
            icon={<AlertCircle className="h-6 w-6" />}
            text={formatApiErrorMessage(query.error, "Nao foi possivel carregar o BI financeiro.")}
          />
        )}
        {query.data && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(query.data.kpis).map(([id, kpi]) => (
                <KpiCard key={id} label={KPI_LABELS[id]} metric={kpi} />
              ))}
            </section>
            <section className="grid gap-5 xl:grid-cols-2">
              <Evolution data={query.data.evolution} />
              <Composition title="Receita por categoria" data={query.data.breakdowns.categories} />
            </section>
            <section className="grid gap-5 lg:grid-cols-3">
              <BreakdownTable
                title="Receita por modalidade"
                data={query.data.breakdowns.modalities}
              />
              <BreakdownTable title="Receita por unidade" data={query.data.breakdowns.units} />
              <BreakdownTable
                title="Meios de pagamento"
                data={query.data.breakdowns.paymentMethods}
              />
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Filters({
  filters,
  onChange,
}: {
  filters: BiFoundationFilters;
  onChange: (value: BiFoundationFilters) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-xs text-slate-400">
        Periodo
        <select
          aria-label="Periodo financeiro"
          value={filters.period}
          onChange={(e) => onChange({ period: e.target.value as BiPeriod })}
          className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-white"
        >
          {PERIODS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {filters.period === "CUSTOM" && (
        <>
          <label className="text-xs text-slate-400">
            Inicio
            <input
              aria-label="Data inicial"
              type="date"
              value={filters.startDate || ""}
              onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Fim
            <input
              aria-label="Data final"
              type="date"
              value={filters.endDate || ""}
              onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-white"
            />
          </label>
        </>
      )}
    </div>
  );
}
function KpiCard({ label, metric }: { label: string; metric: BiFinancialMetric }) {
  const comparison = metric.comparison;
  const Icon =
    comparison.trend === "positive"
      ? ArrowUpRight
      : comparison.trend === "negative"
        ? ArrowDownRight
        : Minus;
  return (
    <article className="j12-surface p-5">
      <p className="text-sm font-semibold text-slate-400">{label}</p>
      <p className="mt-4 text-2xl font-black text-white">
        {metric.available ? currency(metric.value || 0) : "Indisponivel"}
      </p>
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-4 w-4" />
        {comparison.available
          ? `${comparison.percent! > 0 ? "+" : ""}${comparison.percent}% vs. periodo anterior`
          : "Comparacao indisponivel"}
      </div>
    </article>
  );
}
function Evolution({ data }: { data: Array<{ period: string; receivedRevenue: number }> }) {
  return (
    <article className="j12-surface p-5">
      <h2 className="text-lg font-bold text-white">Evolucao mensal da receita recebida</h2>
      {data.length ? (
        <ChartContainer
          config={{ receivedRevenue: { label: "Receita", color: "#ff5a1f" } }}
          className="mt-5 h-72 w-full"
        >
          <AreaChart data={data}>
            <defs>
              <linearGradient id="biRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff5a1f" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#ff5a1f" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="period" />
            <YAxis tickFormatter={(value) => compactCurrency(Number(value))} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="receivedRevenue"
              stroke="#ff5a1f"
              fill="url(#biRevenue)"
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <Empty />
      )}
    </article>
  );
}
function Composition({ title, data }: { title: string; data: BiFinancialBreakdown[] }) {
  return (
    <article className="j12-surface p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {data.length ? (
        <div className="grid items-center gap-4 sm:grid-cols-2">
          <ChartContainer
            config={{ value: { label: "Receita", color: "#ff5a1f" } }}
            className="h-72"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="key" />} />
              <Pie data={data} dataKey="value" nameKey="key" innerRadius={55} outerRadius={90}>
                {data.map((row, index) => (
                  <Cell key={row.key} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <BreakdownRows data={data} />
        </div>
      ) : (
        <Empty />
      )}
    </article>
  );
}
function BreakdownTable({ title, data }: { title: string; data: BiFinancialBreakdown[] }) {
  return (
    <article className="j12-surface p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {data.length ? <BreakdownRows data={data} /> : <Empty />}
    </article>
  );
}
function BreakdownRows({ data }: { data: BiFinancialBreakdown[] }) {
  return (
    <div className="mt-4 space-y-2">
      {data.map((row) => (
        <div
          key={row.key}
          className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{label(row.key)}</p>
            <p className="text-xs text-slate-500">{row.quantity} cobranca(s)</p>
          </div>
          <span className="text-sm font-bold text-primary">{currency(row.value)}</span>
        </div>
      ))}
    </div>
  );
}
function Empty() {
  return (
    <div className="j12-empty-state mt-5 p-8 text-center text-sm text-slate-400">
      Sem dados reais no periodo selecionado.
    </div>
  );
}
function State({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="j12-empty-state flex items-center justify-center gap-3 p-10 text-slate-300">
      {icon}
      <span>{text}</span>
    </div>
  );
}
function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
function compactCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
  }).format(value);
}
function label(value: string) {
  return value === "nao_informado" ? "Nao informado" : value.replaceAll("_", " ");
}
