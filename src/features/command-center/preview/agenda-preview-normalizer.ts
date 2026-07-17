import type { AgendaAdapterInput } from "../adapters/agenda";
import type { AgendaKPIId, AgendaKPIs } from "../contracts/agenda";
import type { KPIDefinition, PeriodType } from "../contracts/shared";

type UnknownRecord = Record<string, unknown>;

const CONTRACT_VERSION = "21.12";
const TIMEZONE = "America/Sao_Paulo";
const COUNT_KPIS = [
  "activeRecurrenceSeries",
  "cancelledOccurrences",
  "cancelledRecurrenceSeries",
  "modifiedOccurrences",
  "recurrenceSeries",
] as const satisfies readonly AgendaKPIId[];
const ALLOWED_WARNINGS = new Set([
  "RECURRENCE_OCCURRENCES_NOT_MATERIALIZED",
  "AGENDA_DATE_COLUMNS_HAVE_NO_DEDICATED_INDEX",
]);

/** Projects the external BI response onto the non-personal Command Center contract. */
export function normalizeAgendaPreviewSource(source: unknown): AgendaAdapterInput {
  const root = record(source);
  if (root.contractVersion !== CONTRACT_VERSION || root.readOnly !== true) {
    throw new Error("Contrato BI de Agenda incompativel.");
  }

  const filters = record(root.filters);
  const current = record(filters.current);
  const period = normalizePeriod(current.period);
  const unitId = nullableText(current.unitId);
  const warnings = stringArray(root.warnings).filter((warning) => ALLOWED_WARNINGS.has(warning));

  return {
    capabilities: ["AGENDA_AGGREGATE_KPIS"],
    contractVersion: CONTRACT_VERSION,
    data: {
      exceptionTypes: normalizeExceptionTypes(record(root.distributions).exceptionTypes),
      timeline: normalizeTimeline(root.timeline),
    },
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
    metadata: {
      cacheTtlSeconds: 120,
      partial: warnings.length > 0,
      warnings,
    },
    source: { domains: ["agenda"], name: "bi-agenda-aggregate-read-only" },
  };
}

type AgendaPreviewShape = {
  data?: {
    exceptionTypes: readonly { value: number }[];
    timeline: readonly {
      cancelledOccurrences: number;
      modifiedOccurrences: number;
    }[];
  };
  kpis: AgendaKPIs;
};

export function isAgendaPreviewEmpty(contract: AgendaPreviewShape): boolean {
  const hasKpi = Object.values(contract.kpis).some(
    (metric) => metric.available && metric.value !== null && metric.value > 0,
  );
  const hasDistribution = (contract.data?.exceptionTypes ?? []).some((item) => item.value > 0);
  const hasTimeline = (contract.data?.timeline ?? []).some(
    (item) => item.cancelledOccurrences > 0 || item.modifiedOccurrences > 0,
  );
  return !hasKpi && !hasDistribution && !hasTimeline;
}

export function formatAgendaPreviewDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: TIMEZONE,
  }).format(date);
}

function normalizeKpis(value: unknown): AgendaKPIs {
  const kpis = record(value);
  const counts = Object.fromEntries(
    COUNT_KPIS.map((id) => [id, normalizeMetric(kpis[id], "count")]),
  ) as Pick<AgendaKPIs, (typeof COUNT_KPIS)[number]>;
  return {
    ...counts,
    cancellationRate: normalizeMetric(kpis.cancellationRate, "percentage"),
  };
}

function normalizeMetric<TUnit extends "count" | "percentage">(
  value: unknown,
  unit: TUnit,
): KPIDefinition<TUnit> {
  const metric = record(value);
  const number = nonNegativeNumber(metric.value, unit === "count");
  const available = metric.available === true && number !== null && metric.unit === unit;
  return {
    available,
    reason: available
      ? nullableText(metric.reason)
      : nullableText(metric.reason) || "DATA_UNAVAILABLE",
    unit,
    value: available ? number : null,
  };
}

function normalizeExceptionTypes(
  value: unknown,
): Array<{ key: "CANCELLED" | "MODIFIED"; value: number }> {
  const distribution = record(value);
  if (distribution.available !== true || !Array.isArray(distribution.items)) return [];
  return distribution.items.flatMap((item) => {
    const entry = record(item);
    const key = entry.key;
    const number = nonNegativeNumber(entry.value, true);
    if ((key !== "CANCELLED" && key !== "MODIFIED") || number === null) return [];
    return [{ key, value: number }];
  });
}

function normalizeTimeline(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const point = record(item);
    const date = calendarDate(point.date);
    const cancelledOccurrences = nonNegativeNumber(point.cancelledOccurrences, true);
    const modifiedOccurrences = nonNegativeNumber(point.modifiedOccurrences, true);
    if (!date || cancelledOccurrences === null || modifiedOccurrences === null) return [];
    return [{ cancelledOccurrences, date, modifiedOccurrences }];
  });
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
  if (!candidate) return "";
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function nonNegativeNumber(value: unknown, integer: boolean): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return integer ? Math.trunc(value) : value;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
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
