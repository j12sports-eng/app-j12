import { api } from "@/lib/api";
import type { BiStudentsContract, BiStudentsFilters } from "../types/bi-students.types";
const BI_STUDENTS_ENDPOINT = "/admin/bi/students";
export function getBiStudents(filters: BiStudentsFilters = {}) {
  const params = new URLSearchParams();
  if (filters.period) params.set("period", filters.period);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.unitId) params.set("unitId", filters.unitId);
  const query = params.toString();
  return api.get<BiStudentsContract>(
    query ? `${BI_STUDENTS_ENDPOINT}?${query}` : BI_STUDENTS_ENDPOINT,
  );
}
