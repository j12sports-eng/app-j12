import { useQuery } from "@tanstack/react-query";
import { fetchBiInsights } from "../api/bi-insights.api";
import type { BiInsightsFilters } from "../types/bi-insights.types";
export function useBiInsights(filters: BiInsightsFilters, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => fetchBiInsights(filters),
    queryKey: ["bi", "insights", filters],
  });
}
