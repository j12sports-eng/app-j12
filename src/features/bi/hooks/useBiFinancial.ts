import { useQuery } from "@tanstack/react-query";
import { getBiFinancial } from "../api/bi-financial.api";
import { biQueryKeys } from "../query-keys/bi-query-keys";
import type { BiFinancialFilters } from "../types/bi-financial.types";

export function useBiFinancial(filters: BiFinancialFilters, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => getBiFinancial(filters),
    queryKey: biQueryKeys.financial(filters),
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 5 * 60_000,
  });
}
