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
    metrics: false;
    reports: false;
  };
  contractVersion: "21.1";
  filters: {
    applied: BiResolvedFilters;
    supported: Array<"period" | "startDate" | "endDate" | "unitId">;
  };
  readOnly: true;
  repository: {
    available: false;
    reason: "NO_CANONICAL_AGGREGATE_REPOSITORY";
  };
  supportedPeriods: BiPeriod[];
  timezone: "America/Sao_Paulo";
};
