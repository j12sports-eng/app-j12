import type { KPIDefinition } from "../shared";

export type FinancialKPIId =
  | "averageTicket"
  | "expenses"
  | "expectedRevenue"
  | "goalAchievement"
  | "netResult"
  | "overdueRevenue"
  | "pendingRevenue"
  | "receivedRevenue";

export type FinancialKPIs = Record<FinancialKPIId, KPIDefinition<"currency" | "percentage">>;

export interface FinancialBreakdownItem {
  key: string;
  quantity: number;
  value: number;
}

export interface FinancialContractData {
  breakdowns: Readonly<Record<string, readonly FinancialBreakdownItem[]>>;
  evolution: readonly { period: string; receivedRevenue: number }[];
}
