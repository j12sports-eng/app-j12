import { AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatApiErrorMessage } from "@/lib/api";
import { useBiDelinquency } from "../hooks/useBiDelinquency";
import type { DelinquencyMetric, DelinquencyRow } from "../types/bi-delinquency.types";
import type { BiFoundationFilters, BiPeriod } from "../types/bi-foundation.types";
const LABELS: Record<string, string> = {
  overdueValue: "Valor vencido",
  overdueObligations: "Obrigacoes vencidas",
  delinquencyRate: "Taxa de inadimplencia",
  uniqueDebtors: "Inadimplentes unicos",
  recoveredValue: "Valores recuperados",
  recoveredObligations: "Obrigacoes recuperadas",
  recoveryRate: "Taxa de recuperacao",
};
const PERIODS: Array<{ value: BiPeriod; label: string }> = [
  { value: "CURRENT_MONTH", label: "Mes atual" },
  { value: "PREVIOUS_MONTH", label: "Mes anterior" },
  { value: "LAST_30_DAYS", label: "Ultimos 30 dias" },
  { value: "CURRENT_YEAR", label: "Ano atual" },
  { value: "CUSTOM", label: "Personalizado" },
];
export function BiDelinquencyDashboard() {
  const [filters, setFilters] = useState<BiFoundationFilters>({ period: "CURRENT_MONTH" });
  const valid =
    filters.period !== "CUSTOM" ||
    Boolean(filters.startDate && filters.endDate && filters.startDate <= filters.endDate);
  const query = useBiDelinquency(filters, valid);
  return (
    <AppShell title="BI de Inadimplencia">
      <div className="space-y-6">
        <header className="j12-surface p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-primary">
                <ShieldAlert /> BI de inadimplencia e cobrancas
              </div>
              <h1 className="mt-3 text-3xl font-black text-white">
                Aging, cobrancas e recuperacao
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Dados agregados, sem nomes, documentos ou contatos.
              </p>
            </div>
            <Filters value={filters} onChange={setFilters} />
          </div>
          {!valid && <p className="mt-3 text-amber-300">Intervalo personalizado invalido.</p>}
        </header>
        {query.isLoading && (
          <State icon={<Loader2 className="animate-spin" />} text="Calculando inadimplencia..." />
        )}
        {query.isError && (
          <State
            icon={<AlertCircle />}
            text={formatApiErrorMessage(query.error, "Nao foi possivel carregar a inadimplencia.")}
          />
        )}{" "}
        {query.data && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries(query.data.kpis).map(([key, metric]) => (
                <Kpi key={key} label={LABELS[key]} metric={metric} />
              ))}
            </section>
            <section className="grid gap-5 xl:grid-cols-2">
              <Chart title="Aging da inadimplencia" rows={query.data.aging} />
              <Evolution rows={query.data.evolution} />
            </section>
            <Detail title="Cobrancas por status" rows={query.data.statuses} />
          </>
        )}
      </div>
    </AppShell>
  );
}
function Filters({
  value,
  onChange,
}: {
  value: BiFoundationFilters;
  onChange: (v: BiFoundationFilters) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      <select
        aria-label="Periodo"
        value={value.period}
        onChange={(e) => onChange({ period: e.target.value as BiPeriod, unitId: value.unitId })}
        className="min-h-11 rounded-xl bg-black/40 px-3 text-white"
      >
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <input
        aria-label="Unidade"
        placeholder="Unidade (ID)"
        value={value.unitId || ""}
        onChange={(e) => onChange({ ...value, unitId: e.target.value || undefined })}
        className="min-h-11 rounded-xl bg-black/40 px-3 text-white"
      />
      {value.period === "CUSTOM" && (
        <>
          <input
            aria-label="Inicio"
            type="date"
            value={value.startDate || ""}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
            className="min-h-11 rounded-xl bg-black/40 px-3 text-white"
          />
          <input
            aria-label="Fim"
            type="date"
            value={value.endDate || ""}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
            className="min-h-11 rounded-xl bg-black/40 px-3 text-white"
          />
        </>
      )}
    </div>
  );
}
function Kpi({ label, metric }: { label: string; metric: DelinquencyMetric }) {
  const value = metric.available
    ? metric.unit === "currency"
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
          metric.value || 0,
        )
      : metric.unit === "percentage"
        ? `${metric.value}%`
        : metric.value?.toLocaleString("pt-BR")
    : "Indisponivel";
  return (
    <article className="j12-surface p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </article>
  );
}
function Chart({ title, rows }: { title: string; rows: DelinquencyRow[] }) {
  return (
    <article className="j12-surface p-5">
      <h2 className="font-bold text-white">{title}</h2>
      {rows.length ? (
        <ChartContainer
          config={{ value: { label: "Valor", color: "#ff5a1f" } }}
          className="mt-4 h-72"
        >
          <BarChart data={rows}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="key" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="#ff5a1f" radius={5} />
          </BarChart>
        </ChartContainer>
      ) : (
        <Empty />
      )}
    </article>
  );
}
function Evolution({ rows }: { rows: DelinquencyRow[] }) {
  return (
    <article className="j12-surface p-5">
      <h2 className="font-bold text-white">Evolucao por vencimento</h2>
      {rows.length ? (
        <ChartContainer
          config={{ value: { label: "Valor vencido", color: "#f59e0b" } }}
          className="mt-4 h-72"
        >
          <LineChart data={rows}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="key" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="value" stroke="#f59e0b" />
          </LineChart>
        </ChartContainer>
      ) : (
        <Empty />
      )}
    </article>
  );
}
function Detail({ title, rows }: { title: string; rows: DelinquencyRow[] }) {
  return (
    <article className="j12-surface p-5">
      <h2 className="font-bold text-white">{title}</h2>
      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex justify-between rounded-xl bg-white/[0.03] p-3 text-slate-300"
          >
            <span>{row.key}</span>
            <span>{row.quantity} cobranca(s)</span>
          </div>
        ))}
      </div>
      {!rows.length && <Empty />}
    </article>
  );
}
function Empty() {
  return (
    <div className="j12-empty-state mt-4 p-8 text-center text-slate-400">Sem dados no periodo.</div>
  );
}
function State({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="j12-empty-state flex gap-3 p-10 text-slate-300">
      {icon}
      {text}
    </div>
  );
}
