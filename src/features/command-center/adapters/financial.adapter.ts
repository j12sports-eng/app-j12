import { adaptMetric } from "./executive.adapter";
import type { BiFinancialContract } from "@/features/bi/types/bi-financial.types";
import type { CommandCenterMetric } from "@/features/command-center/types/command-center.types";

const FINANCIAL_LABELS: Record<keyof BiFinancialContract["kpis"], string> = {
  averageTicket: "Ticket médio",
  expenses: "Despesas",
  expectedRevenue: "Receita prevista",
  overdueRevenue: "Receita vencida",
  pendingRevenue: "Receita pendente",
  receivedRevenue: "Receita recebida",
};

export function adaptFinancialContract(contract: BiFinancialContract): CommandCenterMetric[] {
  return Object.entries(contract.kpis).map(([id, metric]) =>
    adaptMetric({
      contractVersion: contract.contractVersion,
      generatedAt: contract.generatedAt,
      id,
      label: FINANCIAL_LABELS[id as keyof typeof FINANCIAL_LABELS],
      metric,
      source: "bi.financial",
    }),
  );
}
