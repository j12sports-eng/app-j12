import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  convertCrmLeadToDraftEnrollment,
  getCrmLeadById,
  listCrmLeads,
} from "../api/crm-leads.api";
import { crmLeadQueryKeys } from "../query/crm-lead.query-keys";
import { crmConversionHistoryQueryKeys } from "../query/crm-conversion-history.query-keys";
import { crmPipelineQueryKeys } from "../query/crm-pipeline.query-keys";
import {
  moveCrmLeadStage,
  type CrmLeadStageTransitionInput,
} from "../api/crm-lead-stage-transition.api";
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
    onError: (error, variables) => {
      if ((error as { data?: { code?: string } })?.data?.code === "CRM_STAGE_CONFLICT") {
        void queryClient.invalidateQueries({ queryKey: crmLeadQueryKeys.all });
        void queryClient.invalidateQueries({ queryKey: crmLeadQueryKeys.detail(variables.leadId) });
        void queryClient.invalidateQueries({ queryKey: crmPipelineQueryKeys.all });
        void queryClient.invalidateQueries({ queryKey: crmConversionHistoryQueryKeys.all });
      }
    },
  });
}

export function useMoveCrmLeadStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, input }: { leadId: string; input: CrmLeadStageTransitionInput }) =>
      moveCrmLeadStage(leadId, input),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: crmLeadQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: crmLeadQueryKeys.detail(variables.leadId) });
      void queryClient.invalidateQueries({ queryKey: crmPipelineQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: crmConversionHistoryQueryKeys.all });
    },
  });
}
