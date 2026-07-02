import { useQuery } from "@tanstack/react-query";

import {
  getAgendaByClass,
  getAgendaByEnrollment,
  getAgendaByStudent,
} from "../api/agenda.api";

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
    queryFn: () => fetchAgenda(input),
    queryKey: agendaQueryKey(input),
    retry: 1,
  });
}
