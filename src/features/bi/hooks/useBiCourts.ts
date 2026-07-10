import { useQuery } from "@tanstack/react-query";
import { getBiCourts } from "../api/bi-courts.api";
import { biQueryKeys } from "../query-keys/bi-query-keys";
import type { BiCourtsFilters } from "../types/bi-courts.types";
export function useBiCourts(filters: BiCourtsFilters, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => getBiCourts(filters),
    queryKey: biQueryKeys.courts(filters),
    retry: 1,
    staleTime: 300000,
  });
}
