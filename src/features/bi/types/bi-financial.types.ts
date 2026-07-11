import type { BiComparison, BiFoundationFilters, BiResolvedFilters } from "./bi-foundation.types";

export type BiFinancialMetric = {
  available: boolean;
  comparison: BiComparison;
  reason: string | null;
  unit: "currency";
  value: number | null;
};
export type BiFinancialBreakdown = { key: string; quantity: number; value: number };
export type BiInsightComparison = {
  absolute: number | null;
  available: boolean;
  currentValue: number | null;
  percent: number | null;
  previousValue: number | null;
  reason: string | null;
  trend: "growth" | "decline" | "stable" | "unavailable";
};
export type BiFinancialContract = {
  breakdowns: {
    categories: BiFinancialBreakdown[];
    modalities: BiFinancialBreakdown[];
    paymentMethods: BiFinancialBreakdown[];
    units: BiFinancialBreakdown[];
  };
  contractVersion: "21.3";
  evolution: Array<{ period: string; receivedRevenue: number }>;
  filters: {
    current: BiResolvedFilters;
    previous: Pick<BiResolvedFilters, "startDate" | "endDate" | "timezone" | "unitId">;
  };
  generatedAt: string;
  insights: {
    currentVsPrevious: BiInsightComparison;
    goal: {
      achievedPercent: number | null;
      actual: number | null;
      available: boolean;
      difference: number | null;
      goal: number | null;
      reason: string | null;
      status: "unavailable" | "behind" | "on_track" | "achieved";
    };
    receivedRevenue: {
      available: boolean;
      latest: { period: string; value: number } | null;
      monthOverMonth: BiInsightComparison;
      movingAverage: Array<{ period: string; value: number }>;
      reason: string | null;
      trend: {
        direction: "growth" | "decline" | "stable" | "unavailable";
        method: string;
        value: number | null;
      };
      yearOverYear: BiInsightComparison;
    };
  };
  kpis: Record<
    | "averageTicket"
    | "expenses"
    | "expectedRevenue"
    | "overdueRevenue"
    | "pendingRevenue"
    | "receivedRevenue",
    BiFinancialMetric
  >;
  readOnly: true;
};
export type BiFinancialFilters = BiFoundationFilters;
