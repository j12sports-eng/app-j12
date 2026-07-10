export type BiPeriod =
  | "TODAY"
  | "LAST_7_DAYS"
  | "LAST_30_DAYS"
  | "CURRENT_MONTH"
  | "PREVIOUS_MONTH"
  | "CURRENT_QUARTER"
  | "CURRENT_YEAR"
  | "CUSTOM";

export type BiFoundationFilters = {
  endDate?: string;
  period?: BiPeriod;
  startDate?: string;
  unitId?: string;
};

export type BiResolvedFilters = {
  endDate: string;
  inclusive: {
    endDate: true;
    startDate: true;
  };
  period: BiPeriod;
  startDate: string;
  timezone: "America/Sao_Paulo";
  unitId: string | null;
};

export type BiFoundationContract = {
  capabilities: {
    foundation: true;
    metrics: true;
    reports: false;
  };
  contractVersion: "21.1";
  filters: {
    applied: BiResolvedFilters;
    supported: Array<"period" | "startDate" | "endDate" | "unitId">;
  };
  readOnly: true;
  repository: {
    available: true;
    capabilities: ["EXECUTIVE_SNAPSHOT"];
    reason: null;
  };
  supportedPeriods: BiPeriod[];
  timezone: "America/Sao_Paulo";
};

export type BiComparison = {
  available: boolean;
  percent: number | null;
  previousValue: number | null;
  reason: string | null;
  trend: "positive" | "negative" | "neutral" | "unavailable";
};

export type BiKpi = {
  available: boolean;
  comparison: BiComparison;
  reason: string | null;
  unit: "count" | "currency" | "percentage";
  value: number | null;
};

export type BiExecutiveContract = {
  contractVersion: "21.2";
  filters: {
    current: BiResolvedFilters;
    previous: Pick<BiResolvedFilters, "startDate" | "endDate" | "timezone" | "unitId">;
  };
  generatedAt: string;
  kpis: Record<
    | "activeStudents"
    | "averageTicket"
    | "cancellations"
    | "delinquencyRate"
    | "expectedRevenue"
    | "newStudents"
    | "overdueRevenue"
    | "receivedRevenue",
    BiKpi
  >;
  readOnly: true;
};
