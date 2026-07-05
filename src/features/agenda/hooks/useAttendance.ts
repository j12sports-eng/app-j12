import { useState } from "react";

import type { AgendaSchedule, PreparedAttendanceDraft } from "../types/agenda.types";

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeUpper(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function isInactiveClass(schedule: AgendaSchedule) {
  const status = normalizeUpper(schedule.classStatus || schedule.status || schedule.scheduleStatus);

  return ["INACTIVE", "INATIVA", "INATIVO", "CANCELLED", "CANCELADA", "CANCELADO"].includes(status);
}

function hasRegisteredAttendance(schedule: AgendaSchedule) {
  const attendanceStatus = normalizeUpper(schedule.attendanceStatus);

  return Boolean(
    schedule.present === true ||
    schedule.present === false ||
    schedule.attendanceRegisteredAt ||
    ["PRESENT", "PRESENTE", "ABSENT", "FALTA", "JUSTIFIED", "JUSTIFICADA"].includes(
      attendanceStatus,
    ),
  );
}

export function buildAgendaScheduleLabel(schedule: AgendaSchedule) {
  const className =
    normalizeText(schedule.className) ||
    normalizeText(schedule.turmaName) ||
    (schedule.classId ? `Turma ${schedule.classId}` : "Turma");
  const startTime = normalizeText(schedule.startTime);
  const endTime = normalizeText(schedule.endTime);

  if (startTime && endTime) {
    return `${className} | ${startTime} - ${endTime}`;
  }

  if (startTime) {
    return `${className} | ${startTime}`;
  }

  return className;
}

export function buildAttendanceDraft(schedule: AgendaSchedule): PreparedAttendanceDraft {
  const blockedReason = isInactiveClass(schedule)
    ? "Turma inativa ou aula cancelada."
    : hasRegisteredAttendance(schedule)
      ? "Presenca ja registrada para este horario."
      : null;

  return {
    agendaItemId: schedule.agendaItemId || schedule.id || null,
    blockedReason,
    classId: schedule.classId ?? null,
    enrollmentId: schedule.enrollmentId || null,
    noAttendanceCreated: true,
    noFinancialSideEffects: true,
    noNotificationSideEffects: true,
    preparedAttendanceDraft: true,
    scheduleDate: schedule.scheduleDate || schedule.attendanceDate || null,
    scheduleLabel: buildAgendaScheduleLabel(schedule),
    startTime: schedule.startTime || null,
    status: "DRAFT",
    studentPersonId: schedule.studentPersonId || null,
    studentProfileId: schedule.studentProfileId || null,
  };
}

export function useAttendance() {
  const [draft, setDraft] = useState<PreparedAttendanceDraft | null>(null);

  function prepareAttendanceDraft(schedule: AgendaSchedule) {
    const nextDraft = buildAttendanceDraft(schedule);
    setDraft(nextDraft);
    return nextDraft;
  }

  function resetAttendanceDraft() {
    setDraft(null);
  }

  return {
    draft,
    prepareAttendanceDraft,
    resetAttendanceDraft,
  };
}
