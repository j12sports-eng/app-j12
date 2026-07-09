import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getChampionshipRankings,
  getChampionshipStatistics,
  getChampionshipTopScorers,
  recalculateChampionshipStatistics,
} from "../api/championship.api";
import { championshipQueryKeys } from "./useChampionships";

import type {
  ChampionshipRankingFilters,
  ChampionshipStatisticsFilters,
  ChampionshipStatisticsRecalculatePayload,
} from "../types/championship.types";

export const championshipStatisticsQueryKeys = {
  all: [...championshipQueryKeys.all, "estatisticas"] as const,
  detail: (championshipId?: string, filters?: ChampionshipStatisticsFilters) =>
    [
      ...championshipStatisticsQueryKeys.all,
      "detail",
      championshipId || "",
      filters || {},
    ] as const,
  players: (championshipId?: string, filters?: ChampionshipStatisticsFilters) =>
    [
      ...championshipStatisticsQueryKeys.all,
      "atletas",
      championshipId || "",
      filters || {},
    ] as const,
  rankings: (championshipId?: string, filters?: ChampionshipRankingFilters) =>
    [
      ...championshipStatisticsQueryKeys.all,
      "rankings",
      championshipId || "",
      filters || {},
    ] as const,
  teams: (championshipId?: string, filters?: ChampionshipStatisticsFilters) =>
    [
      ...championshipStatisticsQueryKeys.all,
      "equipes",
      championshipId || "",
      filters || {},
    ] as const,
  topScorers: (championshipId?: string, filters?: ChampionshipStatisticsFilters) =>
    [
      ...championshipStatisticsQueryKeys.all,
      "artilharia",
      championshipId || "",
      filters || {},
    ] as const,
};

const STALE_TIME_MS = 15_000;
const GC_TIME_MS = 5 * 60_000;

export function useChampionshipStatistics(
  championshipId?: string,
  filters?: ChampionshipStatisticsFilters,
) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => getChampionshipStatistics(championshipId || "", filters),
    queryKey: championshipStatisticsQueryKeys.detail(championshipId, filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useChampionshipRankings(
  championshipId?: string,
  filters?: ChampionshipRankingFilters,
) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => getChampionshipRankings(championshipId || "", filters),
    queryKey: championshipStatisticsQueryKeys.rankings(championshipId, filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useTopScorers(championshipId?: string, filters?: ChampionshipStatisticsFilters) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => getChampionshipTopScorers(championshipId || "", filters),
    queryKey: championshipStatisticsQueryKeys.topScorers(championshipId, filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useTeamStatistics(
  championshipId?: string,
  filters?: ChampionshipStatisticsFilters,
) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => getChampionshipStatistics(championshipId || "", filters),
    queryKey: championshipStatisticsQueryKeys.detail(championshipId, filters),
    retry: 1,
    select: (data) => data.teams,
    staleTime: STALE_TIME_MS,
  });
}

export function usePlayerStatistics(
  championshipId?: string,
  filters?: ChampionshipStatisticsFilters,
) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => getChampionshipStatistics(championshipId || "", filters),
    queryKey: championshipStatisticsQueryKeys.detail(championshipId, filters),
    retry: 1,
    select: (data) => data.athletes,
    staleTime: STALE_TIME_MS,
  });
}

export function useRecalculateStatistics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      championshipId: string;
      payload?: ChampionshipStatisticsRecalculatePayload;
    }) => recalculateChampionshipStatistics(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: championshipStatisticsQueryKeys.all });
      void queryClient.invalidateQueries({
        queryKey: championshipQueryKeys.detail(variables.championshipId),
      });
    },
  });
}
