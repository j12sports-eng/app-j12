import { api } from "@/lib/api";
import type {
  AutomationExecutionTimeline,
  AutomationHistoryFilters,
  AutomationHistoryPage,
  AutomationHistoryRecord,
} from "../types/automation-history.types";

const BASE_PATH = "/admin/financeiro/automacoes/historico";

function queryString(filters: AutomationHistoryFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const financialAutomationHistoryApi = {
  list: (filters: AutomationHistoryFilters = {}) =>
    api.get<AutomationHistoryPage>(`${BASE_PATH}${queryString(filters)}`),
  getById: (historyId: string) =>
    api.get<AutomationHistoryRecord>(`${BASE_PATH}/${encodeURIComponent(historyId)}`),
  getByExecutionId: (executionId: string) =>
    api.get<AutomationExecutionTimeline>(
      `${BASE_PATH}/execution/${encodeURIComponent(executionId)}`,
    ),
};
