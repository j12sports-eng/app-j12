import type { BiExecutiveContract, BiKpi } from "@/features/bi/types/bi-foundation.types";
import type {
  CommandCenterComparison,
  CommandCenterMetric,
  CommandCenterMetricUnit,
} from "@/features/command-center/types/command-center.types";

const EXECUTIVE_LABELS: Record<keyof BiExecutiveContract["kpis"], string> = {
  activeStudents: "Alunos ativos",
  averageTicket: "Ticket médio",
  cancellations: "Cancelamentos",
  delinquencyRate: "Inadimplência",
  expectedRevenue: "Receita prevista",
  newStudents: "Novos alunos",
  overdueRevenue: "Receita vencida",
  receivedRevenue: "Receita recebida",
};

export function adaptExecutiveContract(contract: BiExecutiveContract): CommandCenterMetric[] {
  return Object.entries(contract.kpis).map(([id, metric]) =>
    adaptMetric({
      contractVersion: contract.contractVersion,
      generatedAt: contract.generatedAt,
      id,
      label: EXECUTIVE_LABELS[id as keyof typeof EXECUTIVE_LABELS],
      metric,
      source: "bi.executive",
    }),
  );
}

export function adaptMetric({
  contractVersion,
  generatedAt,
  id,
  label,
  metric,
  source,
}: {
  contractVersion: string;
  generatedAt: string;
  id: string;
  label: string;
  metric: {
    available: boolean;
    comparison?: BiKpi["comparison"];
    reason: string | null;
    unit: string;
    value: number | null;
  };
  source: string;
}): CommandCenterMetric {
  return {
    available: metric.available,
    comparison: metric.comparison ? adaptComparison(metric.comparison) : undefined,
    contractVersion,
    generatedAt,
    id,
    label,
    reason: metric.reason,
    source,
    unit: adaptUnit(metric.unit),
    value: metric.value,
  };
}

function adaptComparison(comparison: BiKpi["comparison"]): CommandCenterComparison {
  return {
    available: comparison.available,
    percent: comparison.percent,
    previousValue: comparison.previousValue,
    reason: comparison.reason,
    trend: comparison.trend,
  };
}

function adaptUnit(unit: string): CommandCenterMetricUnit {
  if (
    unit === "currency" ||
    unit === "percentage" ||
    unit === "hours" ||
    unit === "days" ||
    unit === "average"
  ) {
    return unit;
  }
  return "count";
}
