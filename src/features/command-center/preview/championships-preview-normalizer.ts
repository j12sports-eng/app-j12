import type { ChampionshipsAdapterInput } from "../adapters/championships";
import type {
  ChampionshipAggregateGroup,
  ChampionshipsKPIId,
  ChampionshipsKPIs,
} from "../contracts/championships";
import type { KPIDefinition, PeriodType } from "../contracts/shared";

type UnknownRecord = Record<string, unknown>;

const CONTRACT_VERSION = "21.8";
const TIMEZONE = "America/Sao_Paulo";
const KPI_UNITS = {
  activeChampionships: "count",
  averageTeams: "average",
  completedChampionships: "count",
  finishedMatches: "count",
  participants: "count",
  pendingMatches: "count",
  registrationRevenue: "currency",
  registrations: "count",
  teams: "count",
} as const satisfies Record<ChampionshipsKPIId, "average" | "count" | "currency">;

/** Keeps aggregate 21.8 fields and drops championship-level rankings and unknown rows. */
export function normalizeChampionshipsPreviewSource(source: unknown): ChampionshipsAdapterInput {
  const root = record(source);
  if (root.contractVersion !== CONTRACT_VERSION || root.readOnly !== true) {
    throw new Error("Contrato BI de Campeonatos incompativel.");
  }

  const current = record(record(root.filters).current);
  const period = normalizePeriod(current.period);
  const rankings = record(root.rankings);

  return {
    capabilities: ["CHAMPIONSHIPS_AGGREGATE_KPIS"],
    contractVersion: CONTRACT_VERSION,
    data: {
      categories: normalizeGroups(rankings.categories, "championships"),
      registrationEvolution: normalizeEvolution(rankings.registrationEvolution),
      statuses: normalizeGroups(rankings.statuses, "championships"),
    },
    filters: {
      applied: { period },
      period: {
        endDate: calendarDate(current.endDate),
        inclusive: { endDate: true, startDate: true },
        period,
        startDate: calendarDate(current.startDate),
        timezone: TIMEZONE,
      },
      supportedFilters: ["period", "startDate", "endDate"],
      unit: { authorizedUnitIds: [], mode: "all", selectedUnitIds: [] },
    },
    generatedAt: instant(root.generatedAt),
    kpis: normalizeKpis(root.kpis),
    metadata: { cacheTtlSeconds: 300, partial: false, warnings: [] },
    source: { domains: ["championships"], name: "bi-championships-aggregate-read-only" },
  };
}

export function isChampionshipsPreviewEmpty(contract: {
  data?: {
    categories: readonly ChampionshipAggregateGroup[];
    registrationEvolution: readonly ChampionshipAggregateGroup[];
    statuses: readonly ChampionshipAggregateGroup[];
  };
  kpis: ChampionshipsKPIs;
}): boolean {
  const hasKpi = Object.values(contract.kpis).some(
    (metric) => metric.available && metric.value !== null && metric.value > 0,
  );
  const data = contract.data;
  return (
    !hasKpi &&
    ![
      ...(data?.categories ?? []),
      ...(data?.registrationEvolution ?? []),
      ...(data?.statuses ?? []),
    ].some((item) => item.value > 0)
  );
}

export function formatChampionshipsPreviewDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: TIMEZONE,
  }).format(date);
}

function normalizeKpis(value: unknown): ChampionshipsKPIs {
  const kpis = record(value);
  return Object.fromEntries(
    Object.entries(KPI_UNITS).map(([id, unit]) => [id, normalizeMetric(kpis[id], unit)]),
  ) as ChampionshipsKPIs;
}

function normalizeMetric<TUnit extends "average" | "count" | "currency">(
  value: unknown,
  unit: TUnit,
): KPIDefinition<TUnit> {
  const metric = record(value);
  const number = nonNegativeNumber(metric.value, unit === "count");
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

function normalizeGroups(value: unknown, valueField: "championships") {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const group = record(item);
    const key = text(group.key);
    const number = nonNegativeNumber(group[valueField], true);
    return key && number !== null ? [{ key, value: number }] : [];
  });
}

function normalizeEvolution(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const group = record(item);
    const key = calendarDate(group.key);
    const number = nonNegativeNumber(group.registrations, true);
    return key && number !== null ? [{ key, value: number }] : [];
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
  return supported.includes(period as PeriodType) ? (period as PeriodType) : "CURRENT_YEAR";
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

function nonNegativeNumber(value: unknown, integer: boolean): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return integer ? Math.trunc(value) : value;
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
