import { api } from "@/lib/api";
import type { BiFinancialContract, BiFinancialFilters } from "../types/bi-financial.types";

const BI_FINANCIAL_ENDPOINT = "/admin/bi/financial";

export function getBiFinancial(filters: BiFinancialFilters = {}) {
  const params = new URLSearchParams();
  if (filters.period) params.set("period", filters.period);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.unitId) params.set("unitId", filters.unitId);
  const query = params.toString();
  return api.get<BiFinancialContract>(
    query ? `${BI_FINANCIAL_ENDPOINT}?${query}` : BI_FINANCIAL_ENDPOINT,
  );
}
