import { api } from "@/lib/api";
import type {
  BiChampionshipsContract,
  BiChampionshipsFilters,
} from "../types/bi-championships.types";
export function getBiChampionships(filters: BiChampionshipsFilters = {}) {
  const params = new URLSearchParams();
  if (filters.period) params.set("period", filters.period);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  const query = params.toString();
  return api.get<BiChampionshipsContract>(
    query ? `/admin/bi/championships?${query}` : "/admin/bi/championships",
  );
}
