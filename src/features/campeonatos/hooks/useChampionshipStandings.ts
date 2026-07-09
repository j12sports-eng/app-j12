import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listChampionshipStandings,
  recalculateChampionshipStandings,
} from "../api/championship.api";
import { championshipQueryKeys } from "./useChampionships";

import type {
  ChampionshipStandingFilters,
  ChampionshipStandingRecalculatePayload,
} from "../types/championship.types";

export const championshipStandingQueryKeys = {
  all: [...championshipQueryKeys.all, "classificacao"] as const,
  list: (championshipId?: string, filters?: ChampionshipStandingFilters) =>
    [...championshipStandingQueryKeys.all, "list", championshipId || "", filters || {}] as const,
};

const STALE_TIME_MS = 15_000;
const GC_TIME_MS = 5 * 60_000;

export function useChampionshipStandings(
  championshipId?: string,
  filters?: ChampionshipStandingFilters,
) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listChampionshipStandings(championshipId || "", filters),
    queryKey: championshipStandingQueryKeys.list(championshipId, filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useRecalculateChampionshipStandings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      championshipId: string;
      payload?: ChampionshipStandingRecalculatePayload;
    }) => recalculateChampionshipStandings(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: championshipStandingQueryKeys.all });
      void queryClient.invalidateQueries({
        queryKey: championshipQueryKeys.detail(variables.championshipId),
      });
    },
  });
}
