import type { FinancialAdapterInput } from "../adapters/financial";
import type { KPIDefinition, PeriodType } from "../contracts/shared";

const KPI_IDS = [
  "averageTicket",
  "expenses",
  "expectedRevenue",
  "overdueRevenue",
  "pendingRevenue",
  "receivedRevenue",
] as const;

type UnknownRecord = Record<string, unknown>;

/** Normalizes the untrusted API boundary without deriving financial values. */
export function normalizeFinancialPreviewSource(source: unknown): FinancialAdapterInput {
  const root = record(source);
  const filters = record(root.filters);
  const current = record(filters.current);
  const previous = record(filters.previous);
  const unitId = nullableText(current.unitId);
  const period = normalizePeriod(current.period);

  return {
    capabilities: ["FINANCIAL_KPIS", "FINANCIAL_BREAKDOWNS", "FINANCIAL_EVOLUTION"],
    contractVersion: text(root.contractVersion) || "unknown",
    data: {
      breakdowns: normalizeBreakdowns(root.breakdowns),
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
      ...normalizeKpis(root.kpis),
      goalAchievement: normalizeMetric(
        record(record(root.insights).goal).achievedPercent,
        "percentage",
      ),
      netResult: unavailableMetric(
        "A fonte BI financeira atual não fornece resultado líquido.",
        "currency",
      ),
    },
    metadata: {
      cacheTtlSeconds: 120,
      partial: true,
      warnings: ["Resultado líquido indisponível na fonte BI financeira atual."],
    },
    previousPeriod: {
      endDate: text(previous.endDate),
      startDate: text(previous.startDate),
      timezone: "America/Sao_Paulo",
    },
    source: { domains: ["financial"], name: "existing-bi-financial-api" },
  };
}

type FinancialPreviewShape = {
  data?: {
    breakdowns: Readonly<Record<string, readonly unknown[]>>;
    evolution: readonly unknown[];
  };
  kpis: Readonly<Record<string, { available: boolean }>>;
};

export function isFinancialPreviewEmpty(contract: FinancialPreviewShape): boolean {
  const hasKpi = Object.values(contract.kpis).some((metric) => metric.available);
  const hasEvolution = (contract.data?.evolution.length ?? 0) > 0;
  const hasBreakdown = Object.values(contract.data?.breakdowns ?? {}).some(
    (records) => records.length > 0,
  );
  return !hasKpi && !hasEvolution && !hasBreakdown;
}

export function formatPreviewDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function normalizeKpis(value: unknown) {
  const kpis = record(value);
  return Object.fromEntries(KPI_IDS.map((id) => [id, normalizeSourceMetric(kpis[id])])) as Record<
    (typeof KPI_IDS)[number],
    KPIDefinition<"currency">
  >;
}

function normalizeSourceMetric(value: unknown): KPIDefinition<"currency"> {
  const metric = record(value);
  const normalized = normalizeMetric(metric.value, "currency");
  return {
    ...normalized,
    available: metric.available === true && normalized.value !== null,
    reason:
      metric.available === true && normalized.value !== null
        ? nullableText(metric.reason)
        : nullableText(metric.reason) || "DATA_UNAVAILABLE",
  };
}

function normalizeMetric<TUnit extends "currency" | "percentage">(
  value: unknown,
  unit: TUnit,
): KPIDefinition<TUnit> {
  const amount = finiteNumber(value);
  return {
    available: amount !== null,
    reason: amount === null ? "DATA_UNAVAILABLE" : null,
    unit,
    value: amount,
  };
}

function unavailableMetric<TUnit extends "currency" | "percentage">(
  reason: string,
  unit: TUnit,
): KPIDefinition<TUnit> {
  return { available: false, reason, unit, value: null };
}

function normalizeBreakdowns(value: unknown) {
  const breakdowns = record(value);
  return Object.fromEntries(
    ["categories", "modalities", "paymentMethods", "units"].map((key) => [
      key,
      array(breakdowns[key]).map((item) => {
        const row = record(item);
        return {
          key: text(row.key) || "nao_informado",
          quantity: Math.trunc(finiteNumber(row.quantity) ?? 0),
          value: finiteNumber(row.value) ?? 0,
        };
      }),
    ]),
  );
}

function normalizeEvolution(value: unknown) {
  return array(value).map((item) => {
    const row = record(item);
    return {
      period: text(row.period),
      receivedRevenue: finiteNumber(row.receivedRevenue) ?? 0,
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

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown): string | null {
  return text(value) || null;
}
