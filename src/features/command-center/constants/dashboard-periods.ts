import type { BiPeriod } from "@/features/bi/types/bi-foundation.types";

export type DashboardPeriodOption = {
  label: string;
  value: BiPeriod;
};

export const DASHBOARD_PERIODS: DashboardPeriodOption[] = [
  { label: "Hoje", value: "TODAY" },
  { label: "Últimos 7 dias", value: "LAST_7_DAYS" },
  { label: "Últimos 30 dias", value: "LAST_30_DAYS" },
  { label: "Mês atual", value: "CURRENT_MONTH" },
  { label: "Mês anterior", value: "PREVIOUS_MONTH" },
  { label: "Trimestre atual", value: "CURRENT_QUARTER" },
  { label: "Ano atual", value: "CURRENT_YEAR" },
  { label: "Personalizado", value: "CUSTOM" },
];

export const DEFAULT_DASHBOARD_PERIOD: BiPeriod = "CURRENT_MONTH";
