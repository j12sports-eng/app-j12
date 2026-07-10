import { AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, Loader2, Minus } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatApiErrorMessage } from "@/lib/api";
import { useBiExecutive } from "../hooks/useBiExecutive";
import type { BiFoundationFilters, BiKpi, BiPeriod } from "../types/bi-foundation.types";

const PERIODS: Array<{ value: BiPeriod; label: string }> = [
  { value: "TODAY", label: "Hoje" },
  { value: "LAST_7_DAYS", label: "Ultimos 7 dias" },
  { value: "LAST_30_DAYS", label: "Ultimos 30 dias" },
  { value: "CURRENT_MONTH", label: "Mes atual" },
  { value: "PREVIOUS_MONTH", label: "Mes anterior" },
  { value: "CURRENT_QUARTER", label: "Trimestre atual" },
  { value: "CURRENT_YEAR", label: "Ano atual" },
  { value: "CUSTOM", label: "Personalizado" },
];
const KPI_LABELS: Record<string, string> = {
  activeStudents: "Alunos ativos",
  newStudents: "Novos alunos",
  cancellations: "Cancelamentos",
  receivedRevenue: "Receita recebida",
  expectedRevenue: "Receita prevista",
  overdueRevenue: "Receita vencida",
  delinquencyRate: "Inadimplencia",
  averageTicket: "Ticket medio",
};

export function BiExecutiveDashboard() {
  const [filters, setFilters] = useState<BiFoundationFilters>({ period: "CURRENT_MONTH" });
  const customValid =
    filters.period !== "CUSTOM" ||
    Boolean(filters.startDate && filters.endDate && filters.startDate <= filters.endDate);
  const query = useBiExecutive(filters, customValid);

  return (
    <AppShell title="BI Executivo">
      <div className="space-y-6">
        <header className="j12-surface overflow-hidden p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <BarChart3 className="h-4 w-4" /> Inteligencia executiva
              </div>
              <h1 className="text-3xl font-black text-white">Visao real da operacao</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Indicadores auditados de matriculas e financeiro, sem estimativas ou dados
                ficticios.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-slate-400">
                Periodo
                <select
                  aria-label="Periodo"
                  value={filters.period}
                  onChange={(e) => setFilters({ period: e.target.value as BiPeriod })}
                  className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white"
                >
                  {PERIODS.map((period) => (
                    <option key={period.value} value={period.value}>
                      {period.label}
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
                      onChange={(e) =>
                        setFilters((value) => ({ ...value, startDate: e.target.value }))
                      }
                      className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-white"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Fim
                    <input
                      aria-label="Data final"
                      type="date"
                      value={filters.endDate || ""}
                      onChange={(e) =>
                        setFilters((value) => ({ ...value, endDate: e.target.value }))
                      }
                      className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-white"
                    />
                  </label>
                </>
              )}
            </div>
          </div>
          {!customValid && (
            <p className="mt-4 text-sm text-amber-300">
              Informe um intervalo personalizado valido.
            </p>
          )}
        </header>
        {query.isLoading && (
          <State
            icon={<Loader2 className="h-6 w-6 animate-spin" />}
            text="Carregando indicadores reais..."
          />
        )}
        {query.isError && (
          <State
            icon={<AlertCircle className="h-6 w-6" />}
            text={formatApiErrorMessage(query.error, "Nao foi possivel carregar o BI.")}
          />
        )}
        {query.data && (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(query.data.kpis).map(([id, kpi]) => (
              <KpiCard key={id} label={KPI_LABELS[id]} kpi={kpi} />
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}

function KpiCard({ label, kpi }: { label: string; kpi: BiKpi }) {
  if (!kpi.available)
    return (
      <article className="j12-surface p-5 opacity-80">
        <p className="text-sm font-semibold text-slate-300">{label}</p>
        <p className="mt-5 text-lg font-bold text-slate-500">Indisponivel</p>
        <p className="mt-2 text-xs text-slate-500">
          Fonte temporal confiavel ainda nao disponivel.
        </p>
      </article>
    );
  const formatted =
    kpi.unit === "currency"
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
          kpi.value ?? 0,
        )
      : kpi.unit === "percentage"
        ? `${(kpi.value ?? 0).toLocaleString("pt-BR")}%`
        : (kpi.value ?? 0).toLocaleString("pt-BR");
  const comparison = kpi.comparison;
  const Icon =
    comparison.trend === "positive"
      ? ArrowUpRight
      : comparison.trend === "negative"
        ? ArrowDownRight
        : Minus;
  return (
    <article className="j12-surface p-5">
      <p className="text-sm font-semibold text-slate-400">{label}</p>
      <p className="mt-4 text-2xl font-black text-white">{formatted}</p>
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-4 w-4" />
        {comparison.available
          ? `${comparison.percent! > 0 ? "+" : ""}${comparison.percent}% vs. periodo anterior`
          : "Comparacao indisponivel"}
      </div>
    </article>
  );
}
function State({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="j12-empty-state flex items-center justify-center gap-3 p-10 text-slate-300">
      {icon}
      <span>{text}</span>
    </div>
  );
}
