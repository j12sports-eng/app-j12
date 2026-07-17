import { getBiFinancial } from "@/features/bi/api/bi-financial.api";

import type { FinancialAdapterInput } from "../adapters/financial";
import { createFinancialProvider } from "../providers/financial";

async function loadFinancialContractInput(): Promise<FinancialAdapterInput> {
  const sourceContract = await getBiFinancial({ period: "CURRENT_MONTH" });
  const unitId = sourceContract.filters.current.unitId;

  return {
    capabilities: ["FINANCIAL_KPIS", "FINANCIAL_BREAKDOWNS", "FINANCIAL_EVOLUTION"],
    contractVersion: sourceContract.contractVersion,
    data: {
      breakdowns: sourceContract.breakdowns,
      evolution: sourceContract.evolution,
    },
    filters: {
      applied: {
        period: sourceContract.filters.current.period,
        unitId: unitId ?? undefined,
      },
      period: {
        endDate: sourceContract.filters.current.endDate,
        inclusive: { endDate: true, startDate: true },
        period: sourceContract.filters.current.period,
        startDate: sourceContract.filters.current.startDate,
        timezone: sourceContract.filters.current.timezone,
      },
      supportedFilters: ["period", "startDate", "endDate", "unitId"],
      unit: {
        authorizedUnitIds: unitId ? [unitId] : [],
        mode: unitId ? "active" : "all",
        selectedUnitIds: unitId ? [unitId] : [],
      },
    },
    generatedAt: sourceContract.generatedAt,
    kpis: {
      averageTicket: sourceContract.kpis.averageTicket,
      expenses: sourceContract.kpis.expenses,
      expectedRevenue: sourceContract.kpis.expectedRevenue,
      goalAchievement: {
        available: sourceContract.insights.goal.available,
        reason: sourceContract.insights.goal.reason,
        unit: "percentage",
        value: sourceContract.insights.goal.achievedPercent,
      },
      netResult: {
        available: false,
        reason: "A fonte BI financeira atual não fornece resultado líquido.",
        unit: "currency",
        value: null,
      },
      overdueRevenue: sourceContract.kpis.overdueRevenue,
      pendingRevenue: sourceContract.kpis.pendingRevenue,
      receivedRevenue: sourceContract.kpis.receivedRevenue,
    },
    metadata: {
      cacheTtlSeconds: 120,
      partial: true,
      warnings: ["Resultado líquido indisponível na fonte BI financeira atual."],
    },
    previousPeriod: sourceContract.filters.previous,
    source: {
      domains: ["financial"],
      name: "existing-bi-financial-api",
    },
  };
}

export const financialPreviewProvider = createFinancialProvider({
  load: loadFinancialContractInput,
});
