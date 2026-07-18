import { api } from "@/lib/api";
import type {
  CrmConversionHistoryDetail,
  CrmConversionHistoryFilters,
  CrmConversionHistoryPage,
} from "../types/crm-conversion-history.types";

function buildHistoryQuery(filters: CrmConversionHistoryFilters & { cursor?: string | null }) {
  const params = new URLSearchParams();
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.leadId?.trim()) params.set("leadId", filters.leadId.trim());
  if (filters.unitId?.trim()) params.set("unitId", filters.unitId.trim());
  if (filters.convertedBy?.trim()) params.set("convertedBy", filters.convertedBy.trim());
  if (filters.enrollmentStatus) params.set("enrollmentStatus", filters.enrollmentStatus);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  return params.toString();
}

export async function listCrmConversionHistory(
  filters: CrmConversionHistoryFilters & { cursor?: string | null } = {},
): Promise<CrmConversionHistoryPage> {
  const query = buildHistoryQuery(filters);
  return api.get<CrmConversionHistoryPage>(`/internal/crm/conversions${query ? `?${query}` : ""}`);
}

export async function getCrmConversionHistoryDetail(
  conversionId: string,
): Promise<CrmConversionHistoryDetail> {
  return api.get<CrmConversionHistoryDetail>(
    `/internal/crm/conversions/${encodeURIComponent(conversionId)}`,
  );
}
