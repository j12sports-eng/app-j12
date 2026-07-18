import { useMutation } from "@tanstack/react-query";
import { downloadCrmConversionHistoryExport } from "../api/crm-conversion-history-export.api";
import type { CrmConversionHistoryFilters } from "../types/crm-conversion-history.types";

export function useCrmConversionHistoryExport() {
  return useMutation({
    mutationFn: (filters: CrmConversionHistoryFilters) =>
      downloadCrmConversionHistoryExport(filters),
  });
}
