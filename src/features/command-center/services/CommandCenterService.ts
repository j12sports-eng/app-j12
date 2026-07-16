import {
  adaptChampionshipsContract,
  adaptClassesContract,
  adaptExecutiveContract,
  adaptFinancialContract,
  adaptStudentsContract,
} from "../adapters";
import type { BiChampionshipsContract } from "@/features/bi/types/bi-championships.types";
import type { BiClassesContract } from "@/features/bi/types/bi-classes.types";
import type { BiFinancialContract } from "@/features/bi/types/bi-financial.types";
import type { BiExecutiveContract } from "@/features/bi/types/bi-foundation.types";
import type { BiStudentsContract } from "@/features/bi/types/bi-students.types";
import type { CommandCenterMetric } from "@/features/command-center/types/command-center.types";

export type CommandCenterContracts = {
  championships?: BiChampionshipsContract;
  classes?: BiClassesContract;
  executive?: BiExecutiveContract;
  financial?: BiFinancialContract;
  students?: BiStudentsContract;
};

export type CommandCenterSnapshot = {
  generatedAt: string | null;
  metrics: CommandCenterMetric[];
  metricsById: Record<string, CommandCenterMetric>;
};

export const CommandCenterService = {
  createSnapshot(contracts: CommandCenterContracts): CommandCenterSnapshot {
    const metrics = [
      ...(contracts.executive ? adaptExecutiveContract(contracts.executive) : []),
      ...(contracts.financial ? adaptFinancialContract(contracts.financial) : []),
      ...(contracts.students ? adaptStudentsContract(contracts.students) : []),
      ...(contracts.classes ? adaptClassesContract(contracts.classes) : []),
      ...(contracts.championships ? adaptChampionshipsContract(contracts.championships) : []),
    ];

    return {
      generatedAt: latestGeneratedAt(contracts),
      metrics,
      metricsById: Object.fromEntries(
        metrics.map((metric) => [`${metric.source}.${metric.id}`, metric]),
      ),
    };
  },
};

function latestGeneratedAt(contracts: CommandCenterContracts) {
  const timestamps = Object.values(contracts)
    .map((contract) => contract?.generatedAt)
    .filter((value): value is string => Boolean(value))
    .sort();

  return timestamps.at(-1) ?? null;
}
