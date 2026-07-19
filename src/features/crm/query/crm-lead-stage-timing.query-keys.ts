export const crmLeadStageTimingQueryKeys = {
  all: ["crm", "lead-stage-timing"] as const,
  detail: (leadId: string) => ["crm", "lead-stage-timing", "detail", leadId] as const,
};

// Reserved for a future bounded global endpoint; invalidation is already centralized.
export const crmLeadSlaQueryKeys = {
  all: ["crm", "lead-sla"] as const,
};
