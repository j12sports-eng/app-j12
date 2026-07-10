import type { BiFoundationFilters, BiResolvedFilters } from "./bi-foundation.types";
export type ChampionshipMetric = {
  available: boolean;
  reason: string | null;
  unit: "count" | "average" | "currency";
  value: number | null;
};
export type ChampionshipRank = {
  championshipId: string;
  championshipName: string;
  category: string;
  status: string;
  teams: number;
  registrations: number;
  finishedMatches: number;
  participants: number | null;
};
export type ChampionshipGroup = { key: string; championships?: number; registrations?: number };
export type BiChampionshipsContract = {
  contractVersion: "21.8";
  filters: { current: BiResolvedFilters };
  generatedAt: string;
  kpis: Record<
    | "activeChampionships"
    | "averageTeams"
    | "completedChampionships"
    | "finishedMatches"
    | "participants"
    | "pendingMatches"
    | "registrationRevenue"
    | "registrations"
    | "teams",
    ChampionshipMetric
  >;
  rankings: {
    categories: ChampionshipGroup[];
    championships: ChampionshipRank[];
    registrationEvolution: ChampionshipGroup[];
    statuses: ChampionshipGroup[];
  };
  readOnly: true;
};
export type BiChampionshipsFilters = BiFoundationFilters;
