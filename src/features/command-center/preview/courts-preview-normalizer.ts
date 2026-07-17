import type { CourtsAdapterInput } from "../adapters/arena";
import type { CourtsKPIId, CourtsKPIs } from "../contracts/arena";
import type { KPIDefinition, PeriodType } from "../contracts/shared";

type UnknownRecord = Record<string, unknown>;

const CONTRACT_VERSION = "21.7";
const TIMEZONE = "America/Sao_Paulo";
const KPI_UNITS = {
  availableHours: "hours",
  cancellations: "count",
  occupancyRate: "percentage",
  rentalRevenue: "currency",
  reservedHours: "hours",
  ticketAverage: "currency",
} as const satisfies Record<CourtsKPIId, "count" | "currency" | "hours" | "percentage">;

/** Projects only aggregate KPIs; all court, reservation and ranking rows are discarded. */
export function normalizeCourtsPreviewSource(source: unknown): CourtsAdapterInput {
  const root = record(source);
  if (root.contractVersion !== CONTRACT_VERSION || root.readOnly !== true) {
    throw new Error("Contrato BI de Quadras incompativel.");
  }

  const current = record(record(root.filters).current);
  const period = normalizePeriod(current.period);
  const unitId = nullableText(current.unitId);

  return {
    capabilities: ["COURTS_AGGREGATE_KPIS"],
    contractVersion: CONTRACT_VERSION,
    data: {},
    filters: {
      applied: { period, unitId: unitId ?? undefined },
      period: {
        endDate: calendarDate(current.endDate),
        inclusive: { endDate: true, startDate: true },
        period,
        startDate: calendarDate(current.startDate),
        timezone: TIMEZONE,
      },
      supportedFilters: ["period", "startDate", "endDate", "unitId"],
      unit: {
        authorizedUnitIds: unitId ? [unitId] : [],
        mode: unitId ? "active" : "all",
        selectedUnitIds: unitId ? [unitId] : [],
      },
    },
    generatedAt: instant(root.generatedAt),
    kpis: normalizeKpis(root.kpis),
    metadata: { cacheTtlSeconds: 300, partial: false, warnings: [] },
    source: { domains: ["courts"], name: "bi-courts-aggregate-read-only" },
  };
}

export function isCourtsPreviewEmpty(contract: { kpis: CourtsKPIs }): boolean {
  return !Object.values(contract.kpis).some(
    (metric) => metric.available && metric.value !== null && metric.value > 0,
  );
}

export function formatCourtsPreviewDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: TIMEZONE,
  }).format(date);
}

function normalizeKpis(value: unknown): CourtsKPIs {
  const kpis = record(value);
  return Object.fromEntries(
    Object.entries(KPI_UNITS).map(([id, unit]) => [id, normalizeMetric(kpis[id], unit)]),
  ) as CourtsKPIs;
}

function normalizeMetric<TUnit extends "count" | "currency" | "hours" | "percentage">(
  value: unknown,
  unit: TUnit,
): KPIDefinition<TUnit> {
  const metric = record(value);
  const number = validNumber(metric.value, unit);
  const available = metric.available === true && metric.unit === unit && number !== null;
  return {
    available,
    reason: available
      ? nullableText(metric.reason)
      : nullableText(metric.reason) || "DATA_UNAVAILABLE",
    unit,
    value: available ? number : null,
  };
}

function validNumber(value: unknown, unit: string): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  if (unit === "percentage" && value > 100) return null;
  return unit === "count" ? Math.trunc(value) : value;
}

function normalizePeriod(value: unknown): PeriodType {
  const period = text(value);
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
  return supported.includes(period as PeriodType) ? (period as PeriodType) : "CURRENT_MONTH";
}

function calendarDate(value: unknown): string {
  const candidate = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return "";
  const date = new Date(`${candidate}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === candidate
    ? candidate
    : "";
}

function instant(value: unknown): string {
  const candidate = text(value);
  const date = new Date(candidate);
  return candidate && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
}

function record(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown): string | null {
  return text(value) || null;
}
