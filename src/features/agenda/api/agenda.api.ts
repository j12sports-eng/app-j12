import { api } from "@/lib/api";

import type {
  AgendaAdminSummaryResponse,
  AgendaClassSchedulesResponse,
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
