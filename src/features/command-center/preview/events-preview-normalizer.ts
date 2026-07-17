import type { EventsAdapterInput } from "../adapters/events";
import type { EventAggregateGroup, EventsKPIs } from "../contracts/events";
import type { KPIDefinition, PeriodType } from "../contracts/shared";
type UnknownRecord = Record<string, unknown>;
const VERSION = "27.12";
const TIMEZONE = "America/Sao_Paulo";
const KPI_IDS = ["totalEvents", "publishedEvents", "completedEvents", "upcomingEvents"] as const;
export function normalizeEventsPreviewSource(source: unknown): EventsAdapterInput {
  const root = record(source);
  if (root.version !== VERSION || root.readOnly !== true || root.source !== "j12_campeonatos")
    throw new Error("Contrato BI de Eventos incompativel.");
  const current = record(record(root.filters).current);
  const period = normalizePeriod(current.period);
  const dimensions = record(root.dimensions);
  return {
    capabilities: ["EVENTS_AGGREGATE_KPIS"],
    contractVersion: VERSION,
    data: {
      monthlyEvolution: groups(dimensions.monthlyEvolution, "period"),
      eventsByType: groups(dimensions.eventsByType, "type"),
      eventsByStatus: groups(dimensions.eventsByStatus, "status"),
    },
    filters: {
      applied: { period },
      period: {
        startDate: date(current.startDate),
        endDate: date(current.endDate),
        inclusive: { startDate: true, endDate: true },
        period,
        timezone: TIMEZONE,
      },
      supportedFilters: ["period", "startDate", "endDate"],
      unit: { authorizedUnitIds: [], selectedUnitIds: [], mode: "all" },
    },
    generatedAt: instant(root.generatedAt),
    kpis: normalizeKpis(root.kpis),
    metadata: { cacheTtlSeconds: 300, partial: false, warnings: [] },
    source: { domains: ["events"], name: "bi-events-aggregate-read-only" },
  };
}
export function isEventsPreviewEmpty(contract: {
  data?: Partial<Record<keyof EventsAdapterInput["data"], readonly EventAggregateGroup[]>>;
  kpis: EventsKPIs;
}) {
  return (
    !Object.values(contract.kpis).some(
      (metric) => metric.available && metric.value !== null && metric.value > 0,
    ) &&
    ![
      ...(contract.data?.monthlyEvolution ?? []),
      ...(contract.data?.eventsByType ?? []),
      ...(contract.data?.eventsByStatus ?? []),
    ].some((item) => item.value > 0)
  );
}
export function formatEventsPreviewDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: TIMEZONE,
  }).format(parsed);
}
function normalizeKpis(value: unknown): EventsKPIs {
  const source = record(value);
  return Object.fromEntries(KPI_IDS.map((id) => [id, metric(source[id])])) as EventsKPIs;
}
function metric(value: unknown): KPIDefinition<"count"> {
  const source = record(value);
  const number = nonNegative(source.value);
  const available = source.available === true && source.unit === "count" && number !== null;
  return {
    available,
    reason: available ? null : text(source.reason) || "DATA_UNAVAILABLE",
    unit: "count",
    value: available ? number : null,
  };
}
function groups(value: unknown, field: "period" | "type" | "status") {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = record(item);
    const key = field === "period" ? month(row[field]) : label(row[field]);
    const count = nonNegative(row.events);
    return key && count !== null ? [{ key, value: count }] : [];
  });
}
function nonNegative(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : null;
}
function label(value: unknown) {
  const result = text(value);
  return result && result.length <= 80 ? result : "";
}
function month(value: unknown) {
  const result = text(value);
  return /^\d{4}-\d{2}$/.test(result) ? result : "";
}
function date(value: unknown) {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) return "";
  const parsed = new Date(`${result}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === result
    ? result
    : "";
}
function instant(value: unknown) {
  const result = text(value);
  const parsed = new Date(result);
  return result && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : "";
}
function normalizePeriod(value: unknown): PeriodType {
  const result = text(value);
  const supported: PeriodType[] = [
    "TODAY",
    "LAST_7_DAYS",
    "LAST_30_DAYS",
    "CURRENT_MONTH",
    "PREVIOUS_MONTH",
    "CURRENT_QUARTER",
    "CURRENT_YEAR",
    "CUSTOM",
  ];
  return supported.includes(result as PeriodType) ? (result as PeriodType) : "CURRENT_YEAR";
}
function record(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}
function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
