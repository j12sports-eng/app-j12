import { adaptMetric } from "./executive.adapter";
import type { BiStudentsContract } from "@/features/bi/types/bi-students.types";
import type { CommandCenterMetric } from "@/features/command-center/types/command-center.types";

const STUDENT_LABELS: Record<keyof BiStudentsContract["kpis"], string> = {
  activeEnrollments: "Matrículas ativas",
  activeStudents: "Alunos ativos",
  averageTenureDays: "Permanência média",
  cancellations: "Cancelamentos",
  churnRate: "Churn",
  netGrowth: "Crescimento líquido",
  newEnrollments: "Novas matrículas",
  newStudents: "Novos alunos",
  retentionRate: "Retenção",
  transfers: "Transferências",
};

export function adaptStudentsContract(contract: BiStudentsContract): CommandCenterMetric[] {
  return Object.entries(contract.kpis).map(([id, metric]) =>
    adaptMetric({
      contractVersion: contract.contractVersion,
      generatedAt: contract.generatedAt,
      id,
      label: STUDENT_LABELS[id as keyof typeof STUDENT_LABELS],
      metric,
      source: "bi.students",
    }),
  );
}
