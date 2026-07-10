import { useQuery } from "@tanstack/react-query";

import { getBiFoundation } from "../api/bi-foundation.api";
import { biQueryKeys } from "../query-keys/bi-query-keys";

import type { BiFoundationFilters } from "../types/bi-foundation.types";

const BI_FOUNDATION_STALE_TIME_MS = 5 * 60_000;

export function useBiFoundation(filters: BiFoundationFilters = {}, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => getBiFoundation(filters),
    queryKey: biQueryKeys.foundation(filters),
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: BI_FOUNDATION_STALE_TIME_MS,
  });
}
