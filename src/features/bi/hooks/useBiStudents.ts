import { useQuery } from "@tanstack/react-query";
import { getBiStudents } from "../api/bi-students.api";
import { biQueryKeys } from "../query-keys/bi-query-keys";
import type { BiStudentsFilters } from "../types/bi-students.types";
export function useBiStudents(filters: BiStudentsFilters, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => getBiStudents(filters),
    queryKey: biQueryKeys.students(filters),
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 5 * 60_000,
  });
}
