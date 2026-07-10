import { api } from "@/lib/api";
import type { BiExecutiveContract, BiFoundationFilters } from "../types/bi-foundation.types";

const BI_EXECUTIVE_ENDPOINT = "/admin/bi/executive";

export function getBiExecutive(filters: BiFoundationFilters = {}) {
  const params = new URLSearchParams();
  if (filters.period) params.set("period", filters.period);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.unitId) params.set("unitId", filters.unitId);
  const query = params.toString();
  return api.get<BiExecutiveContract>(
    query ? `${BI_EXECUTIVE_ENDPOINT}?${query}` : BI_EXECUTIVE_ENDPOINT,
  );
}
