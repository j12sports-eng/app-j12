import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getAgendaByClass, getAgendaByEnrollment, getAgendaByStudent } from "../api/agenda.api";

import type {
  AgendaAdminSummaryResponse,
  AgendaClassSchedulesResponse,
  AgendaLookupInput,
} from "../types/agenda.types";

export const agendaQueryKey = (input: AgendaLookupInput) => [
  "agenda",
  "admin",
  input.mode,
  input.studentPersonId || "",
  input.studentProfileId || "",
  input.enrollmentId || "",
  input.classId || "",
  String(input.limit || ""),
];

const AGENDA_QUERY_STALE_TIME_MS = 30_000;
const AGENDA_QUERY_GC_TIME_MS = 5 * 60_000;

function hasRequiredScope(input: AgendaLookupInput) {
  if (input.mode === "student") {
    return Boolean(input.studentPersonId?.trim() && input.studentProfileId?.trim());
  }

  if (input.mode === "enrollment") {
    return Boolean(input.enrollmentId?.trim());
  }

  return Boolean(input.classId?.trim());
}

function fetchAgenda(
  input: AgendaLookupInput,
): Promise<AgendaAdminSummaryResponse | AgendaClassSchedulesResponse> {
  if (input.mode === "student") {
    return getAgendaByStudent({
      limit: input.limit,
      studentPersonId: input.studentPersonId || "",
      studentProfileId: input.studentProfileId || "",
    });
  }

  if (input.mode === "enrollment") {
    return getAgendaByEnrollment({
      enrollmentId: input.enrollmentId || "",
      limit: input.limit,
    });
  }

  return getAgendaByClass({
    classId: input.classId || "",
    limit: input.limit,
  });
}

export function useAgenda(input: AgendaLookupInput) {
  return useQuery({
    enabled: Boolean(input.enabled && hasRequiredScope(input)),
    gcTime: AGENDA_QUERY_GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => fetchAgenda(input),
    queryKey: agendaQueryKey(input),
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: AGENDA_QUERY_STALE_TIME_MS,
  });
}
