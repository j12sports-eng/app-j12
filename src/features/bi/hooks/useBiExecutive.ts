import { useQuery } from "@tanstack/react-query";
import { getBiExecutive } from "../api/bi-executive.api";
import { biQueryKeys } from "../query-keys/bi-query-keys";
import type { BiFoundationFilters } from "../types/bi-foundation.types";

export function useBiExecutive(filters: BiFoundationFilters, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => getBiExecutive(filters),
    queryKey: biQueryKeys.executive(filters),
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 5 * 60_000,
  });
}
