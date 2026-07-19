import { api } from "@/lib/api";
import type { CrmSlaAlertFilters, CrmSlaAlertPage } from "../types/crm-sla-alerts.types";

type CrmSlaAlertListRequest = CrmSlaAlertFilters & {
  cursor?: string | null;
};

function buildCrmSlaAlertsQuery(filters: CrmSlaAlertListRequest) {
  const params = new URLSearchParams();
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.slaStatus) params.set("slaStatus", filters.slaStatus);
  if (filters.unitId?.trim()) params.set("unitId", filters.unitId.trim());
  return params.toString();
}

export async function listCrmSlaAlerts(
  filters: CrmSlaAlertListRequest = {},
  signal?: AbortSignal,
): Promise<CrmSlaAlertPage> {
  const query = buildCrmSlaAlertsQuery(filters);
  return api.get<CrmSlaAlertPage>(`/internal/crm/sla-alerts${query ? `?${query}` : ""}`, {
    signal,
  });
}
