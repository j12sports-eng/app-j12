import { useQuery } from "@tanstack/react-query";
import { getBiClasses } from "../api/bi-classes.api";
import { biQueryKeys } from "../query-keys/bi-query-keys";
import type { BiClassesFilters } from "../types/bi-classes.types";
export function useBiClasses(filters: BiClassesFilters, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => getBiClasses(filters),
    queryKey: biQueryKeys.classes(filters),
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 5 * 60_000,
  });
}
