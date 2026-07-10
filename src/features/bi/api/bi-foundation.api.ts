import { api } from "@/lib/api";

import type { BiFoundationContract, BiFoundationFilters } from "../types/bi-foundation.types";

const BI_FOUNDATION_ENDPOINT = "/admin/bi/foundation";

export function getBiFoundation(filters: BiFoundationFilters = {}) {
  const params = new URLSearchParams();

  if (filters.period) params.set("period", filters.period);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.unitId) params.set("unitId", filters.unitId);

  const query = params.toString();
  return api.get<BiFoundationContract>(
    query ? `${BI_FOUNDATION_ENDPOINT}?${query}` : BI_FOUNDATION_ENDPOINT,
  );
}
