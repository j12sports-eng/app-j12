import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelRegistration,
  getChampionshipRegistration,
  listAvailableChampionshipTeams,
  listChampionshipRegistrations,
  registerTeam,
  updateRegistration,
} from "../api/championship.api";
import { championshipQueryKeys } from "./useChampionships";

import type {
  ChampionshipAvailableTeamFilters,
  ChampionshipRegistrationFilters,
  ChampionshipRegistrationPayload,
} from "../types/championship.types";

export const championshipRegistrationQueryKeys = {
  all: [...championshipQueryKeys.all, "inscricoes"] as const,
  availableTeams: (filters?: ChampionshipAvailableTeamFilters) =>
    [...championshipRegistrationQueryKeys.all, "equipes-disponiveis", filters || {}] as const,
  detail: (registrationId?: string) =>
    [...championshipRegistrationQueryKeys.all, "detail", registrationId || ""] as const,
  list: (filters?: ChampionshipRegistrationFilters) =>
    [...championshipRegistrationQueryKeys.all, "list", filters || {}] as const,
};

const STALE_TIME_MS = 20_000;
const GC_TIME_MS = 5 * 60_000;

export function useChampionshipRegistrations(filters?: ChampionshipRegistrationFilters) {
  return useQuery({
    enabled: Boolean(filters?.championshipId),
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listChampionshipRegistrations(filters),
    queryKey: championshipRegistrationQueryKeys.list(filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useChampionshipRegistration(registrationId?: string) {
  return useQuery({
    enabled: Boolean(registrationId),
    gcTime: GC_TIME_MS,
    queryFn: () => getChampionshipRegistration(registrationId || ""),
    queryKey: championshipRegistrationQueryKeys.detail(registrationId),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useAvailableChampionshipTeams(filters?: ChampionshipAvailableTeamFilters) {
  return useQuery({
    enabled: Boolean(filters?.championshipId),
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listAvailableChampionshipTeams(filters),
    queryKey: championshipRegistrationQueryKeys.availableTeams(filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useRegisterTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ChampionshipRegistrationPayload) => registerTeam(payload),
    onSuccess: () => invalidateRegistrationQueries(queryClient),
  });
}

export function useCancelRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (registrationId: string) => cancelRegistration(registrationId),
    onSuccess: (_data, registrationId) => {
      void queryClient.invalidateQueries({
        queryKey: championshipRegistrationQueryKeys.detail(registrationId),
      });
      void invalidateRegistrationQueries(queryClient);
    },
  });
}

export function useUpdateRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRegistration,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: championshipRegistrationQueryKeys.detail(variables.registrationId),
      });
      void invalidateRegistrationQueries(queryClient);
    },
  });
}

function invalidateRegistrationQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: championshipRegistrationQueryKeys.all });
}
