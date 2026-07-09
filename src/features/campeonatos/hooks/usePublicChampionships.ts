import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  getPublicChampionship,
  getPublicChampionshipBracket,
  getPublicChampionshipStandings,
  getPublicChampionshipStatistics,
  getPublicChampionshipTopScorers,
  listPublicChampionshipGroups,
  listPublicChampionshipMatches,
  listPublicChampionshipTeams,
  listPublicChampionships,
} from "../api/championship-public.api";

import type {
  PublicChampionshipListFilters,
  PublicPaginationFilters,
} from "../types/championship-public.types";

export const publicChampionshipQueryKeys = {
  all: ["campeonatos", "publico"] as const,
  bracket: (championshipId?: string) =>
    [...publicChampionshipQueryKeys.detail(championshipId), "mata-mata"] as const,
  detail: (championshipId?: string) =>
    [...publicChampionshipQueryKeys.all, "detail", championshipId || ""] as const,
  groups: (championshipId?: string, filters?: PublicPaginationFilters) =>
    [...publicChampionshipQueryKeys.detail(championshipId), "grupos", filters || {}] as const,
  list: (filters?: PublicChampionshipListFilters) =>
    [...publicChampionshipQueryKeys.all, "list", filters || {}] as const,
  matches: (championshipId?: string, filters?: PublicPaginationFilters) =>
    [...publicChampionshipQueryKeys.detail(championshipId), "jogos", filters || {}] as const,
  standings: (championshipId?: string, filters?: PublicPaginationFilters) =>
    [
      ...publicChampionshipQueryKeys.detail(championshipId),
      "classificacao",
      filters || {},
    ] as const,
  statistics: (championshipId?: string, filters?: PublicPaginationFilters) =>
    [...publicChampionshipQueryKeys.detail(championshipId), "estatisticas", filters || {}] as const,
  teams: (championshipId?: string, filters?: PublicPaginationFilters) =>
    [...publicChampionshipQueryKeys.detail(championshipId), "equipes", filters || {}] as const,
  topScorers: (championshipId?: string, filters?: PublicPaginationFilters) =>
    [...publicChampionshipQueryKeys.detail(championshipId), "artilharia", filters || {}] as const,
};

const PUBLIC_STALE_TIME_MS = 30_000;
const PUBLIC_GC_TIME_MS = 5 * 60_000;

export function usePublicChampionships(filters?: PublicChampionshipListFilters) {
  return useQuery({
    gcTime: PUBLIC_GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listPublicChampionships(filters),
    queryKey: publicChampionshipQueryKeys.list(filters),
    retry: 1,
    staleTime: PUBLIC_STALE_TIME_MS,
  });
}

export function usePublicChampionship(championshipId?: string) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: PUBLIC_GC_TIME_MS,
    queryFn: () => getPublicChampionship(championshipId || ""),
    queryKey: publicChampionshipQueryKeys.detail(championshipId),
    retry: 1,
    staleTime: PUBLIC_STALE_TIME_MS,
  });
}

export function usePublicChampionshipGroups(
  championshipId?: string,
  filters?: PublicPaginationFilters,
) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: PUBLIC_GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listPublicChampionshipGroups(championshipId || "", filters),
    queryKey: publicChampionshipQueryKeys.groups(championshipId, filters),
    retry: 1,
    staleTime: PUBLIC_STALE_TIME_MS,
  });
}

export function usePublicChampionshipTeams(
  championshipId?: string,
  filters?: PublicPaginationFilters,
) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: PUBLIC_GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listPublicChampionshipTeams(championshipId || "", filters),
    queryKey: publicChampionshipQueryKeys.teams(championshipId, filters),
    retry: 1,
    staleTime: PUBLIC_STALE_TIME_MS,
  });
}

export function usePublicChampionshipMatches(
  championshipId?: string,
  filters?: PublicPaginationFilters,
) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: PUBLIC_GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listPublicChampionshipMatches(championshipId || "", filters),
    queryKey: publicChampionshipQueryKeys.matches(championshipId, filters),
    retry: 1,
    staleTime: PUBLIC_STALE_TIME_MS,
  });
}

export function usePublicChampionshipStandings(
  championshipId?: string,
  filters?: PublicPaginationFilters,
) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: PUBLIC_GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => getPublicChampionshipStandings(championshipId || "", filters),
    queryKey: publicChampionshipQueryKeys.standings(championshipId, filters),
    retry: 1,
    staleTime: PUBLIC_STALE_TIME_MS,
  });
}

export function usePublicChampionshipBracket(championshipId?: string) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: PUBLIC_GC_TIME_MS,
    queryFn: () => getPublicChampionshipBracket(championshipId || ""),
    queryKey: publicChampionshipQueryKeys.bracket(championshipId),
    retry: 1,
    staleTime: PUBLIC_STALE_TIME_MS,
  });
}

export function usePublicChampionshipStatistics(
  championshipId?: string,
  filters?: PublicPaginationFilters,
) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: PUBLIC_GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => getPublicChampionshipStatistics(championshipId || "", filters),
    queryKey: publicChampionshipQueryKeys.statistics(championshipId, filters),
    retry: 1,
    staleTime: PUBLIC_STALE_TIME_MS,
  });
}

export function usePublicChampionshipTopScorers(
  championshipId?: string,
  filters?: PublicPaginationFilters,
) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: PUBLIC_GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => getPublicChampionshipTopScorers(championshipId || "", filters),
    queryKey: publicChampionshipQueryKeys.topScorers(championshipId, filters),
    retry: 1,
    staleTime: PUBLIC_STALE_TIME_MS,
  });
}
