import { useQuery } from "@tanstack/react-query";
import { getBiDelinquency } from "../api/bi-delinquency.api";
import { biQueryKeys } from "../query-keys/bi-query-keys";
import type { BiDelinquencyFilters } from "../types/bi-delinquency.types";
export function useBiDelinquency(filters: BiDelinquencyFilters, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => getBiDelinquency(filters),
    queryKey: biQueryKeys.delinquency(filters),
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 300000,
  });
}
