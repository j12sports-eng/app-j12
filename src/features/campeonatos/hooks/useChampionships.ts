import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveChampionship,
  createChampionship,
  deleteChampionship,
  getChampionship,
  listChampionships,
  publishChampionship,
  updateChampionship,
} from "../api/championship.api";

import type { ChampionshipFilters, ChampionshipMutationPayload } from "../types/championship.types";

export const championshipQueryKeys = {
  all: ["campeonatos"] as const,
  detail: (championshipId?: string) =>
    [...championshipQueryKeys.all, "detail", championshipId || ""] as const,
  list: (filters?: ChampionshipFilters) =>
    [...championshipQueryKeys.all, "list", filters || {}] as const,
};

const STALE_TIME_MS = 30_000;
const GC_TIME_MS = 5 * 60_000;

export function useChampionships(filters?: ChampionshipFilters) {
  return useQuery({
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listChampionships(filters),
    queryKey: championshipQueryKeys.list(filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useChampionship(championshipId?: string) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: GC_TIME_MS,
    queryFn: () => getChampionship(championshipId || ""),
    queryKey: championshipQueryKeys.detail(championshipId),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useCreateChampionship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ChampionshipMutationPayload) => createChampionship(payload),
    onSuccess: () => invalidateChampionshipQueries(queryClient),
  });
}

export function useUpdateChampionship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateChampionship,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: championshipQueryKeys.detail(variables.championshipId),
      });
      void invalidateChampionshipQueries(queryClient);
    },
  });
}

export function usePublishChampionship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (championshipId: string) => publishChampionship(championshipId),
    onSuccess: (_data, championshipId) => {
      void queryClient.invalidateQueries({
        queryKey: championshipQueryKeys.detail(championshipId),
      });
      void invalidateChampionshipQueries(queryClient);
    },
  });
}

export function useArchiveChampionship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (championshipId: string) => archiveChampionship(championshipId),
    onSuccess: (_data, championshipId) => {
      void queryClient.invalidateQueries({
        queryKey: championshipQueryKeys.detail(championshipId),
      });
      void invalidateChampionshipQueries(queryClient);
    },
  });
}

export function useDeleteChampionship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (championshipId: string) => deleteChampionship(championshipId),
    onSuccess: () => invalidateChampionshipQueries(queryClient),
  });
}

function invalidateChampionshipQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: championshipQueryKeys.all });
}
