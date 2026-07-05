import { useQuery } from "@tanstack/react-query";

import { validateAgendaEvent } from "../api/agenda.api";
import { buildAgendaValidationPayload } from "./useAgendaDragDrop";
import { formatAgendaDateKey } from "./useAgendaCalendar";

import type {
  AgendaCalendarEvent,
  AgendaConflictValidationPayload,
  AgendaRescheduleTarget,
} from "../types/agenda.types";

type UseAgendaConflictValidationInput = {
  enabled?: boolean;
  event: AgendaCalendarEvent | null;
  target: AgendaRescheduleTarget | null;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function hasRequiredValidationFields(payload: AgendaConflictValidationPayload | null) {
  return Boolean(payload?.toDate && payload?.toStartTime);
}

function createValidationKeyPayload(payload: AgendaConflictValidationPayload | null) {
  if (!payload) {
    return null;
  }

  return {
    agendaItemId: payload.agendaItemId || null,
    classId: payload.classId || null,
    courtId: payload.courtId || payload.quadraId || null,
    courtName: payload.courtName || payload.quadraName || null,
    enrollmentId: payload.enrollmentId || null,
    eventId: payload.eventId || payload.calendarEventId || null,
    professorId: payload.professorId || null,
    professorName: payload.professorName || null,
    studentPersonId: payload.studentPersonId || null,
    studentProfileId: payload.studentProfileId || null,
    toDate: payload.toDate,
    toEndTime: payload.toEndTime || null,
    toStartTime: payload.toStartTime,
  };
}

export function buildAgendaConflictValidationPayload(
  event: AgendaCalendarEvent | null,
  target: AgendaRescheduleTarget | null,
) {
  if (!event || !target || Number.isNaN(target.date.getTime())) {
    return null;
  }

  const payload = buildAgendaValidationPayload({ event, target });

  return {
    ...payload,
    toDate: formatAgendaDateKey(target.date),
    toEndTime: normalizeText(target.endTime ?? event.schedule.endTime) || null,
    toStartTime: normalizeText(target.startTime ?? event.schedule.startTime),
  };
}

export function useAgendaConflictValidation({
  enabled = true,
  event,
  target,
}: UseAgendaConflictValidationInput) {
  const payload = buildAgendaConflictValidationPayload(event, target);
  const keyPayload = createValidationKeyPayload(payload);

  return useQuery({
    enabled: Boolean(enabled && payload && hasRequiredValidationFields(payload)),
    gcTime: 60_000,
    queryFn: () => validateAgendaEvent(payload as AgendaConflictValidationPayload),
    queryKey: ["agenda", "conflict-validation", keyPayload],
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 5_000,
  });
}
