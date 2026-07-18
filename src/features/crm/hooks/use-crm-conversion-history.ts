import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  getCrmConversionHistoryDetail,
  listCrmConversionHistory,
} from "../api/crm-conversion-history.api";
import { crmConversionHistoryQueryKeys } from "../query/crm-conversion-history.query-keys";
import type { CrmConversionHistoryFilters } from "../types/crm-conversion-history.types";

export function useCrmConversionHistory(filters: CrmConversionHistoryFilters = {}) {
  const stableFilters = {
    convertedBy: filters.convertedBy?.trim() || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    enrollmentStatus: filters.enrollmentStatus || undefined,
    leadId: filters.leadId?.trim() || undefined,
    limit: filters.limit || 50,
    unitId: filters.unitId?.trim() || undefined,
  };

  return useInfiniteQuery({
    queryKey: crmConversionHistoryQueryKeys.list(stableFilters),
    queryFn: ({ pageParam }) => listCrmConversionHistory({ ...stableFilters, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor ?? undefined,
  });
}

export function useCrmConversionHistoryDetail(conversionId: string | null) {
  return useQuery({
    queryKey: crmConversionHistoryQueryKeys.detail(conversionId || ""),
    queryFn: () => getCrmConversionHistoryDetail(conversionId as string),
    enabled: Boolean(conversionId),
  });
}
