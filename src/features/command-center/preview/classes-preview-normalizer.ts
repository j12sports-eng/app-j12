import type { ClassesAdapterInput } from "../adapters/classes";
import type { KPIDefinition, PeriodType } from "../contracts/shared";

type UnknownRecord = Record<string, unknown>;

const COUNT_KPIS = [
  "activeClasses",
  "availableSpots",
  "fullClasses",
  "underutilizedClasses",
] as const;

/** Projects only aggregate, non-personal fields from the existing BI Classes contract. */
export function normalizeClassesPreviewSource(source: unknown): ClassesAdapterInput {
  const root = record(source);
  const filters = record(root.filters);
  const current = record(filters.current);
  const unitId = nullableText(current.unitId);
  const period = normalizePeriod(current.period);

  return {
    capabilities: ["CLASSES_KPIS"],
    contractVersion: text(root.contractVersion) || "unknown",
    data: { classes: [] },
    filters: {
      applied: { period, unitId: unitId ?? undefined },
      period: {
        endDate: text(current.endDate),
        inclusive: { endDate: true, startDate: true },
        period,
        startDate: text(current.startDate),
        timezone: "America/Sao_Paulo",
      },
      supportedFilters: ["period", "startDate", "endDate", "unitId"],
      unit: {
        authorizedUnitIds: unitId ? [unitId] : [],
        mode: unitId ? "active" : "all",
        selectedUnitIds: unitId ? [unitId] : [],
      },
    },
    generatedAt: text(root.generatedAt),
    kpis: {
      ...normalizeCountKpis(root.kpis),
      attendanceRate: unavailableMetric("percentage", "NO_CANONICAL_ATTENDANCE_RATE"),
      occupancyRate: normalizeMetric(record(root.kpis).occupancyRate, "percentage"),
    },
    metadata: { cacheTtlSeconds: 120, partial: true, warnings: [] },
    previousPeriod: {
      endDate: "",
      startDate: "",
      timezone: "America/Sao_Paulo",
    },
    source: { domains: ["classes"], name: "existing-bi-classes-api" },
  };
}

type ClassesPreviewShape = {
  kpis: Readonly<Record<string, { available: boolean; value: number | null }>>;
};

export function isClassesPreviewEmpty(contract: ClassesPreviewShape): boolean {
  return !Object.values(contract.kpis).some(
    (metric) => metric.available && metric.value !== null && metric.value > 0,
  );
}

export function formatClassesPreviewDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function normalizeCountKpis(value: unknown) {
  const kpis = record(value);
  return Object.fromEntries(
    COUNT_KPIS.map((id) => [id, normalizeMetric(kpis[id], "count")]),
  ) as Record<(typeof COUNT_KPIS)[number], KPIDefinition<"count">>;
}

function normalizeMetric<TUnit extends "count" | "percentage">(
  value: unknown,
  unit: TUnit,
): KPIDefinition<TUnit> {
  const metric = record(value);
  const number = nonNegativeNumber(metric.value, unit === "count");
  const available = metric.available === true && number !== null;
  return {
    available,
    reason: available
      ? nullableText(metric.reason)
      : nullableText(metric.reason) || "DATA_UNAVAILABLE",
    unit,
    value: available ? number : null,
  };
}

function unavailableMetric<TUnit extends "count" | "percentage">(
  unit: TUnit,
  reason: string,
): KPIDefinition<TUnit> {
  return { available: false, reason, unit, value: null };
}

function normalizePeriod(value: unknown): PeriodType {
  const period = text(value);
  const supported: PeriodType[] = [
    "TODAY",
    "YESTERDAY",
    "CURRENT_WEEK",
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

function record(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function nonNegativeNumber(value: unknown, integer: boolean): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return integer ? Math.trunc(value) : value;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown): string | null {
  return text(value) || null;
}
