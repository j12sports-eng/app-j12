export type AutomationHistoryStatus =
  | "STARTED"
  | "SUCCEEDED"
  | "FAILED"
  | "WARNING"
  | "TIMED_OUT"
  | "CANCELLED";

export type AutomationHistoryRecord = {
  id: string;
  executionId: string;
  automationName: string;
  workflowName: string | null;
  triggerType: string | null;
  status: AutomationHistoryStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  attempt: number;
  correlationId: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AutomationHistoryFilters = {
  page?: number;
  limit?: number;
  startedFrom?: string;
  startedTo?: string;
  status?: string;
  workflowName?: string;
  automationName?: string;
  correlationId?: string;
  executionId?: string;
  triggerType?: string;
  sortBy?: "startedAt" | "finishedAt" | "durationMs";
  sortDirection?: "asc" | "desc";
};

export type AutomationHistoryPage = {
  items: AutomationHistoryRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

export type AutomationExecutionTimeline = { executionId: string; items: AutomationHistoryRecord[] };
