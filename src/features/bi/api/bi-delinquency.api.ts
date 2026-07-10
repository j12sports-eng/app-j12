import { api } from "@/lib/api";
import type { BiDelinquencyContract, BiDelinquencyFilters } from "../types/bi-delinquency.types";
export function getBiDelinquency(filters: BiDelinquencyFilters = {}) {
  const p = new URLSearchParams();
  if (filters.period) p.set("period", filters.period);
  if (filters.startDate) p.set("startDate", filters.startDate);
  if (filters.endDate) p.set("endDate", filters.endDate);
  if (filters.unitId) p.set("unitId", filters.unitId);
  const q = p.toString();
  return api.get<BiDelinquencyContract>(q ? `/admin/bi/delinquency?${q}` : "/admin/bi/delinquency");
}
