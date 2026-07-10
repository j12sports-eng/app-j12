import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  GraduationCap,
  Loader2,
  Minus,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatApiErrorMessage } from "@/lib/api";
import { useBiStudents } from "../hooks/useBiStudents";
import type { BiStudentsDimension, BiStudentsMetric } from "../types/bi-students.types";
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
  activeStudents: "Alunos ativos",
  activeEnrollments: "Matriculas ativas",
  newStudents: "Novos alunos",
  newEnrollments: "Novas matriculas",
  cancellations: "Cancelamentos",
  netGrowth: "Saldo liquido",
  retentionRate: "Retencao",
  churnRate: "Churn",
  averageTenureDays: "Permanencia media",
  transfers: "Transferencias",
};
const COLORS = ["#ff5a1f", "#f59e0b", "#22c55e", "#38bdf8", "#a78bfa", "#f472b6"];

export function BiStudentsDashboard() {
  const [filters, setFilters] = useState<BiFoundationFilters>({ period: "CURRENT_MONTH" });
  const valid =
    filters.period !== "CUSTOM" ||
    Boolean(filters.startDate && filters.endDate && filters.startDate <= filters.endDate);
  const query = useBiStudents(filters, valid);
  return (
    <AppShell title="BI de Alunos">
      <div className="space-y-6">
        <header className="j12-surface p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <GraduationCap className="h-4 w-4" /> BI de alunos e matriculas
              </div>
              <h1 className="text-3xl font-black text-white">Jornada de entrada e base ativa</h1>
              <p className="mt-2 text-sm text-slate-400">
                Pessoa, perfil Aluno e matricula medidos separadamente, sem dados pessoais.
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
            text="Carregando analytics de alunos..."
          />
        )}
        {query.isError && (
          <State
            icon={<AlertCircle className="h-6 w-6" />}
            text={formatApiErrorMessage(query.error, "Nao foi possivel carregar o BI de alunos.")}
          />
        )}{" "}
        {query.data && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(query.data.kpis).map(([id, metric]) => (
                <KpiCard key={id} label={KPI_LABELS[id]} metric={metric} />
              ))}
            </section>
            <section className="grid gap-5 xl:grid-cols-2">
              <Evolution data={query.data.evolution} />
              <Distribution
                title="Alunos por faixa etaria"
                data={query.data.distributions.ageGroups}
              />
            </section>
            <section className="grid gap-5 lg:grid-cols-2">
              <DistributionTable
                title="Alunos por modalidade"
                data={query.data.distributions.modalities}
              />
              <DistributionTable title="Alunos por unidade" data={query.data.distributions.units} />
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs text-slate-400">
        Periodo
        <select
          aria-label="Periodo de alunos"
          value={filters.period}
          onChange={(e) => onChange({ period: e.target.value as BiPeriod, unitId: filters.unitId })}
          className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-white"
        >
          {PERIODS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-400">
        Unidade (ID)
        <input
          aria-label="Unidade"
          inputMode="numeric"
          value={filters.unitId || ""}
          onChange={(e) => onChange({ ...filters, unitId: e.target.value || undefined })}
          className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-white"
          placeholder="Todas"
        />
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
function KpiCard({ label, metric }: { label: string; metric: BiStudentsMetric }) {
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
        {metric.available ? (metric.value || 0).toLocaleString("pt-BR") : "Indisponivel"}
      </p>
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-4 w-4" />
        {comparison.available
          ? `${comparison.percent! > 0 ? "+" : ""}${comparison.percent}% vs. periodo anterior`
          : metric.available
            ? "Comparacao indisponivel"
            : "Sem evento temporal canonico"}
      </div>
    </article>
  );
}
function Evolution({
  data,
}: {
  data: Array<{ newEnrollments: number; newStudents: number; period: string }>;
}) {
  return (
    <article className="j12-surface p-5">
      <h2 className="text-lg font-bold text-white">Entradas mensais</h2>
      <p className="mt-1 text-xs text-slate-500">
        Saidas indisponiveis: nao existe timestamp canonico de cancelamento.
      </p>
      {data.length ? (
        <ChartContainer
          config={{
            newStudents: { label: "Alunos", color: "#ff5a1f" },
            newEnrollments: { label: "Matriculas", color: "#38bdf8" },
          }}
          className="mt-5 h-72 w-full"
        >
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="period" />
            <YAxis allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="newStudents" fill="#ff5a1f" radius={4} />
            <Bar dataKey="newEnrollments" fill="#38bdf8" radius={4} />
          </BarChart>
        </ChartContainer>
      ) : (
        <Empty />
      )}
    </article>
  );
}
function Distribution({ title, data }: { title: string; data: BiStudentsDimension[] }) {
  return (
    <article className="j12-surface p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {data.length ? (
        <div className="grid items-center gap-4 sm:grid-cols-2">
          <ChartContainer
            config={{ value: { label: "Alunos", color: "#ff5a1f" } }}
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
          <Rows data={data} />
        </div>
      ) : (
        <Empty />
      )}
    </article>
  );
}
function DistributionTable({ title, data }: { title: string; data: BiStudentsDimension[] }) {
  return (
    <article className="j12-surface p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {data.length ? <Rows data={data} /> : <Empty />}
    </article>
  );
}
function Rows({ data }: { data: BiStudentsDimension[] }) {
  return (
    <div className="mt-4 space-y-2">
      {data.map((row) => (
        <div
          key={row.key}
          className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
        >
          <span className="truncate text-sm font-semibold text-white">{label(row.key)}</span>
          <span className="text-sm font-bold text-primary">
            {row.value.toLocaleString("pt-BR")}
          </span>
        </div>
      ))}
    </div>
  );
}
function Empty() {
  return (
    <div className="j12-empty-state mt-5 p-8 text-center text-sm text-slate-400">
      Sem dados agregados no periodo.
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
function label(value: string) {
  return value === "nao_informado" ? "Nao informado" : value.replaceAll("_", " ");
}
