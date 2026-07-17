import { api } from "@/lib/api";
import type { BiEventsContract, BiEventsFilters } from "../types/bi-events.types";
export function getBiEvents(filters: BiEventsFilters = {}) {
  const params = new URLSearchParams();
  if (filters.period) params.set("period", filters.period);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  const query = params.toString();
  return api.get<BiEventsContract>(query ? `/admin/bi/events?${query}` : "/admin/bi/events");
}
