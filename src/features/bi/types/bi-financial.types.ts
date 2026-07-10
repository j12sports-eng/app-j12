import type { BiComparison, BiFoundationFilters, BiResolvedFilters } from "./bi-foundation.types";

export type BiFinancialMetric = {
  available: boolean;
  comparison: BiComparison;
  reason: string | null;
  unit: "currency";
  value: number | null;
};
export type BiFinancialBreakdown = { key: string; quantity: number; value: number };
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
