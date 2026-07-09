import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignRegistrationToGroup,
  createChampionshipGroup,
  deleteChampionshipGroup,
  drawChampionshipGroups,
  getChampionshipGroup,
  listChampionshipGroups,
  moveRegistrationBetweenGroups,
  redistributeChampionshipGroups,
  removeRegistrationFromGroup,
  updateChampionshipGroup,
} from "../api/championship.api";
import { championshipRegistrationQueryKeys } from "./useChampionshipRegistrations";
import { championshipQueryKeys } from "./useChampionships";
import { championshipStandingQueryKeys } from "./useChampionshipStandings";

import type {
  ChampionshipGroupAssignmentPayload,
  ChampionshipGroupDrawPayload,
  ChampionshipGroupFilters,
  ChampionshipGroupMovePayload,
  ChampionshipGroupPayload,
  ChampionshipGroupUpdatePayload,
} from "../types/championship.types";

export const championshipGroupQueryKeys = {
  all: [...championshipQueryKeys.all, "grupos"] as const,
  detail: (championshipId?: string, groupId?: string) =>
    [...championshipGroupQueryKeys.all, "detail", championshipId || "", groupId || ""] as const,
  list: (championshipId?: string, filters?: ChampionshipGroupFilters) =>
    [...championshipGroupQueryKeys.all, "list", championshipId || "", filters || {}] as const,
};

const STALE_TIME_MS = 20_000;
const GC_TIME_MS = 5 * 60_000;

export function useChampionshipGroups(championshipId?: string, filters?: ChampionshipGroupFilters) {
  return useQuery({
    enabled: Boolean(championshipId),
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listChampionshipGroups(championshipId || "", filters),
    queryKey: championshipGroupQueryKeys.list(championshipId, filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useChampionshipGroup(championshipId?: string, groupId?: string) {
  return useQuery({
    enabled: Boolean(championshipId && groupId),
    gcTime: GC_TIME_MS,
    queryFn: () =>
      getChampionshipGroup({
        championshipId: championshipId || "",
        groupId: groupId || "",
      }),
    queryKey: championshipGroupQueryKeys.detail(championshipId, groupId),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useCreateChampionshipGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { championshipId: string; payload: ChampionshipGroupPayload }) =>
      createChampionshipGroup(input),
    onSuccess: (_data, variables) => invalidateGroupQueries(queryClient, variables.championshipId),
  });
}

export function useUpdateChampionshipGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      championshipId: string;
      groupId: string;
      payload: ChampionshipGroupUpdatePayload;
    }) => updateChampionshipGroup(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: championshipGroupQueryKeys.detail(variables.championshipId, variables.groupId),
      });
      void invalidateGroupQueries(queryClient, variables.championshipId);
    },
  });
}

export function useDeleteChampionshipGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { championshipId: string; groupId: string }) =>
      deleteChampionshipGroup(input),
    onSuccess: (_data, variables) => invalidateGroupQueries(queryClient, variables.championshipId),
  });
}

export function useAssignRegistrationToGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      championshipId: string;
      groupId: string;
      payload: ChampionshipGroupAssignmentPayload;
    }) => assignRegistrationToGroup(input),
    onSuccess: (_data, variables) => invalidateGroupQueries(queryClient, variables.championshipId),
  });
}

export function useRemoveRegistrationFromGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { championshipId: string; groupId: string; registrationId: string }) =>
      removeRegistrationFromGroup(input),
    onSuccess: (_data, variables) => invalidateGroupQueries(queryClient, variables.championshipId),
  });
}

export function useMoveRegistrationBetweenGroups() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      championshipId: string;
      groupId: string;
      payload: ChampionshipGroupMovePayload;
      registrationId: string;
    }) => moveRegistrationBetweenGroups(input),
    onSuccess: (_data, variables) => invalidateGroupQueries(queryClient, variables.championshipId),
  });
}

export function useDrawChampionshipGroups() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { championshipId: string; payload: ChampionshipGroupDrawPayload }) =>
      drawChampionshipGroups(input),
    onSuccess: (_data, variables) => invalidateGroupQueries(queryClient, variables.championshipId),
  });
}

export function useRedistributeChampionshipGroups() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { championshipId: string; payload: ChampionshipGroupDrawPayload }) =>
      redistributeChampionshipGroups(input),
    onSuccess: (_data, variables) => invalidateGroupQueries(queryClient, variables.championshipId),
  });
}

function invalidateGroupQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  championshipId?: string,
) {
  void queryClient.invalidateQueries({ queryKey: championshipGroupQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: championshipStandingQueryKeys.all });

  if (championshipId) {
    void queryClient.invalidateQueries({
      queryKey: championshipQueryKeys.detail(championshipId),
    });
    void queryClient.invalidateQueries({
      queryKey: championshipRegistrationQueryKeys.all,
    });
  }
}
