import type { KPIDefinition } from "../shared";

export type ChampionshipsKPIId =
  | "activeChampionships"
  | "averageTeams"
  | "completedChampionships"
  | "finishedMatches"
  | "participants"
  | "pendingMatches"
  | "registrationRevenue"
  | "registrations"
  | "teams";

export type ChampionshipsKPIs = Record<
  ChampionshipsKPIId,
  KPIDefinition<"average" | "count" | "currency">
>;

export interface ChampionshipAggregateGroup {
  key: string;
  value: number;
}

export interface ChampionshipsContractData {
  categories: readonly ChampionshipAggregateGroup[];
  registrationEvolution: readonly ChampionshipAggregateGroup[];
  statuses: readonly ChampionshipAggregateGroup[];
}
