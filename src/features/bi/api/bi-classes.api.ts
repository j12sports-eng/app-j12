import { api } from "@/lib/api";
import type { BiClassesContract, BiClassesFilters } from "../types/bi-classes.types";
const ENDPOINT = "/admin/bi/classes";
export function getBiClasses(filters: BiClassesFilters = {}) {
  const params = new URLSearchParams();
  if (filters.period) params.set("period", filters.period);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.unitId) params.set("unitId", filters.unitId);
  const query = params.toString();
  return api.get<BiClassesContract>(query ? `${ENDPOINT}?${query}` : ENDPOINT);
}
