import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  convertCrmLeadToDraftEnrollment,
  getCrmLeadById,
  listCrmLeads,
} from "../api/crm-leads.api";
import { crmLeadQueryKeys } from "../query/crm-lead.query-keys";
import { crmConversionHistoryQueryKeys } from "../query/crm-conversion-history.query-keys";
import type { CrmLeadDraftEnrollmentPayload, CrmLeadFilters } from "../types/crm-lead.types";

export function useCrmLeads(filters: CrmLeadFilters = {}) {
  const stableFilters = {
    conversionStatus: filters.conversionStatus || undefined,
    limit: filters.limit || 50,
    stage: filters.stage || undefined,
    status: filters.status || undefined,
    unitId: filters.unitId?.trim() || undefined,
  };

  return useInfiniteQuery({
    queryKey: crmLeadQueryKeys.list(stableFilters),
    queryFn: ({ pageParam }) => listCrmLeads({ ...stableFilters, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor ?? undefined,
  });
}

export function useCrmLead(leadId: string | null) {
  return useQuery({
    queryKey: crmLeadQueryKeys.detail(leadId || ""),
    queryFn: () => getCrmLeadById(leadId as string),
    enabled: Boolean(leadId),
  });
}

export function useConvertCrmLeadToDraftEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, payload }: { leadId: string; payload: CrmLeadDraftEnrollmentPayload }) =>
      convertCrmLeadToDraftEnrollment(leadId, payload),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: crmLeadQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: crmLeadQueryKeys.detail(variables.leadId) });
      void queryClient.invalidateQueries({ queryKey: crmConversionHistoryQueryKeys.all });
    },
  });
}
