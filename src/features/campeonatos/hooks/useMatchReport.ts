import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createMatchReport,
  createMatchReportEvent,
  deleteMatchReportEvent,
  finalizeMatchReport,
  getMatchReport,
  openMatchReport,
  reopenMatchReport,
  updateMatchReport,
  updateMatchReportEvent,
} from "../api/championship.api";
import { championshipRoundQueryKeys } from "./useChampionshipRounds";
import { championshipStandingQueryKeys } from "./useChampionshipStandings";
import { championshipStatisticsQueryKeys } from "./useChampionshipStatistics";

import type {
  ChampionshipMatchEventPayload,
  ChampionshipMatchEventUpdatePayload,
  ChampionshipMatchReportFinalizePayload,
  ChampionshipMatchReportPayload,
} from "../types/championship.types";

export const championshipMatchReportQueryKeys = {
  all: [...championshipRoundQueryKeys.all, "sumulas"] as const,
  detail: (matchId?: string) =>
    [...championshipMatchReportQueryKeys.all, "detail", matchId || ""] as const,
  events: (matchId?: string) =>
    [...championshipMatchReportQueryKeys.all, "events", matchId || ""] as const,
};

const STALE_TIME_MS = 10_000;
const GC_TIME_MS = 5 * 60_000;

export function useMatchReport(matchId?: string) {
  return useQuery({
    enabled: Boolean(matchId),
    gcTime: GC_TIME_MS,
    queryFn: () => getMatchReport(matchId || ""),
    queryKey: championshipMatchReportQueryKeys.detail(matchId),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useMatchEvents(matchId?: string) {
  return useQuery({
    enabled: Boolean(matchId),
    gcTime: GC_TIME_MS,
    queryFn: () => getMatchReport(matchId || ""),
    queryKey: championshipMatchReportQueryKeys.events(matchId),
    retry: 1,
    select: (data) => data.report?.events || [],
    staleTime: STALE_TIME_MS,
  });
}

export function useCreateMatchReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { matchId: string; payload?: ChampionshipMatchReportPayload }) =>
      createMatchReport(input),
    onSuccess: (data, variables) =>
      invalidateMatchReportQueries(queryClient, variables.matchId, data.championshipId),
  });
}

export function useUpdateMatchReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { matchId: string; payload: ChampionshipMatchReportPayload }) =>
      updateMatchReport(input),
    onSuccess: (data, variables) =>
      invalidateMatchReportQueries(queryClient, variables.matchId, data.championshipId),
  });
}

export function useOpenMatchReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { matchId: string }) => openMatchReport(input.matchId),
    onSuccess: (data, variables) =>
      invalidateMatchReportQueries(queryClient, variables.matchId, data.championshipId),
  });
}

export function useFinalizeMatchReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { matchId: string; payload?: ChampionshipMatchReportFinalizePayload }) =>
      finalizeMatchReport(input),
    onSuccess: (data, variables) => {
      invalidateMatchReportQueries(queryClient, variables.matchId, data.championshipId);
      invalidateResultQueries(queryClient, data.championshipId);
    },
  });
}

export function useReopenMatchReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { matchId: string }) => reopenMatchReport(input.matchId),
    onSuccess: (data, variables) =>
      invalidateMatchReportQueries(queryClient, variables.matchId, data.championshipId),
  });
}

export function useCreateMatchEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { matchId: string; payload: ChampionshipMatchEventPayload }) =>
      createMatchReportEvent(input),
    onSuccess: (data, variables) =>
      invalidateMatchReportQueries(queryClient, variables.matchId, data.championshipId),
  });
}

export function useUpdateMatchEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      eventId: string;
      matchId: string;
      payload: ChampionshipMatchEventUpdatePayload;
    }) => updateMatchReportEvent(input),
    onSuccess: (data, variables) =>
      invalidateMatchReportQueries(queryClient, variables.matchId, data.championshipId),
  });
}

export function useDeleteMatchEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { eventId: string; matchId: string }) => deleteMatchReportEvent(input),
    onSuccess: (data, variables) =>
      invalidateMatchReportQueries(queryClient, variables.matchId, data.championshipId),
  });
}

function invalidateMatchReportQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  matchId?: string,
  championshipId?: string,
) {
  void queryClient.invalidateQueries({ queryKey: championshipMatchReportQueryKeys.all });
  void invalidateStatisticsQueries(queryClient, championshipId);

  if (matchId) {
    void queryClient.invalidateQueries({
      queryKey: championshipMatchReportQueryKeys.detail(matchId),
    });
    void queryClient.invalidateQueries({
      queryKey: championshipMatchReportQueryKeys.events(matchId),
    });
  }
}

function invalidateResultQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  championshipId?: string,
) {
  void queryClient.invalidateQueries({ queryKey: championshipRoundQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: championshipStandingQueryKeys.all });
  void invalidateStatisticsQueries(queryClient, championshipId);

  if (championshipId) {
    void queryClient.invalidateQueries({
      queryKey: championshipRoundQueryKeys.matches(championshipId),
    });
  }
}

function invalidateStatisticsQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  championshipId?: string,
) {
  void queryClient.invalidateQueries({ queryKey: championshipStatisticsQueryKeys.all });

  if (championshipId) {
    void queryClient.invalidateQueries({
      queryKey: championshipStatisticsQueryKeys.detail(championshipId),
    });
  }
}
