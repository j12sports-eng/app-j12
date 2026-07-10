import { AlertCircle, Loader2, MapPinned } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatApiErrorMessage } from "@/lib/api";
import { useBiCourts } from "../hooks/useBiCourts";
import type { CourtMetric, CourtRank } from "../types/bi-courts.types";
import type { BiFoundationFilters, BiPeriod } from "../types/bi-foundation.types";
const labels: Record<string, string> = {
  availableHours: "Horas disponiveis",
  reservedHours: "Horas reservadas",
  occupancyRate: "Taxa de ocupacao",
  rentalRevenue: "Receita de locacoes",
  ticketAverage: "Ticket medio",
  cancellations: "Cancelamentos",
};
export function BiCourtsDashboard() {
  const [f, setF] = useState<BiFoundationFilters>({ period: "CURRENT_MONTH" });
  const valid =
    f.period !== "CUSTOM" || Boolean(f.startDate && f.endDate && f.startDate <= f.endDate);
  const q = useBiCourts(f, valid);
  return (
    <AppShell title="BI de Quadras">
      <div className="space-y-6">
        <header className="j12-surface p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <MapPinned /> BI de quadras e locacoes
              </div>
              <h1 className="mt-3 text-3xl font-black text-white">Ocupacao, demanda e receita</h1>
            </div>
            <Filters f={f} setF={setF} />
          </div>
        </header>
        {q.isLoading && (
          <State icon={<Loader2 className="animate-spin" />} text="Calculando utilizacao..." />
        )}
        {q.isError && (
          <State
            icon={<AlertCircle />}
            text={formatApiErrorMessage(q.error, "Falha ao carregar BI de quadras.")}
          />
        )}{" "}
        {q.data && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(q.data.kpis).map(([k, v]) => (
                <Kpi key={k} label={labels[k]} metric={v} />
              ))}
            </section>
            <section className="grid gap-5 xl:grid-cols-2">
              <Rank title="Ocupacao por quadra" rows={q.data.rankings.courts} />
              <Rank
                title="Receita por quadra"
                rows={q.data.rankings.courts}
                revenue
                unavailable={!q.data.kpis.rentalRevenue.available}
              />
            </section>
            <section className="grid gap-5 lg:grid-cols-3">
              <List title="Horarios de pico" rows={q.data.rankings.hours} />
              <List title="Dias de maior demanda" rows={q.data.rankings.days} />
              <List title="Ocupacao por unidade" rows={q.data.rankings.units} />
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
function Filters({ f, setF }: { f: BiFoundationFilters; setF: (v: BiFoundationFilters) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      <select
        value={f.period}
        onChange={(e) => setF({ period: e.target.value as BiPeriod, unitId: f.unitId })}
        className="min-h-11 rounded-xl bg-black/40 px-3 text-white"
      >
        <option value="CURRENT_MONTH">Mes atual</option>
        <option value="LAST_30_DAYS">Ultimos 30 dias</option>
        <option value="CURRENT_YEAR">Ano atual</option>
        <option value="CUSTOM">Personalizado</option>
      </select>
      <input
        placeholder="Unidade"
        value={f.unitId || ""}
        onChange={(e) => setF({ ...f, unitId: e.target.value || undefined })}
        className="min-h-11 rounded-xl bg-black/40 px-3 text-white"
      />
      {f.period === "CUSTOM" && (
        <>
          <input
            type="date"
            value={f.startDate || ""}
            onChange={(e) => setF({ ...f, startDate: e.target.value })}
          />
          <input
            type="date"
            value={f.endDate || ""}
            onChange={(e) => setF({ ...f, endDate: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
function Kpi({ label, metric }: { label: string; metric: CourtMetric }) {
  return (
    <article className="j12-surface p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-black text-white">
        {metric.available
          ? metric.unit === "currency"
            ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                metric.value || 0,
              )
            : `${metric.value}${metric.unit === "percentage" ? "%" : ""}`
          : "Indisponivel"}
      </p>
    </article>
  );
}
function Rank({
  title,
  rows,
  revenue = false,
  unavailable = false,
}: {
  title: string;
  rows: CourtRank[];
  revenue?: boolean;
  unavailable?: boolean;
}) {
  const data = rows.map((r) => ({
    name: r.courtName,
    value: revenue ? r.revenue : r.occupancyRate,
  }));
  return (
    <article className="j12-surface p-5">
      <h2 className="font-bold text-white">{title}</h2>
      {unavailable ? (
        <div className="mt-4 p-8 text-center text-slate-400">
          Indisponivel: nao ha valor e data de pagamento canonicos na reserva.
        </div>
      ) : data.length ? (
        <ChartContainer
          config={{ value: { label: title, color: "#ff5a1f" } }}
          className="mt-4 h-72"
        >
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" />
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
function List({ title, rows }: { title: string; rows: CourtRank[] }) {
  return (
    <article className="j12-surface p-5">
      <h2 className="font-bold text-white">{title}</h2>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex justify-between rounded-xl bg-white/[0.03] p-3 text-slate-300"
          >
            <span>{r.key}</span>
            <span>{r.reservations} reservas</span>
          </div>
        ))}
      </div>
      {!rows.length && <Empty />}
    </article>
  );
}
function Empty() {
  return <div className="mt-4 p-8 text-center text-slate-400">Sem dados no periodo.</div>;
}
function State({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="j12-empty-state flex gap-3 p-10">
      {icon}
      {text}
    </div>
  );
}
