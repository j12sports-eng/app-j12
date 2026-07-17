import type { StudentsAdapterInput } from "../adapters/students";
import type { KPIDefinition, KPIUnit, PeriodType } from "../contracts/shared";

const AVAILABLE_KPI_IDS = [
  "activeEnrollments",
  "activeStudents",
  "newEnrollments",
  "newStudents",
] as const;

const UNAVAILABLE_KPIS = {
  averageTenureDays: ["days", "NO_CANONICAL_COMPLETE_TENURE_INTERVALS"],
  cancellations: ["count", "NO_CANONICAL_CANCELLATION_TIMESTAMP"],
  churnRate: ["percentage", "NO_CANONICAL_CANCELLATION_HISTORY"],
  netGrowth: ["count", "NO_CANONICAL_EXIT_SERIES"],
  retentionRate: ["percentage", "NO_HISTORICAL_ENROLLMENT_SNAPSHOTS"],
} as const;

type UnknownRecord = Record<string, unknown>;

/** Normalizes only aggregate data from the existing students BI contract. */
export function normalizeStudentsPreviewSource(source: unknown): StudentsAdapterInput {
  const root = record(source);
  const filters = record(root.filters);
  const current = record(filters.current);
  const previous = record(filters.previous);
  const unitId = nullableText(current.unitId);
  const period = normalizePeriod(current.period);

  return {
    capabilities: ["STUDENTS_KPIS", "STUDENTS_DISTRIBUTIONS", "STUDENTS_EVOLUTION"],
    contractVersion: text(root.contractVersion) || "unknown",
    data: {
      distributions: normalizeDistributions(root.distributions),
      evolution: normalizeEvolution(root.evolution),
    },
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
      ...normalizeAvailableKpis(root.kpis),
      averageTenureDays: unavailableMetric(...UNAVAILABLE_KPIS.averageTenureDays),
      cancellations: unavailableMetric(...UNAVAILABLE_KPIS.cancellations),
      churnRate: unavailableMetric(...UNAVAILABLE_KPIS.churnRate),
      netGrowth: unavailableMetric(...UNAVAILABLE_KPIS.netGrowth),
      retentionRate: unavailableMetric(...UNAVAILABLE_KPIS.retentionRate),
    },
    metadata: { cacheTtlSeconds: 120, partial: true, warnings: [] },
    previousPeriod: {
      endDate: text(previous.endDate),
      startDate: text(previous.startDate),
      timezone: "America/Sao_Paulo",
    },
    source: { domains: ["students"], name: "existing-bi-students-api" },
  };
}

type StudentsPreviewShape = {
  data?: {
    distributions: Readonly<Record<string, readonly unknown[]>>;
    evolution: readonly unknown[];
  };
  kpis: Readonly<Record<string, { available: boolean; value: number | null }>>;
};

export function isStudentsPreviewEmpty(contract: StudentsPreviewShape): boolean {
  const hasMetricValue = Object.values(contract.kpis).some(
    (metric) => metric.available && metric.value !== null && metric.value > 0,
  );
  const hasEvolution = (contract.data?.evolution.length ?? 0) > 0;
  const hasDistribution = Object.values(contract.data?.distributions ?? {}).some(
    (items) => items.length > 0,
  );
  return !hasMetricValue && !hasEvolution && !hasDistribution;
}

export function formatStudentsPreviewDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function normalizeAvailableKpis(value: unknown) {
  const kpis = record(value);
  return Object.fromEntries(
    AVAILABLE_KPI_IDS.map((id) => [id, normalizeCountMetric(kpis[id])]),
  ) as Record<(typeof AVAILABLE_KPI_IDS)[number], KPIDefinition<"count">>;
}

function normalizeCountMetric(value: unknown): KPIDefinition<"count"> {
  const metric = record(value);
  const count = nonNegativeInteger(metric.value);
  const available = metric.available === true && count !== null;
  return {
    available,
    reason: available
      ? nullableText(metric.reason)
      : nullableText(metric.reason) || "DATA_UNAVAILABLE",
    unit: "count",
    value: available ? count : null,
  };
}

function unavailableMetric<TUnit extends KPIUnit>(
  unit: TUnit,
  reason: string,
): KPIDefinition<TUnit> {
  return { available: false, reason, unit, value: null };
}

function normalizeDistributions(value: unknown) {
  const distributions = record(value);
  return Object.fromEntries(
    ["ageGroups", "modalities", "units"].map((key) => [
      key,
      array(distributions[key]).map((item) => {
        const row = record(item);
        return { key: text(row.key) || "nao_informado", value: nonNegativeInteger(row.value) ?? 0 };
      }),
    ]),
  );
}

function normalizeEvolution(value: unknown) {
  return array(value).map((item) => {
    const row = record(item);
    return {
      newEnrollments: nonNegativeInteger(row.newEnrollments) ?? 0,
      newStudents: nonNegativeInteger(row.newStudents) ?? 0,
      period: text(row.period),
    };
  });
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

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown): string | null {
  return text(value) || null;
}
