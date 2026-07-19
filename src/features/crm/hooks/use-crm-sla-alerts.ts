import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { listCrmSlaAlerts } from "../api/crm-sla-alerts.api";
import { crmSlaAlertsQueryKeys } from "../query/crm-sla-alerts.query-keys";
import type { CrmSlaAlertFilters } from "../types/crm-sla-alerts.types";

export const CRM_SLA_ALERTS_DEFAULT_LIMIT = 25;

/**
 * Mantém a consulta de alertas centralizada e paginada por cursor.
 *
 * O staleTime evita uma segunda requisição imediata durante remontagens
 * consecutivas do componente, inclusive no React Strict Mode.
 *
 * Invalidações explícitas do React Query continuam forçando atualização
 * após mudanças de estágio, drag-and-drop ou conversão.
 */
export function useCrmSlaAlerts(filters: CrmSlaAlertFilters = {}) {
  const stableFilters = useMemo<CrmSlaAlertFilters>(
    () => ({
      limit:
        typeof filters.limit === "number" && filters.limit > 0
          ? filters.limit
          : CRM_SLA_ALERTS_DEFAULT_LIMIT,
      slaStatus: filters.slaStatus || undefined,
      stage: filters.stage || undefined,
      unitId: filters.unitId?.trim() || undefined,
    }),
    [filters.limit, filters.slaStatus, filters.stage, filters.unitId],
  );

  return useInfiniteQuery({
    queryKey: crmSlaAlertsQueryKeys.list(stableFilters),

    queryFn: ({ pageParam, signal }) =>
      listCrmSlaAlerts(
        {
          ...stableFilters,
          cursor: pageParam ?? undefined,
        },
        signal,
      ),

    initialPageParam: null as string | null,

    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,

    /**
     * Os alertas utilizam o mesmo relógio visual de 60 segundos da Sprint
     * 27.18C. Durante esse intervalo, uma remontagem não precisa repetir
     * a consulta.
     */
    staleTime: 60_000,

    /**
     * Não existe polling nesta Sprint. As atualizações ocorrem por
     * invalidações explícitas após operações do CRM.
     */
    refetchInterval: false,
  });
}
