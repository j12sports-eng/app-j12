import { api } from "@/lib/api";
import type { BiInsightsContract, BiInsightsFilters } from "../types/bi-insights.types";
export async function fetchBiInsights(filters: BiInsightsFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return api.get<BiInsightsContract>(`/admin/bi/insights?${params.toString()}`);
}
