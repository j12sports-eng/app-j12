import { AlertCircle, Loader2, Trophy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { formatApiErrorMessage } from "@/lib/api";
import { useBiChampionships } from "../hooks/useBiChampionships";
import type { ChampionshipMetric } from "../types/bi-championships.types";
import type { BiFoundationFilters, BiPeriod } from "../types/bi-foundation.types";
const labels: Record<string, string> = {
  activeChampionships: "Campeonatos ativos",
  completedChampionships: "Campeonatos realizados",
  teams: "Equipes inscritas",
  registrations: "Inscricoes confirmadas",
  participants: "Participantes",
  finishedMatches: "Partidas realizadas",
  pendingMatches: "Partidas pendentes",
  averageTeams: "Media de equipes",
  registrationRevenue: "Receita de inscricoes",
};
export function BiChampionshipsDashboard() {
  const [filters, setFilters] = useState<BiFoundationFilters>({ period: "CURRENT_YEAR" });
  const valid =
    filters.period !== "CUSTOM" ||
    Boolean(filters.startDate && filters.endDate && filters.startDate <= filters.endDate);
  const query = useBiChampionships(filters, valid);
  return (
    <AppShell title="BI de Campeonatos">
      <div className="space-y-6">
        <header className="j12-surface flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Trophy /> BI de campeonatos e eventos
            </div>
            <h1 className="mt-3 text-3xl font-black text-white">Competicoes, equipes e partidas</h1>
          </div>
          <Filters value={filters} onChange={setFilters} />
        </header>
        {!valid && <State icon={<AlertCircle />} text="Informe um periodo personalizado valido." />}
        {query.isLoading && (
          <State icon={<Loader2 className="animate-spin" />} text="Calculando indicadores..." />
        )}
        {query.isError && (
          <State
            icon={<AlertCircle />}
            text={formatApiErrorMessage(query.error, "Falha ao carregar BI de campeonatos.")}
          />
        )}
        {query.data && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(query.data.kpis).map(([key, metric]) => (
                <Kpi key={key} label={labels[key]} metric={metric} />
              ))}
            </section>
            <section className="grid gap-5 lg:grid-cols-2">
              <List
                title="Distribuicao por categoria"
                rows={query.data.rankings.categories.map((row) => ({
                  key: row.key,
                  value: row.championships || 0,
                }))}
              />
              <List
                title="Evolucao de inscricoes"
                rows={query.data.rankings.registrationEvolution.map((row) => ({
                  key: row.key,
                  value: row.registrations || 0,
                }))}
              />
            </section>
            <section className="j12-surface overflow-x-auto p-5">
              <h2 className="font-bold text-white">Ranking administrativo</h2>
              {query.data.rankings.championships.length ? (
                <table className="mt-4 w-full text-left text-sm text-slate-300">
                  <thead>
                    <tr>
                      <th>Campeonato</th>
                      <th>Categoria</th>
                      <th>Equipes</th>
                      <th>Inscricoes</th>
                      <th>Partidas realizadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.rankings.championships.map((row) => (
                      <tr key={row.championshipId} className="border-t border-white/10">
                        <td className="py-3">{row.championshipName}</td>
                        <td>{row.category}</td>
                        <td>{row.teams}</td>
                        <td>{row.registrations}</td>
                        <td>{row.finishedMatches}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Empty />
              )}
            </section>
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
  onChange: (value: BiFoundationFilters) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <select
        className="min-h-11 rounded-xl bg-black/40 px-3 text-white"
        value={value.period}
        onChange={(event) => onChange({ period: event.target.value as BiPeriod })}
      >
        <option value="CURRENT_MONTH">Mes atual</option>
        <option value="LAST_30_DAYS">Ultimos 30 dias</option>
        <option value="CURRENT_YEAR">Ano atual</option>
        <option value="CUSTOM">Personalizado</option>
      </select>
      {value.period === "CUSTOM" && (
        <>
          <input
            type="date"
            value={value.startDate || ""}
            onChange={(event) => onChange({ ...value, startDate: event.target.value })}
          />
          <input
            type="date"
            value={value.endDate || ""}
            onChange={(event) => onChange({ ...value, endDate: event.target.value })}
          />
        </>
      )}
    </div>
  );
}
function Kpi({ label, metric }: { label: string; metric: ChampionshipMetric }) {
  return (
    <article className="j12-surface p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-black text-white">
        {metric.available ? metric.value : "Indisponivel"}
      </p>
      {!metric.available && <p className="mt-2 text-xs text-slate-500">Sem fonte canonica</p>}
    </article>
  );
}
function List({ title, rows }: { title: string; rows: Array<{ key: string; value: number }> }) {
  return (
    <article className="j12-surface p-5">
      <h2 className="font-bold text-white">{title}</h2>
      {rows.length ? (
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex justify-between rounded-xl bg-white/[0.03] p-3 text-slate-300"
            >
              <span>{row.key}</span>
              <span>{row.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <Empty />
      )}
    </article>
  );
}
function Empty() {
  return <div className="p-8 text-center text-slate-400">Sem dados no periodo.</div>;
}
function State({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="j12-empty-state flex gap-3 p-10">
      {icon}
      {text}
    </div>
  );
}
