import type { CrmLeadStage, CrmLeadStatus } from "./crm-lead.types";
import type { CrmLeadHistoryCoverage, CrmLeadSla } from "./crm-lead-stage-timing.types";

export type CrmSlaAlertStatus =
  | "OVERDUE"
  | "WARNING"
  | "NOT_CONFIGURED"
  | "UNAVAILABLE"
  | "NORMAL"
  | "COMPLETED";

export type CrmSlaAlertFilters = {
  limit?: number;
  slaStatus?: CrmSlaAlertStatus;
  stage?: CrmLeadStage;
  unitId?: string;
};

export type CrmSlaAlertItem = {
  alertStatus: CrmSlaAlertStatus;
  currentStageElapsedMs: number | null;
  currentStageEntryAt: string | null;
  historyCoverage: CrmLeadHistoryCoverage;
  leadId: string;
  measuredAt: string;
  sla: CrmLeadSla;
  stage: CrmLeadStage;
  status: CrmLeadStatus;
  unitId: string;
  updatedAt: string;
};

export type CrmSlaAlertPageCounts = {
  completed: number;
  normal: number;
  notConfigured: number;
  overdue: number;
  unavailable: number;
  warning: number;
};

export type CrmSlaAlertPage = {
  appliedFilters: {
    limit: number;
    slaStatus: CrmSlaAlertStatus | null;
    stage: CrmLeadStage | null;
    unitId: string | null;
  };
  hasMore: boolean;
  items: CrmSlaAlertItem[];
  nextCursor: string | null;
  summary: {
    pageCounts: CrmSlaAlertPageCounts;
  };
};
