import { api } from "@/lib/api";
import type {
  CrmLeadDetail,
  CrmLeadDraftEnrollmentPayload,
  CrmLeadFilters,
  CrmLeadListItem,
  CrmLeadPage,
  CrmLeadConversionResult,
} from "../types/crm-lead.types";

function buildQuery(filters: CrmLeadFilters & { cursor?: string | null }) {
  const params = new URLSearchParams();
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.status) params.set("status", filters.status);
  if (filters.conversionStatus) params.set("conversionStatus", filters.conversionStatus);
  if (filters.unitId?.trim()) params.set("unitId", filters.unitId.trim());
  return params.toString();
}

export async function listCrmLeads(
  filters: CrmLeadFilters & { cursor?: string | null } = {},
): Promise<CrmLeadPage> {
  const query = buildQuery(filters);
  return api.get<CrmLeadPage>(`/internal/crm/leads${query ? `?${query}` : ""}`);
}

export async function getCrmLeadById(leadId: string): Promise<CrmLeadDetail> {
  return api.get<CrmLeadDetail>(`/internal/crm/leads/${encodeURIComponent(leadId)}`);
}

export async function convertCrmLeadToDraftEnrollment(
  leadId: string,
  payload: CrmLeadDraftEnrollmentPayload,
): Promise<CrmLeadConversionResult> {
  return api.post<CrmLeadConversionResult>(
    `/internal/crm/leads/${encodeURIComponent(leadId)}/draft-enrollment`,
    payload,
  );
}

export type { CrmLeadDetail, CrmLeadListItem };
