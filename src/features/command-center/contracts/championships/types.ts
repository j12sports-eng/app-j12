import type { KPIDefinition } from "../shared";

export type ChampionshipsKPIId =
  | "activeChampionships"
  | "completedChampionships"
  | "finishedMatches"
  | "participants"
  | "pendingMatches"
  | "registrationRevenue"
  | "registrations"
  | "teams";

export type ChampionshipsKPIs = Record<ChampionshipsKPIId, KPIDefinition>;

export interface ChampionshipRankingItem {
  championshipId: string;
  championshipName: string;
  participants: number | null;
  registrations: number;
  status: string;
  teams: number;
}

export interface ChampionshipsContractData {
  rankings: readonly ChampionshipRankingItem[];
}
