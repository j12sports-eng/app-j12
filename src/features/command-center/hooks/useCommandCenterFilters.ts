import { useCallback, useState } from "react";

import type { CommandCenterFilters } from "@/features/command-center/types/command-center.types";

export function useCommandCenterFilters(initialFilters: CommandCenterFilters = {}) {
  const [filters, setFilters] = useState<CommandCenterFilters>(initialFilters);

  const updateFilters = useCallback((changes: Partial<CommandCenterFilters>) => {
    setFilters((current) => normalizeFilters({ ...current, ...changes }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(normalizeFilters(initialFilters));
  }, [initialFilters]);

  return {
    filters,
    resetFilters,
    setFilters,
    updateFilters,
  };
}

function normalizeFilters(filters: CommandCenterFilters): CommandCenterFilters {
  const normalized: CommandCenterFilters = {
    period: filters.period,
    unitId: filters.unitId?.trim() || undefined,
  };

  if (filters.period === "CUSTOM") {
    normalized.startDate = filters.startDate;
    normalized.endDate = filters.endDate;
  }

  return normalized;
}
