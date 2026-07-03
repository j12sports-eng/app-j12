import { api } from "@/lib/api";

import type {
  AgendaAdminSummaryResponse,
  AgendaClassSchedulesResponse,
  AgendaConflictValidationPayload,
  AgendaConflictValidationResponse,
  AgendaRecurrenceMutationPayload,
  AgendaRecurrenceResponse,
  AgendaReschedulePayload,
  AgendaRescheduleResponse,
} from "../types/agenda.types";

const ADMIN_AGENDA_ENDPOINT = "/admin/agenda";

function appendLimit(endpoint: string, limit?: number) {
  const normalizedLimit = Number(limit);

  if (!Number.isFinite(normalizedLimit) || normalizedLimit <= 0) {
    return endpoint;
  }

  const params = new URLSearchParams();
  params.set("limit", String(Math.trunc(normalizedLimit)));

  return `${endpoint}?${params.toString()}`;
}

function encodePath(value: string) {
  return encodeURIComponent(value.trim());
}

export function getAgendaByStudent(input: {
  limit?: number;
  studentPersonId: string;
  studentProfileId: string;
}) {
  const studentPersonId = encodePath(input.studentPersonId);
  const studentProfileId = encodePath(input.studentProfileId);

  return api.get<AgendaAdminSummaryResponse>(
    appendLimit(
      `${ADMIN_AGENDA_ENDPOINT}/students/${studentPersonId}/${studentProfileId}/summary`,
      input.limit,
    ),
  );
}

export function getAgendaByEnrollment(input: { enrollmentId: string; limit?: number }) {
  const enrollmentId = encodePath(input.enrollmentId);

  return api.get<AgendaAdminSummaryResponse>(
    appendLimit(`${ADMIN_AGENDA_ENDPOINT}/enrollments/${enrollmentId}/summary`, input.limit),
  );
}

export function getAgendaByClass(input: { classId: string; limit?: number }) {
  const classId = encodePath(input.classId);

  return api.get<AgendaClassSchedulesResponse>(
    appendLimit(`${ADMIN_AGENDA_ENDPOINT}/classes/${classId}/schedules`, input.limit),
  );
}

export function rescheduleAgendaEvent(input: AgendaReschedulePayload) {
  const eventId = encodePath(
    String(input.agendaItemId || input.scheduleId || input.calendarEventId || ""),
  );

  return api.patch<AgendaRescheduleResponse>(
    `${ADMIN_AGENDA_ENDPOINT}/events/${eventId}/reschedule`,
    input,
  );
}

export function validateAgendaEvent(input: AgendaConflictValidationPayload) {
  return api.post<AgendaConflictValidationResponse>(
    `${ADMIN_AGENDA_ENDPOINT}/events/validate`,
    input,
  );
}

export function previewAgendaRecurrence(input: AgendaRecurrenceMutationPayload) {
  return api.post<AgendaRecurrenceResponse>(
    `${ADMIN_AGENDA_ENDPOINT}/recurrences/preview`,
    input,
  );
}

export function createAgendaRecurrenceSeries(input: AgendaRecurrenceMutationPayload) {
  return api.post<AgendaRecurrenceResponse>(`${ADMIN_AGENDA_ENDPOINT}/recurrences`, input);
}

export function getAgendaRecurrenceSeries(input: { limit?: number; seriesId: string }) {
  const seriesId = encodePath(input.seriesId);

  return api.get<AgendaRecurrenceResponse>(
    appendLimit(`${ADMIN_AGENDA_ENDPOINT}/recurrences/${seriesId}`, input.limit),
  );
}

export function updateAgendaRecurrence(input: AgendaRecurrenceMutationPayload) {
  const seriesId = encodePath(String(input.seriesId || ""));
  const occurrenceKey = input.occurrenceKey ? encodePath(String(input.occurrenceKey)) : null;
  const endpoint = occurrenceKey
    ? `${ADMIN_AGENDA_ENDPOINT}/recurrences/${seriesId}/occurrences/${occurrenceKey}`
    : `${ADMIN_AGENDA_ENDPOINT}/recurrences/${seriesId}`;

  return api.patch<AgendaRecurrenceResponse>(endpoint, input);
}

export function cancelAgendaRecurrence(input: AgendaRecurrenceMutationPayload) {
  const seriesId = encodePath(String(input.seriesId || ""));
  const occurrenceKey = input.occurrenceKey ? encodePath(String(input.occurrenceKey)) : null;
  const endpoint = occurrenceKey
    ? `${ADMIN_AGENDA_ENDPOINT}/recurrences/${seriesId}/occurrences/${occurrenceKey}`
    : `${ADMIN_AGENDA_ENDPOINT}/recurrences/${seriesId}`;
  const params = new URLSearchParams();

  if (input.scope) params.set("scope", String(input.scope));
  if (input.reason) params.set("reason", String(input.reason));
  if (input.occurrenceDate) params.set("occurrenceDate", String(input.occurrenceDate));
  if (input.occurrenceStartTime) {
    params.set("occurrenceStartTime", String(input.occurrenceStartTime));
  }

  return api.delete<AgendaRecurrenceResponse>(
    params.toString() ? `${endpoint}?${params.toString()}` : endpoint,
  );
}
