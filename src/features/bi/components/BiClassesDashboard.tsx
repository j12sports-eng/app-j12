import { AlertCircle, Building2, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatApiErrorMessage } from "@/lib/api";
import { useBiClasses } from "../hooks/useBiClasses";
import type {
  BiClassesDimensionItem,
  BiClassesMetric,
  BiClassRow,
} from "../types/bi-classes.types";
import type { BiFoundationFilters } from "../types/bi-foundation.types";

const LABELS: Record<string, string> = {
  activeClasses: "Turmas ativas",
  totalCapacity: "Capacidade valida",
  enrolledStudents: "Alunos matriculados",
  occupancyRate: "Taxa de ocupacao",
  availableSpots: "Vagas disponiveis",
  fullClasses: "Turmas lotadas",
  underutilizedClasses: "Turmas subutilizadas",
};
export function BiClassesDashboard() {
  const [filters, setFilters] = useState<BiFoundationFilters>({ period: "CURRENT_MONTH" });
  const query = useBiClasses(filters);
  return (
    <AppShell title="BI de Turmas e Ocupacao">
      <div className="space-y-6">
        <header className="j12-surface p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <Building2 className="h-4 w-4" /> BI operacional
              </div>
              <h1 className="text-3xl font-black text-white">Turmas, ocupacao e vagas</h1>
              <p className="mt-2 text-sm text-slate-400">
                Snapshot atual com capacidade canonica e matriculas ativas sem duplicidade.
              </p>
            </div>
            <label className="text-xs text-slate-400">
              Unidade (ID)
              <input
                aria-label="Unidade"
                inputMode="numeric"
                value={filters.unitId || ""}
                onChange={(event) =>
                  setFilters({ ...filters, unitId: event.target.value || undefined })
                }
                placeholder="Todas"
                className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-white"
              />
            </label>
          </div>
        </header>
        {query.isLoading && (
          <State
            icon={<Loader2 className="h-6 w-6 animate-spin" />}
            text="Calculando ocupacao das turmas..."
          />
        )}
        {query.isError && (
          <State
            icon={<AlertCircle className="h-6 w-6" />}
            text={formatApiErrorMessage(query.error, "Nao foi possivel carregar o BI de turmas.")}
          />
        )}{" "}
        {query.data && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries(query.data.kpis).map(([key, value]) => (
                <Kpi key={key} label={LABELS[key]} metric={value} />
              ))}
            </section>
            <section className="grid gap-5 xl:grid-cols-2">
              <Ranking items={query.data.dimensions.units.items || []} />
              <Critical rows={query.data.table} />
            </section>
            <OperationalTable rows={query.data.table} />
            <section className="grid gap-5 lg:grid-cols-3">
              <Dimension title="Por modalidade" items={query.data.dimensions.modalities.items} />
              <Dimension title="Por dia da semana" items={query.data.dimensions.daysOfWeek.items} />
              <Dimension title="Por horario" items={query.data.dimensions.schedules.items} />
            </section>
            <article className="j12-surface p-5">
              <h2 className="font-bold text-white">Categoria</h2>
              <p className="mt-2 text-sm text-amber-300">
                Indisponivel: nao existe categoria canonica em j12_turmas.
              </p>
            </article>
          </>
        )}
      </div>
    </AppShell>
  );
}
function Kpi({ label, metric }: { label: string; metric: BiClassesMetric }) {
  return (
    <article className="j12-surface p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-black text-white">
        {metric.available
          ? metric.unit === "percentage"
            ? `${metric.value}%`
            : metric.value?.toLocaleString("pt-BR")
          : "Indisponivel"}
      </p>
      {metric.reason && <p className="mt-2 text-xs text-amber-300">Sem capacidade valida</p>}
    </article>
  );
}
function Ranking({ items }: { items: BiClassesDimensionItem[] }) {
  return (
    <article className="j12-surface p-5">
      <h2 className="text-lg font-bold text-white">Ocupacao por unidade</h2>
      {items.length ? (
        <ChartContainer
          config={{ occupancyRate: { label: "Ocupacao", color: "#ff5a1f" } }}
          className="mt-4 h-72"
        >
          <BarChart data={items}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="key" />
            <YAxis domain={[0, "auto"]} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="occupancyRate" fill="#ff5a1f" radius={5} />
          </BarChart>
        </ChartContainer>
      ) : (
        <Empty />
      )}
    </article>
  );
}
function Critical({ rows }: { rows: BiClassRow[] }) {
  const critical = rows.filter(
    (row) => row.active && (row.full || row.underutilized || !row.capacityValid),
  );
  return (
    <article className="j12-surface p-5">
      <h2 className="text-lg font-bold text-white">Turmas criticas</h2>
      {critical.length ? (
        <div className="mt-4 space-y-2">
          {critical.map((row) => (
            <div key={row.classId} className="rounded-xl border border-white/10 p-3">
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-white">{row.className}</span>
                <span className={row.full ? "text-rose-300" : "text-amber-300"}>
                  {!row.capacityValid ? "Capacidade ausente" : row.full ? "Lotada" : "Subutilizada"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty />
      )}
    </article>
  );
}
function OperationalTable({ rows }: { rows: BiClassRow[] }) {
  return (
    <article className="j12-surface overflow-hidden">
      <div className="p-5">
        <h2 className="text-lg font-bold text-white">Tabela operacional</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              {[
                "Turma",
                "Unidade",
                "Modalidade",
                "Professor",
                "Horario",
                "Ocupacao",
                "Capacidade",
                "Vagas",
                "Taxa",
              ].map((label) => (
                <th key={label} className="px-4 py-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.classId} className="border-t border-white/8 text-slate-200">
                <td className="px-4 py-3 font-semibold text-white">{row.className}</td>
                <td className="px-4 py-3">{row.unit}</td>
                <td className="px-4 py-3">{row.modality}</td>
                <td className="px-4 py-3">{row.professorName || "Nao informado"}</td>
                <td className="px-4 py-3">
                  {row.startTime || "-"}
                  {row.endTime ? ` - ${row.endTime}` : ""}
                </td>
                <td className="px-4 py-3">{row.occupancy}</td>
                <td className="px-4 py-3">{row.capacity ?? "Indisponivel"}</td>
                <td className="px-4 py-3">{row.availableSpots ?? "-"}</td>
                <td className="px-4 py-3">
                  {row.occupancyRate == null ? "-" : `${row.occupancyRate}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty />}
      </div>
    </article>
  );
}
function Dimension({ title, items }: { title: string; items: BiClassesDimensionItem[] | null }) {
  return (
    <article className="j12-surface p-5">
      <h2 className="font-bold text-white">{title}</h2>
      {items?.length ? (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item.key} className="flex justify-between rounded-xl bg-white/[0.03] p-3">
              <span className="text-slate-300">{item.key}</span>
              <span className="font-bold text-primary">
                {item.occupancyRate == null ? "-" : `${item.occupancyRate}%`}
              </span>
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
  return (
    <div className="j12-empty-state mt-4 p-6 text-center text-sm text-slate-400">
      Sem dados para o filtro selecionado.
    </div>
  );
}
function State({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="j12-empty-state flex items-center justify-center gap-3 p-10 text-slate-300">
      {icon}
      {text}
    </div>
  );
}
