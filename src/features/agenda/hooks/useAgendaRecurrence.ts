import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  cancelAgendaRecurrence,
  createAgendaRecurrenceSeries,
  previewAgendaRecurrence,
  updateAgendaRecurrence,
} from "../api/agenda.api";
import { agendaQueryKey } from "./useAgenda";

import type {
  AgendaLookupInput,
  AgendaRecurrenceMutationPayload,
  AgendaRecurrenceResponse,
} from "../types/agenda.types";

type UseAgendaRecurrenceInput = {
  queryInput: AgendaLookupInput | null;
};

export function useAgendaRecurrence({ queryInput }: UseAgendaRecurrenceInput) {
  const queryClient = useQueryClient();

  const previewMutation = useMutation<AgendaRecurrenceResponse, Error, AgendaRecurrenceMutationPayload>({
    mutationFn: previewAgendaRecurrence,
  });
  const createMutation = useMutation<AgendaRecurrenceResponse, Error, AgendaRecurrenceMutationPayload>({
    mutationFn: createAgendaRecurrenceSeries,
    onSuccess: () => invalidateAgendaQuery(queryClient, queryInput),
  });
  const updateMutation = useMutation<AgendaRecurrenceResponse, Error, AgendaRecurrenceMutationPayload>({
    mutationFn: updateAgendaRecurrence,
    onSuccess: () => invalidateAgendaQuery(queryClient, queryInput),
  });
  const cancelMutation = useMutation<AgendaRecurrenceResponse, Error, AgendaRecurrenceMutationPayload>({
    mutationFn: cancelAgendaRecurrence,
    onSuccess: () => invalidateAgendaQuery(queryClient, queryInput),
  });

  return {
    cancelRecurrence: cancelMutation.mutateAsync,
    createRecurrence: createMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
    isCreating: createMutation.isPending,
    isPreviewing: previewMutation.isPending,
    isUpdating: updateMutation.isPending,
    previewRecurrence: previewMutation.mutateAsync,
    previewResult: previewMutation.data || null,
    resetPreview: previewMutation.reset,
    updateRecurrence: updateMutation.mutateAsync,
  };
}

function invalidateAgendaQuery(
  queryClient: ReturnType<typeof useQueryClient>,
  queryInput: AgendaLookupInput | null,
) {
  if (!queryInput) {
    return;
  }

  void queryClient.invalidateQueries({ queryKey: agendaQueryKey(queryInput) });
}
