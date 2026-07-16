import { adaptMetric } from "./executive.adapter";
import type { BiClassesContract } from "@/features/bi/types/bi-classes.types";
import type { CommandCenterMetric } from "@/features/command-center/types/command-center.types";

const CLASS_LABELS: Record<keyof BiClassesContract["kpis"], string> = {
  activeClasses: "Turmas ativas",
  availableSpots: "Vagas disponíveis",
  enrolledStudents: "Alunos matriculados",
  fullClasses: "Turmas lotadas",
  occupancyRate: "Ocupação das turmas",
  totalCapacity: "Capacidade total",
  underutilizedClasses: "Turmas subutilizadas",
};

export function adaptClassesContract(contract: BiClassesContract): CommandCenterMetric[] {
  return Object.entries(contract.kpis).map(([id, metric]) =>
    adaptMetric({
      contractVersion: contract.contractVersion,
      generatedAt: contract.generatedAt,
      id,
      label: CLASS_LABELS[id as keyof typeof CLASS_LABELS],
      metric,
      source: "bi.classes",
    }),
  );
}
