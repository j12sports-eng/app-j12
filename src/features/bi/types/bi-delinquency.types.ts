import type { BiFoundationFilters, BiResolvedFilters } from "./bi-foundation.types";
export type DelinquencyMetric = {
  available: boolean;
  reason: string | null;
  unit: "count" | "currency" | "percentage";
  value: number | null;
};
export type DelinquencyRow = { key: string; quantity: number; value: number };
export type BiDelinquencyContract = {
  aging: DelinquencyRow[];
  contractVersion: "21.6";
  evolution: DelinquencyRow[];
  filters: { current: BiResolvedFilters };
  generatedAt: string;
  kpis: Record<
    | "delinquencyRate"
    | "overdueObligations"
    | "overdueValue"
    | "recoveredObligations"
    | "recoveredValue"
    | "recoveryRate"
    | "uniqueDebtors",
    DelinquencyMetric
  >;
  readOnly: true;
  statuses: DelinquencyRow[];
};
export type BiDelinquencyFilters = BiFoundationFilters;
