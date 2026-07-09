import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createRegistrationPlayer,
  deleteRegistrationPlayer,
  getChampionshipRegistrationPlayer,
  listChampionshipRegistrationPlayers,
  setRegistrationPlayerCaptain,
  updateRegistrationPlayer,
} from "../api/championship.api";
import { championshipRegistrationQueryKeys } from "./useChampionshipRegistrations";

import type {
  ChampionshipRegistrationPlayerFilters,
  ChampionshipRegistrationPlayerPayload,
  ChampionshipRegistrationPlayerUpdatePayload,
} from "../types/championship.types";

export const championshipRegistrationPlayerQueryKeys = {
  all: [...championshipRegistrationQueryKeys.all, "atletas"] as const,
  detail: (registrationId?: string, playerId?: string) =>
    [
      ...championshipRegistrationPlayerQueryKeys.all,
      "detail",
      registrationId || "",
      playerId || "",
    ] as const,
  list: (registrationId?: string, filters?: ChampionshipRegistrationPlayerFilters) =>
    [
      ...championshipRegistrationPlayerQueryKeys.all,
      "list",
      registrationId || "",
      filters || {},
    ] as const,
};

const STALE_TIME_MS = 20_000;
const GC_TIME_MS = 5 * 60_000;

export function useChampionshipRegistrationPlayers(
  registrationId?: string,
  filters?: ChampionshipRegistrationPlayerFilters,
) {
  return useQuery({
    enabled: Boolean(registrationId),
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listChampionshipRegistrationPlayers(registrationId || "", filters),
    queryKey: championshipRegistrationPlayerQueryKeys.list(registrationId, filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useChampionshipRegistrationPlayer(registrationId?: string, playerId?: string) {
  return useQuery({
    enabled: Boolean(registrationId && playerId),
    gcTime: GC_TIME_MS,
    queryFn: () =>
      getChampionshipRegistrationPlayer({
        playerId: playerId || "",
        registrationId: registrationId || "",
      }),
    queryKey: championshipRegistrationPlayerQueryKeys.detail(registrationId, playerId),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useCreateRegistrationPlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      payload: ChampionshipRegistrationPlayerPayload;
      registrationId: string;
    }) => createRegistrationPlayer(input),
    onSuccess: (_data, variables) => {
      void invalidateRegistrationPlayerQueries(queryClient, variables.registrationId);
    },
  });
}

export function useUpdateRegistrationPlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      payload: ChampionshipRegistrationPlayerUpdatePayload;
      playerId: string;
      registrationId: string;
    }) => updateRegistrationPlayer(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: championshipRegistrationPlayerQueryKeys.detail(
          variables.registrationId,
          variables.playerId,
        ),
      });
      void invalidateRegistrationPlayerQueries(queryClient, variables.registrationId);
    },
  });
}

export function useDeleteRegistrationPlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { playerId: string; registrationId: string }) =>
      deleteRegistrationPlayer(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: championshipRegistrationPlayerQueryKeys.detail(
          variables.registrationId,
          variables.playerId,
        ),
      });
      void invalidateRegistrationPlayerQueries(queryClient, variables.registrationId);
    },
  });
}

export function useSetCaptain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { captain?: boolean; playerId: string; registrationId: string }) =>
      setRegistrationPlayerCaptain(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: championshipRegistrationPlayerQueryKeys.detail(
          variables.registrationId,
          variables.playerId,
        ),
      });
      void invalidateRegistrationPlayerQueries(queryClient, variables.registrationId);
    },
  });
}

function invalidateRegistrationPlayerQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  registrationId?: string,
) {
  void queryClient.invalidateQueries({ queryKey: championshipRegistrationPlayerQueryKeys.all });

  if (registrationId) {
    void queryClient.invalidateQueries({
      queryKey: championshipRegistrationQueryKeys.detail(registrationId),
    });
  }
}
