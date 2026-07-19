import { crmLeadSlaQueryKeys } from "./crm-lead-stage-timing.query-keys";

// Mantém os alertas sob a raiz já invalidada por transições e conversões do CRM.
export const crmSlaAlertsQueryKeys = {
  all: crmLeadSlaQueryKeys.all,
  lists: () => [...crmLeadSlaQueryKeys.all, "alerts", "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...crmLeadSlaQueryKeys.all, "alerts", "list", filters] as const,
};
