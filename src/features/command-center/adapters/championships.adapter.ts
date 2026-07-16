import { adaptMetric } from "./executive.adapter";
import type { BiChampionshipsContract } from "@/features/bi/types/bi-championships.types";
import type { CommandCenterMetric } from "@/features/command-center/types/command-center.types";

const CHAMPIONSHIP_LABELS: Record<keyof BiChampionshipsContract["kpis"], string> = {
  activeChampionships: "Campeonatos ativos",
  averageTeams: "Média de equipes",
  completedChampionships: "Campeonatos concluídos",
  finishedMatches: "Partidas concluídas",
  participants: "Participantes",
  pendingMatches: "Partidas pendentes",
  registrationRevenue: "Receita de inscrições",
  registrations: "Inscrições",
  teams: "Equipes",
};

export function adaptChampionshipsContract(
  contract: BiChampionshipsContract,
): CommandCenterMetric[] {
  return Object.entries(contract.kpis).map(([id, metric]) =>
    adaptMetric({
      contractVersion: contract.contractVersion,
      generatedAt: contract.generatedAt,
      id,
      label: CHAMPIONSHIP_LABELS[id as keyof typeof CHAMPIONSHIP_LABELS],
      metric,
      source: "bi.championships",
    }),
  );
}
