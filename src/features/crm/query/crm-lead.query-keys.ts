export const crmLeadQueryKeys = {
  all: ["crm", "leads"] as const,
  detail: (leadId: string) => ["crm", "leads", "detail", leadId] as const,
  list: (filters: Record<string, unknown>) => ["crm", "leads", "list", filters] as const,
};
