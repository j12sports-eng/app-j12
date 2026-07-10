import type { BiFoundationFilters } from "../types/bi-foundation.types";

export const biQueryKeys = {
  all: ["bi"] as const,
  championships: (filters: BiFoundationFilters = {}) =>
    [
      ...biQueryKeys.all,
      "championships",
      {
        period: filters.period || "CURRENT_MONTH",
        startDate: filters.startDate || "",
        endDate: filters.endDate || "",
      },
    ] as const,
  courts: (filters: BiFoundationFilters = {}) =>
    [
      ...biQueryKeys.all,
      "courts",
      {
        period: filters.period || "CURRENT_MONTH",
        startDate: filters.startDate || "",
        endDate: filters.endDate || "",
        unitId: filters.unitId || "",
      },
    ] as const,
  delinquency: (filters: BiFoundationFilters = {}) =>
    [
      ...biQueryKeys.all,
      "delinquency",
      {
        period: filters.period || "CURRENT_MONTH",
        startDate: filters.startDate || "",
        endDate: filters.endDate || "",
        unitId: filters.unitId || "",
      },
    ] as const,
  classes: (filters: BiFoundationFilters = {}) =>
    [
      ...biQueryKeys.all,
      "classes",
      {
        period: filters.period || "CURRENT_MONTH",
        startDate: filters.startDate || "",
        endDate: filters.endDate || "",
        unitId: filters.unitId || "",
      },
    ] as const,
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
  students: (filters: BiFoundationFilters = {}) =>
    [
      ...biQueryKeys.all,
      "students",
      {
        endDate: filters.endDate || "",
        period: filters.period || "CURRENT_MONTH",
        startDate: filters.startDate || "",
        unitId: filters.unitId || "",
      },
    ] as const,
};
