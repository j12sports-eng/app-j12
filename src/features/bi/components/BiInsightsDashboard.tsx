import { AlertCircle, Info, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatApiErrorMessage } from "@/lib/api";
import { useBiInsights } from "../hooks/useBiInsights";
import type { BiFoundationFilters, BiPeriod } from "../types/bi-foundation.types";
import type { BiInsightSeverity } from "../types/bi-insights.types";
const STYLE: Record<BiInsightSeverity, string> = {
  critical: "border-red-500/40 bg-red-500/10",
  warning: "border-amber-400/40 bg-amber-400/10",
  success: "border-emerald-400/40 bg-emerald-400/10",
  info: "border-sky-400/30 bg-sky-400/10",
};
export function BiInsightsDashboard() {
  const [filters, setFilters] = useState<BiFoundationFilters>({ period: "CURRENT_MONTH" });
  const query = useBiInsights(filters);
  return (
    <AppShell title="Insights do BI">
      <div className="space-y-6">
        <header className="j12-surface flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" /> Regras administrativas explicaveis
            </p>
            <h1 className="mt-2 text-3xl font-black text-white">Alertas e insights priorizados</h1>
            <p className="mt-2 text-sm text-slate-400">
              Regras determinísticas sobre dados consolidados. Nenhum alerta afirma causalidade ou
              utiliza IA.
            </p>
          </div>
          <select
            aria-label="Periodo dos insights"
            value={filters.period}
            onChange={(event) => setFilters({ period: event.target.value as BiPeriod })}
            className="min-h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-white"
          >
            <option value="CURRENT_MONTH">Mes atual</option>
            <option value="LAST_30_DAYS">Ultimos 30 dias</option>
            <option value="CURRENT_YEAR">Ano atual</option>
          </select>
        </header>
        {query.isLoading && (
          <State icon={<Loader2 className="animate-spin" />} text="Avaliando regras..." />
        )}
        {query.isError && (
          <State
            icon={<AlertCircle />}
            text={formatApiErrorMessage(query.error, "Nao foi possivel gerar insights.")}
          />
        )}
        {query.data && !query.data.insights.length && (
          <State
            icon={<Info />}
            text="Nenhum alerta foi acionado para o periodo e limites atuais."
          />
        )}
        {query.data && (
          <section className="grid gap-4 lg:grid-cols-2">
            {query.data.insights.map((item) => (
              <article key={item.id} className={`rounded-2xl border p-5 ${STYLE[item.severity]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {item.severity} · {item.dataSource}
                    </p>
                    <h2 className="mt-2 text-lg font-black text-white">{item.title}</h2>
                  </div>
                  <ShieldAlert className="h-5 w-5 text-primary" />
                </div>
                <p className="mt-3 text-sm text-slate-300">{item.description}</p>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <Metric label="Atual" value={item.currentMetric} />
                  <Metric label="Anterior" value={item.previousReference} />
                  <Metric
                    label="Variacao"
                    value={item.variation === null ? null : `${item.variation}%`}
                  />
                </dl>
                <p className="mt-4 rounded-xl bg-black/20 p-3 text-sm text-slate-200">
                  <strong>Acao recomendada:</strong> {item.action}
                </p>
              </article>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
function Metric({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-bold text-white">{value ?? "Indisponivel"}</dd>
    </div>
  );
}
function State({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="j12-empty-state flex items-center justify-center gap-3 p-10 text-slate-300">
      {icon}
      {text}
    </div>
  );
}
