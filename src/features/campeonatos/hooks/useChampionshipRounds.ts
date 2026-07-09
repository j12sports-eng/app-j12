import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createChampionshipMatch,
  createChampionshipRound,
  deleteChampionshipMatch,
  deleteChampionshipRound,
  generateChampionshipMatches,
  getChampionshipRound,
  listChampionshipMatches,
  listChampionshipRounds,
  moveChampionshipMatch,
  updateChampionshipMatch,
  updateChampionshipRound,
} from "../api/championship.api";
import { championshipGroupQueryKeys } from "./useChampionshipGroups";
import { championshipQueryKeys } from "./useChampionships";
import { championshipStandingQueryKeys } from "./useChampionshipStandings";

import type {
  ChampionshipGenerateMatchesPayload,
  ChampionshipMatchFilters,
  ChampionshipMatchMovePayload,
  ChampionshipMatchPayload,
  ChampionshipMatchUpdatePayload,
  ChampionshipRoundFilters,
  ChampionshipRoundPayload,
  ChampionshipRoundUpdatePayload,
} from "../types/championship.types";

export const championshipRoundQueryKeys = {
  all: [...championshipQueryKeys.all, "rodadas"] as const,
  detail: (championshipId?: string, roundId?: string) =>
    [...championshipRoundQueryKeys.all, "detail", championshipId || "", roundId || ""] as const,
  list: (championshipId?: string, filters?: ChampionshipRoundFilters) =>
    [...championshipRoundQueryKeys.all, "list", championshipId || "", filters || {}] as const,
  matches: (championshipId?: string, filters?: ChampionshipMatchFilters) =>
    [...championshipRoundQueryKeys.all, "jogos", championshipId || "", filters || {}] as const,
};

const STALE_TIME_MS = 20_000;
const GC_TIME_MS = 5 * 60_000;

export function useChampionshipRounds(championshipId?: string, filters?: ChampionshipRoundFilters) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listChampionshipRounds(championshipId || "", filters),
    queryKey: championshipRoundQueryKeys.list(championshipId, filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useChampionshipRound(championshipId?: string, roundId?: string) {
  return useQuery({
    enabled: Boolean(championshipId && roundId),
    gcTime: GC_TIME_MS,
    queryFn: () =>
      getChampionshipRound({
        championshipId: championshipId || "",
        roundId: roundId || "",
      }),
    queryKey: championshipRoundQueryKeys.detail(championshipId, roundId),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useChampionshipMatches(
  championshipId?: string,
  filters?: ChampionshipMatchFilters,
) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listChampionshipMatches(championshipId || "", filters),
    queryKey: championshipRoundQueryKeys.matches(championshipId, filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useCreateChampionshipRound() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { championshipId: string; payload: ChampionshipRoundPayload }) =>
      createChampionshipRound(input),
    onSuccess: (_data, variables) => invalidateRoundQueries(queryClient, variables.championshipId),
  });
}

export function useUpdateChampionshipRound() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      championshipId: string;
      payload: ChampionshipRoundUpdatePayload;
      roundId: string;
    }) => updateChampionshipRound(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: championshipRoundQueryKeys.detail(variables.championshipId, variables.roundId),
      });
      void invalidateRoundQueries(queryClient, variables.championshipId);
    },
  });
}

export function useDeleteChampionshipRound() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { championshipId: string; roundId: string }) =>
      deleteChampionshipRound(input),
    onSuccess: (_data, variables) => invalidateRoundQueries(queryClient, variables.championshipId),
  });
}

export function useCreateChampionshipMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      championshipId: string;
      payload: ChampionshipMatchPayload;
      roundId: string;
    }) => createChampionshipMatch(input),
    onSuccess: (_data, variables) => invalidateRoundQueries(queryClient, variables.championshipId),
  });
}

export function useUpdateChampionshipMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      championshipId: string;
      matchId: string;
      payload: ChampionshipMatchUpdatePayload;
    }) => updateChampionshipMatch(input),
    onSuccess: (_data, variables) => invalidateRoundQueries(queryClient, variables.championshipId),
  });
}

export function useDeleteChampionshipMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { championshipId: string; matchId: string }) =>
      deleteChampionshipMatch(input),
    onSuccess: (_data, variables) => invalidateRoundQueries(queryClient, variables.championshipId),
  });
}

export function useMoveChampionshipMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      championshipId: string;
      matchId: string;
      payload: ChampionshipMatchMovePayload;
    }) => moveChampionshipMatch(input),
    onSuccess: (_data, variables) => invalidateRoundQueries(queryClient, variables.championshipId),
  });
}

export function useGenerateChampionshipMatches() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { championshipId: string; payload: ChampionshipGenerateMatchesPayload }) =>
      generateChampionshipMatches(input),
    onSuccess: (_data, variables) => invalidateRoundQueries(queryClient, variables.championshipId),
  });
}

function invalidateRoundQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  championshipId?: string,
) {
  void queryClient.invalidateQueries({ queryKey: championshipRoundQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: championshipStandingQueryKeys.all });

  if (championshipId) {
    void queryClient.invalidateQueries({
      queryKey: championshipQueryKeys.detail(championshipId),
    });
    void queryClient.invalidateQueries({
      queryKey: championshipGroupQueryKeys.list(championshipId),
    });
  }
}
