import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { financialAutomationHistoryApi } from "../api/financial-automation-history.api";
import type { AutomationHistoryFilters } from "../types/automation-history.types";

export const automationHistoryKeys = {
  all: ["financial", "automation-history"] as const,
  list: (filters: AutomationHistoryFilters) =>
    [...automationHistoryKeys.all, "list", filters] as const,
  detail: (id: string) => [...automationHistoryKeys.all, "detail", id] as const,
  execution: (id: string) => [...automationHistoryKeys.all, "execution", id] as const,
};

export function useAutomationHistory(filters: AutomationHistoryFilters) {
  return useQuery({
    queryKey: automationHistoryKeys.list(filters),
    queryFn: () => financialAutomationHistoryApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useAutomationHistoryDetails(historyId: string | null) {
  return useQuery({
    queryKey: automationHistoryKeys.detail(historyId || ""),
    queryFn: () => financialAutomationHistoryApi.getById(historyId || ""),
    enabled: Boolean(historyId),
  });
}

export function useExecutionHistory(executionId: string | null) {
  return useQuery({
    queryKey: automationHistoryKeys.execution(executionId || ""),
    queryFn: () => financialAutomationHistoryApi.getByExecutionId(executionId || ""),
    enabled: Boolean(executionId),
  });
}
