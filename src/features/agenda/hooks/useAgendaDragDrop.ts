import { useMutation, useQueryClient } from "@tanstack/react-query";

import { rescheduleAgendaEvent } from "../api/agenda.api";
import { agendaQueryKey } from "./useAgenda";
import {
  buildAgendaCalendarEvents,
  formatAgendaDateKey,
  getAgendaCalendarPeriod,
  parseAgendaDate,
} from "./useAgendaCalendar";

import type {
  AgendaAdminSummaryResponse,
  AgendaCalendarEvent,
  AgendaClassSchedulesResponse,
  AgendaConflictValidationPayload,
  AgendaLookupInput,
  AgendaMoveValidation,
  AgendaReschedulePayload,
  AgendaRescheduleResponse,
  AgendaRescheduleTarget,
  AgendaSchedule,
} from "../types/agenda.types";

type AgendaResponse = AgendaAdminSummaryResponse | AgendaClassSchedulesResponse;

type RescheduleMutationInput = {
  event: AgendaCalendarEvent;
  target: AgendaRescheduleTarget;
};

type RescheduleMutationContext = {
  previousData?: AgendaResponse;
  queryKey?: ReturnType<typeof agendaQueryKey>;
};

type UseAgendaDragDropInput = {
  queryInput: AgendaLookupInput | null;
  schedules: AgendaSchedule[];
};

const SCHEDULE_LIST_KEYS = ["schedules", "scheduleCandidates", "agendaItems"] as const;

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeUpper(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function normalizeComparable(value: unknown) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeNullableText(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function readSchedulePrimaryId(schedule: AgendaSchedule) {
  return normalizeText(schedule.agendaItemId || schedule.id);
}

function readEventPrimaryId(event: AgendaCalendarEvent) {
  return normalizeText(event.schedule.agendaItemId || event.schedule.id || event.id);
}

function toTimeMinutes(value: unknown) {
  const match = /^(\d{1,2}):(\d{2})/.exec(normalizeText(value));

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function hasRegisteredAttendance(schedule: AgendaSchedule) {
  const status = normalizeUpper(schedule.attendanceStatus);

  return Boolean(
    schedule.present === true ||
    schedule.present === false ||
    schedule.attendanceRegisteredAt ||
    ["PRESENT", "PRESENTE", "ABSENT", "FALTA", "JUSTIFIED", "JUSTIFICADA"].includes(status),
  );
}

function isInactiveSchedule(schedule: AgendaSchedule) {
  const status = normalizeUpper(schedule.classStatus || schedule.scheduleStatus || schedule.status);

  return ["INACTIVE", "INATIVA", "INATIVO", "CANCELLED", "CANCELADA", "CANCELADO"].includes(status);
}

function isSameSchedule(left: AgendaSchedule, rightEvent: AgendaCalendarEvent) {
  const leftId = readSchedulePrimaryId(left);
  const rightId = readEventPrimaryId(rightEvent);

  if (leftId && rightId && leftId === rightId) {
    return true;
  }

  return (
    normalizeText(left.enrollmentId) === normalizeText(rightEvent.schedule.enrollmentId) &&
    normalizeText(left.classId) === normalizeText(rightEvent.schedule.classId) &&
    normalizeText(left.startTime) === normalizeText(rightEvent.schedule.startTime)
  );
}

function hasSharedConflictResource(
  candidate: AgendaSchedule,
  event: AgendaCalendarEvent,
  target: AgendaRescheduleTarget,
) {
  const targetClassId = normalizeText(event.schedule.classId);
  const targetEnrollmentId = normalizeText(event.schedule.enrollmentId);
  const targetProfessorId = normalizeText(target.professorId ?? event.schedule.professorId);
  const targetProfessorName = normalizeComparable(
    target.professorName ?? event.schedule.professorName,
  );
  const targetCourtId = normalizeText(
    target.courtId ?? target.quadraId ?? event.schedule.courtId ?? event.schedule.quadraId,
  );
  const targetCourtName = normalizeComparable(
    target.courtName ?? target.quadraName ?? event.schedule.courtName ?? event.schedule.quadraName,
  );

  const classMatches = Boolean(targetClassId && targetClassId === normalizeText(candidate.classId));
  const enrollmentMatches = Boolean(
    targetEnrollmentId && targetEnrollmentId === normalizeText(candidate.enrollmentId),
  );
  const professorMatches = Boolean(
    (targetProfessorId && targetProfessorId === normalizeText(candidate.professorId)) ||
    (targetProfessorName && targetProfessorName === normalizeComparable(candidate.professorName)),
  );
  const courtMatches = Boolean(
    (targetCourtId &&
      [candidate.courtId, candidate.quadraId].some(
        (value) => targetCourtId === normalizeText(value),
      )) ||
    (targetCourtName &&
      [candidate.courtName, candidate.quadraName].some(
        (value) => targetCourtName === normalizeComparable(value),
      )),
  );

  return classMatches || enrollmentMatches || professorMatches || courtMatches;
}

function readEventsForTargetDate(schedules: AgendaSchedule[], targetDate: Date) {
  const period = getAgendaCalendarPeriod("day", targetDate);

  return buildAgendaCalendarEvents(schedules, period);
}

function patchSchedule(
  schedule: AgendaSchedule,
  event: AgendaCalendarEvent,
  target: AgendaRescheduleTarget,
) {
  const nextDateKey = formatAgendaDateKey(target.date);
  const nextStartTime = normalizeNullableText(target.startTime) || schedule.startTime || null;
  const nextEndTime = normalizeNullableText(target.endTime) || schedule.endTime || null;
  const nextProfessorName =
    typeof target.professorName === "undefined"
      ? schedule.professorName
      : normalizeNullableText(target.professorName);
  const nextCourtName =
    typeof target.courtName === "undefined"
      ? schedule.courtName
      : normalizeNullableText(target.courtName);
  const nextQuadraName =
    typeof target.quadraName === "undefined"
      ? schedule.quadraName
      : normalizeNullableText(target.quadraName);

  return {
    ...schedule,
    courtId: typeof target.courtId === "undefined" ? schedule.courtId : target.courtId,
    courtName: nextCourtName,
    dayOfWeek: target.date.getDay(),
    daysOfWeek: Array.isArray(schedule.daysOfWeek) ? [target.date.getDay()] : schedule.daysOfWeek,
    endTime: nextEndTime,
    id: schedule.id || event.schedule.id,
    persistedAgenda: true,
    professorId:
      typeof target.professorId === "undefined" ? schedule.professorId : target.professorId,
    professorName: nextProfessorName,
    quadraId: typeof target.quadraId === "undefined" ? schedule.quadraId : target.quadraId,
    quadraName: nextQuadraName,
    scheduleDate: nextDateKey,
    startTime: nextStartTime,
  } satisfies AgendaSchedule;
}

function patchScheduleList(
  schedules: AgendaSchedule[] | undefined,
  event: AgendaCalendarEvent,
  target: AgendaRescheduleTarget,
  responseSchedule?: AgendaSchedule | null,
) {
  if (!Array.isArray(schedules)) {
    return schedules;
  }

  return schedules.map((schedule) => {
    if (!isSameSchedule(schedule, event)) {
      return schedule;
    }

    return responseSchedule || patchSchedule(schedule, event, target);
  });
}

function patchAgendaResponse(
  data: AgendaResponse | undefined,
  event: AgendaCalendarEvent,
  target: AgendaRescheduleTarget,
  responseSchedule?: AgendaSchedule | null,
): AgendaResponse | undefined {
  if (!data) {
    return data;
  }

  const nextData = { ...data } as AgendaAdminSummaryResponse & AgendaClassSchedulesResponse;

  for (const key of SCHEDULE_LIST_KEYS) {
    const nextList = patchScheduleList(nextData[key], event, target, responseSchedule);

    if (Array.isArray(nextList)) {
      nextData[key] = nextList;
    }
  }

  return nextData;
}

export function buildAgendaReschedulePayload({
  event,
  target,
}: RescheduleMutationInput): AgendaReschedulePayload {
  const schedule = event.schedule;

  return {
    agendaItemId: schedule.agendaItemId || null,
    calendarEventId: event.id,
    classId: schedule.classId || null,
    courtId: target.courtId ?? schedule.courtId ?? null,
    courtName: normalizeNullableText(target.courtName ?? schedule.courtName),
    enrollmentId: schedule.enrollmentId || null,
    fromDate: event.dateKey,
    fromEndTime: schedule.endTime || null,
    fromStartTime: schedule.startTime || null,
    noFinancialSideEffects: true,
    noNotificationSideEffects: true,
    professorId: target.professorId ?? schedule.professorId ?? null,
    professorName: normalizeNullableText(target.professorName ?? schedule.professorName),
    quadraId: target.quadraId ?? schedule.quadraId ?? null,
    quadraName: normalizeNullableText(target.quadraName ?? schedule.quadraName),
    reason: normalizeNullableText(target.reason),
    scheduleId: schedule.id || null,
    studentPersonId: schedule.studentPersonId || null,
    studentProfileId: schedule.studentProfileId || null,
    toDate: formatAgendaDateKey(target.date),
    toEndTime: normalizeNullableText(target.endTime ?? schedule.endTime),
    toStartTime: normalizeText(target.startTime || schedule.startTime),
  };
}

export function buildAgendaValidationPayload({
  event,
  target,
}: RescheduleMutationInput): AgendaConflictValidationPayload {
  return {
    ...buildAgendaReschedulePayload({ event, target }),
    action: "VALIDATE",
    eventId: event.id,
    isRecurringProjection: event.isRecurringProjection,
    recurrenceUpdateScope: event.isRecurringProjection ? "INSTANCE" : null,
  };
}

export function validateAgendaMove(
  schedules: AgendaSchedule[],
  event: AgendaCalendarEvent,
  target: AgendaRescheduleTarget,
): AgendaMoveValidation {
  const targetDateKey = formatAgendaDateKey(target.date);
  const targetStartTime = normalizeText(target.startTime || event.schedule.startTime);
  const targetEndTime = normalizeText(target.endTime || event.schedule.endTime);

  if (!targetDateKey || Number.isNaN(target.date.getTime())) {
    return { ok: false, reason: "Data de destino invalida." };
  }

  if (!targetStartTime) {
    return { ok: false, reason: "Informe o horario inicial para reagendar." };
  }

  if (targetEndTime) {
    const startMinutes = toTimeMinutes(targetStartTime);
    const endMinutes = toTimeMinutes(targetEndTime);

    if (startMinutes !== null && endMinutes !== null && startMinutes >= endMinutes) {
      return { ok: false, reason: "Horario final deve ser maior que o horario inicial." };
    }
  }

  if (isInactiveSchedule(event.schedule)) {
    return { ok: false, reason: "Turma inativa ou cancelada nao pode ser reagendada." };
  }

  if (hasRegisteredAttendance(event.schedule)) {
    return { ok: false, reason: "Aula com presenca registrada nao pode ser reagendada." };
  }

  const sameDate = event.dateKey === targetDateKey;
  const sameStartTime = normalizeText(event.schedule.startTime) === targetStartTime;
  const sameEndTime = !targetEndTime || normalizeText(event.schedule.endTime) === targetEndTime;
  const sameProfessor =
    normalizeComparable(event.schedule.professorName) ===
    normalizeComparable(target.professorName ?? event.schedule.professorName);
  const sameCourt =
    normalizeComparable(event.schedule.courtName ?? event.schedule.quadraName) ===
    normalizeComparable(
      target.courtName ??
        target.quadraName ??
        event.schedule.courtName ??
        event.schedule.quadraName,
    );

  if (sameDate && sameStartTime && sameEndTime && sameProfessor && sameCourt) {
    return { ok: false, reason: "O evento ja esta neste periodo." };
  }

  const conflictingEvent = readEventsForTargetDate(schedules, target.date).find(
    (candidateEvent) => {
      if (candidateEvent.id === event.id || isSameSchedule(candidateEvent.schedule, event)) {
        return false;
      }

      return (
        candidateEvent.dateKey === targetDateKey &&
        normalizeText(candidateEvent.schedule.startTime) === targetStartTime &&
        hasSharedConflictResource(candidateEvent.schedule, event, target)
      );
    },
  );

  if (conflictingEvent) {
    return {
      conflictEventId: conflictingEvent.id,
      ok: false,
      reason: `Conflito com ${conflictingEvent.title} em ${conflictingEvent.timeLabel}.`,
    };
  }

  return { ok: true };
}

export function useAgendaDragDrop({ queryInput, schedules }: UseAgendaDragDropInput) {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    AgendaRescheduleResponse,
    Error,
    RescheduleMutationInput,
    RescheduleMutationContext
  >({
    mutationFn: (input) => rescheduleAgendaEvent(buildAgendaReschedulePayload(input)),
    onMutate: async (input) => {
      if (!queryInput) {
        return {};
      }

      const queryKey = agendaQueryKey(queryInput);
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<AgendaResponse>(queryKey);

      queryClient.setQueryData<AgendaResponse>(queryKey, (current) =>
        patchAgendaResponse(current, input.event, input.target),
      );

      return { previousData, queryKey };
    },
    onError: (_error, _input, context) => {
      if (context?.queryKey && context.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },
    onSettled: (response, _error, input, context) => {
      const responseSchedule = response?.updatedSchedule || response?.schedule || null;

      if (context?.queryKey && responseSchedule) {
        queryClient.setQueryData<AgendaResponse>(context.queryKey, (current) =>
          patchAgendaResponse(current, input.event, input.target, responseSchedule),
        );
      }

      if (context?.queryKey) {
        void queryClient.invalidateQueries({ queryKey: context.queryKey });
      }
    },
  });

  async function rescheduleEvent(event: AgendaCalendarEvent, target: AgendaRescheduleTarget) {
    const validation = validateAgendaMove(schedules, event, target);

    if (!validation.ok) {
      throw new Error(validation.reason || "Reagendamento invalido.");
    }

    return mutation.mutateAsync({ event, target });
  }

  return {
    isRescheduling: mutation.isPending,
    rescheduleEvent,
    reschedulingEventId: mutation.variables?.event.id || null,
    validateMove: (event: AgendaCalendarEvent, target: AgendaRescheduleTarget) =>
      validateAgendaMove(schedules, event, target),
  };
}
