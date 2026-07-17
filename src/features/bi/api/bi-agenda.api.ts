import { api } from "@/lib/api";

import type { BiAgendaContract, BiAgendaFilters } from "../types/bi-agenda.types";

const ENDPOINT = "/admin/bi/agenda";

export function getBiAgenda(filters: BiAgendaFilters = {}) {
  const params = new URLSearchParams();
  if (filters.period) params.set("period", filters.period);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.unitId) params.set("unitId", filters.unitId);
  const query = params.toString();
  return api.get<BiAgendaContract>(query ? `${ENDPOINT}?${query}` : ENDPOINT);
}
