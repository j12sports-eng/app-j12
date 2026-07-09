import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  advanceChampionshipBracketMatch,
  deleteChampionshipBracket,
  generateChampionshipBracket,
  getChampionshipBracket,
  updateChampionshipBracketMatch,
} from "../api/championship.api";
import { championshipQueryKeys } from "./useChampionships";
import { championshipStandingQueryKeys } from "./useChampionshipStandings";

import type {
  ChampionshipBracketFilters,
  ChampionshipBracketMatchAdvancePayload,
  ChampionshipBracketMatchUpdatePayload,
  ChampionshipGenerateBracketPayload,
} from "../types/championship.types";

export const championshipBracketQueryKeys = {
  all: [...championshipQueryKeys.all, "mata-mata"] as const,
  detail: (championshipId?: string, filters?: ChampionshipBracketFilters) =>
    [...championshipBracketQueryKeys.all, "detail", championshipId || "", filters || {}] as const,
};

const STALE_TIME_MS = 15_000;
const GC_TIME_MS = 5 * 60_000;

export function useChampionshipBracket(
  championshipId?: string,
  filters?: ChampionshipBracketFilters,
) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => getChampionshipBracket(championshipId || "", filters),
    queryKey: championshipBracketQueryKeys.detail(championshipId, filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useGenerateBracket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { championshipId: string; payload: ChampionshipGenerateBracketPayload }) =>
      generateChampionshipBracket(input),
    onSuccess: (_data, variables) =>
      invalidateBracketQueries(queryClient, variables.championshipId),
  });
}

export function useUpdateBracketMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { matchId: string; payload: ChampionshipBracketMatchUpdatePayload }) =>
      updateChampionshipBracketMatch(input),
    onSuccess: () => invalidateBracketQueries(queryClient),
  });
}

export function useAdvanceBracket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { matchId: string; payload?: ChampionshipBracketMatchAdvancePayload }) =>
      advanceChampionshipBracketMatch(input),
    onSuccess: () => invalidateBracketQueries(queryClient),
  });
}

export function useDeleteBracket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (championshipId: string) => deleteChampionshipBracket(championshipId),
    onSuccess: (_data, championshipId) => invalidateBracketQueries(queryClient, championshipId),
  });
}

function invalidateBracketQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  championshipId?: string,
) {
  void queryClient.invalidateQueries({ queryKey: championshipBracketQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: championshipStandingQueryKeys.all });

  if (championshipId) {
    void queryClient.invalidateQueries({
      queryKey: championshipQueryKeys.detail(championshipId),
    });
  }
}
