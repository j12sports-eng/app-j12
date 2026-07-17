export type PeriodType =
  | "TODAY"
  | "YESTERDAY"
  | "CURRENT_WEEK"
  | "LAST_7_DAYS"
  | "LAST_30_DAYS"
  | "CURRENT_MONTH"
  | "PREVIOUS_MONTH"
  | "CURRENT_QUARTER"
  | "CURRENT_YEAR"
  | "CUSTOM";

export interface PeriodContext {
  endDate: string;
  inclusive: { endDate: true; startDate: true };
  period: PeriodType;
  startDate: string;
  timezone: "America/Sao_Paulo";
}

export interface PreviousPeriod {
  endDate: string;
  startDate: string;
  timezone: "America/Sao_Paulo";
}

export interface UnitContext {
  authorizedUnitIds: readonly string[];
  mode: "active" | "multi" | "all";
  selectedUnitIds: readonly string[];
}

export interface ResolvedContractFilters {
  period: PeriodContext;
  unit: UnitContext;
  applied: Readonly<Record<string, readonly string[] | string | undefined>>;
  supportedFilters: readonly string[];
}

export type KPIUnit = "average" | "count" | "currency" | "days" | "hours" | "percentage";

export interface KPIComparison {
  available: boolean;
  percent: number | null;
  previousValue: number | null;
  reason: string | null;
  trend: "positive" | "negative" | "neutral" | "unavailable";
}

export interface KPIDefinition<TUnit extends KPIUnit = KPIUnit> {
  available: boolean;
  comparison?: KPIComparison;
  reason: string | null;
  unit: TUnit;
  value: number | null;
}

export interface ContractSource {
  domains: readonly string[];
  name: string;
}

export interface ContractMetadata {
  cacheTtlSeconds: number;
  correlationId?: string;
  partial: boolean;
  warnings: readonly string[];
}

export interface DashboardPermissions {
  actions: readonly string[];
  domains: readonly string[];
  sensitiveValues: boolean;
}

export interface DashboardRuntimeError {
  code: string;
  correlationId?: string;
  domain: string;
  message: string;
  recoverable: boolean;
}

export interface RuntimeState {
  empty: boolean;
  error: DashboardRuntimeError | null;
  fetching: boolean;
  lastUpdate: string | null;
  loading: boolean;
  permissions: DashboardPermissions;
  retry: () => void;
  stale: boolean;
}

export interface WidgetDefinition {
  category: string;
  id: string;
  requiredCapabilities: readonly string[];
  requiredPermissions: readonly string[];
  title: string;
}
