import { api } from "@/lib/api";
import type { BiCourtsContract, BiCourtsFilters } from "../types/bi-courts.types";
export function getBiCourts(f: BiCourtsFilters = {}) {
  const p = new URLSearchParams();
  if (f.period) p.set("period", f.period);
  if (f.startDate) p.set("startDate", f.startDate);
  if (f.endDate) p.set("endDate", f.endDate);
  if (f.unitId) p.set("unitId", f.unitId);
  const q = p.toString();
  return api.get<BiCourtsContract>(q ? `/admin/bi/courts?${q}` : "/admin/bi/courts");
}
