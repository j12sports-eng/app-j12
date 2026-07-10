import { useQuery } from "@tanstack/react-query";
import { getBiChampionships } from "../api/bi-championships.api";
import { biQueryKeys } from "../query-keys/bi-query-keys";
import type { BiChampionshipsFilters } from "../types/bi-championships.types";
export function useBiChampionships(filters: BiChampionshipsFilters, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => getBiChampionships(filters),
    queryKey: biQueryKeys.championships(filters),
    retry: 1,
    staleTime: 300000,
  });
}
