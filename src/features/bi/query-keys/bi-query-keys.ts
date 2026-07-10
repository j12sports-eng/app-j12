import type { BiFoundationFilters } from "../types/bi-foundation.types";

export const biQueryKeys = {
  all: ["bi"] as const,
  foundation: (filters: BiFoundationFilters = {}) =>
    [
      ...biQueryKeys.all,
      "foundation",
      {
        endDate: filters.endDate || "",
        period: filters.period || "CURRENT_MONTH",
        startDate: filters.startDate || "",
        unitId: filters.unitId || "",
      },
    ] as const,
  executive: (filters: BiFoundationFilters = {}) =>
    [
      ...biQueryKeys.all,
      "executive",
      {
        endDate: filters.endDate || "",
        period: filters.period || "CURRENT_MONTH",
        startDate: filters.startDate || "",
        unitId: filters.unitId || "",
      },
    ] as const,
  financial: (filters: BiFoundationFilters = {}) =>
    [
      ...biQueryKeys.all,
      "financial",
      {
        endDate: filters.endDate || "",
        period: filters.period || "CURRENT_MONTH",
        startDate: filters.startDate || "",
        unitId: filters.unitId || "",
      },
    ] as const,
};
