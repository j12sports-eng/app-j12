import type { CrmLeadStage, CrmLeadStatus } from "./crm-lead.types";

export type CrmLeadHistoryCoverage = "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
export type CrmLeadSlaStatus =
  | "NOT_CONFIGURED"
  | "ON_TRACK"
  | "DUE_SOON"
  | "OVERDUE"
  | "COMPLETED"
  | "UNAVAILABLE";

export type CrmLeadSla = {
  status: CrmLeadSlaStatus;
  limitMs: number | null;
  elapsedMs: number | null;
  remainingMs: number | null;
  overdueMs: number;
  consumedPercentage: number | null;
};

export type CrmLeadStageTimingSummary = {
  currentStageEntryAt: string | null;
  currentStageElapsedMs: number | null;
  historyCoverage: CrmLeadHistoryCoverage;
  measuredAt: string;
  sla: CrmLeadSla;
};

export type CrmLeadStagePeriod = {
  action: string;
  actorId: string;
  durationMs: number;
  entryAt: string;
  exitAt: string | null;
  isCurrent: boolean;
  stage: CrmLeadStage;
};

export type CrmLeadStageAggregate = {
  stage: CrmLeadStage;
  totalDurationMs: number;
  visitCount: number;
  firstEntryAt: string;
  lastEntryAt: string;
  lastExitAt: string | null;
  isCurrent: boolean;
};

export type CrmLeadStageTimingDetail = CrmLeadStageTimingSummary & {
  leadId: string;
  currentStage: CrmLeadStage;
  currentStatus: CrmLeadStatus;
  stages: CrmLeadStageAggregate[];
  timeline: CrmLeadStagePeriod[];
};
