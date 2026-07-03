import { useMemo } from "react";

import { buildAgendaScheduleLabel } from "./useAttendance";

import type {
  AgendaCalendarEvent,
  AgendaCalendarPeriod,
  AgendaCalendarView,
  AgendaRecurrenceFrequency,
  AgendaRecurrenceIntervalUnit,
  AgendaSchedule,
} from "../types/agenda.types";

type AgendaCalendarInput = {
  schedules: AgendaSchedule[];
  selectedDate: Date;
  view: AgendaCalendarView;
};

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"] as const;
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});
const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  weekday: "long",
  year: "numeric",
});
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});
const WEEKDAY_TO_INDEX = new Map<string, number>([
  ["domingo", 0],
  ["dom", 0],
  ["sunday", 0],
  ["sun", 0],
  ["segunda", 1],
  ["segunda-feira", 1],
  ["seg", 1],
  ["monday", 1],
  ["mon", 1],
  ["terca", 2],
  ["terca-feira", 2],
  ["ter", 2],
  ["tuesday", 2],
  ["tue", 2],
  ["quarta", 3],
  ["quarta-feira", 3],
  ["qua", 3],
  ["wednesday", 3],
  ["wed", 3],
  ["quinta", 4],
  ["quinta-feira", 4],
  ["qui", 4],
  ["thursday", 4],
  ["thu", 4],
  ["sexta", 5],
  ["sexta-feira", 5],
  ["sex", 5],
  ["friday", 5],
  ["fri", 5],
  ["sabado", 6],
  ["sab", 6],
  ["saturday", 6],
  ["sat", 6],
]);

function normalizeDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const nextDate = normalizeDate(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function addMonths(date: Date, amount: number) {
  const nextDate = normalizeDate(date);
  nextDate.setMonth(nextDate.getMonth() + amount, 1);
  return nextDate;
}

function addYears(date: Date, amount: number) {
  const nextDate = normalizeDate(date);
  nextDate.setFullYear(nextDate.getFullYear() + amount);
  return nextDate;
}

function startOfWeek(date: Date) {
  const normalized = normalizeDate(date);
  const day = normalized.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(normalized, offset);
}

function startOfRecurrenceWeek(date: Date) {
  const normalized = normalizeDate(date);
  normalized.setDate(normalized.getDate() - normalized.getDay());
  return normalized;
}

function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function eachDay(startDate: Date, endDate: Date) {
  const days: Date[] = [];
  let current = normalizeDate(startDate);
  const end = normalizeDate(endDate);

  while (current <= end) {
    days.push(current);
    current = addDays(current, 1);
  }

  return days;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeDayText(value: unknown) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function formatAgendaDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseAgendaDate(value: unknown) {
  const normalized = normalizeText(value);

  if (!normalized) return null;

  const dateOnly = normalized.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);

  if (!match) return null;

  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getAgendaCalendarPeriod(
  view: AgendaCalendarView,
  selectedDate: Date,
): AgendaCalendarPeriod {
  const normalized = normalizeDate(selectedDate);

  if (view === "day") {
    return {
      endDate: normalized,
      label: DAY_LABEL_FORMATTER.format(normalized),
      startDate: normalized,
      view,
    };
  }

  if (view === "week") {
    const startDate = startOfWeek(normalized);
    const endDate = endOfWeek(normalized);

    return {
      endDate,
      label: `${SHORT_DATE_FORMATTER.format(startDate)} - ${SHORT_DATE_FORMATTER.format(endDate)}`,
      startDate,
      view,
    };
  }

  const startDate = startOfMonth(normalized);
  const endDate = endOfMonth(normalized);

  return {
    endDate,
    label: MONTH_LABEL_FORMATTER.format(normalized),
    startDate,
    view,
  };
}

export function getAgendaCalendarGridDays(period: AgendaCalendarPeriod) {
  if (period.view !== "month") {
    return eachDay(period.startDate, period.endDate);
  }

  return eachDay(startOfWeek(period.startDate), endOfWeek(period.endDate));
}

export function navigateAgendaCalendarDate(
  selectedDate: Date,
  view: AgendaCalendarView,
  direction: -1 | 1,
) {
  if (view === "month") {
    return addMonths(selectedDate, direction);
  }

  if (view === "week") {
    return addDays(selectedDate, direction * 7);
  }

  return addDays(selectedDate, direction);
}

function parseWeekdayIndex(value: unknown) {
  if (typeof value === "number" || /^\d+$/.test(normalizeText(value))) {
    const numeric = Number(value);

    if (numeric === 0 || numeric === 7) return 0;
    if (numeric >= 1 && numeric <= 6) return numeric;
  }

  return WEEKDAY_TO_INDEX.get(normalizeDayText(value)) ?? null;
}

function readScheduleWeekdayIndexes(schedule: AgendaSchedule) {
  const rawDays = Array.isArray(schedule.daysOfWeek)
    ? schedule.daysOfWeek
    : schedule.dayOfWeek != null
      ? [schedule.dayOfWeek]
      : [];

  return Array.from(
    new Set(
      rawDays
        .map(parseWeekdayIndex)
        .filter((dayIndex): dayIndex is number => typeof dayIndex === "number"),
    ),
  );
}

function readConcreteScheduleDate(schedule: AgendaSchedule) {
  return parseAgendaDate(schedule.scheduleDate || schedule.attendanceDate);
}

function readScheduleRecurrenceStartDate(schedule: AgendaSchedule, fallback: Date) {
  return (
    parseAgendaDate(
      schedule.recurrenceStartDate ||
        (schedule as { startDate?: string | null }).startDate ||
        schedule.scheduleDate,
    ) || normalizeDate(fallback)
  );
}

function readScheduleRecurrenceEndDate(schedule: AgendaSchedule) {
  return parseAgendaDate(
    schedule.recurrenceEndDate || (schedule as { endDate?: string | null }).endDate,
  );
}

function readPositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeRecurrenceFrequency(value: unknown): AgendaRecurrenceFrequency | null {
  const normalized = normalizeText(value).toUpperCase();

  if (["DIARIA", "DAILY"].includes(normalized)) return "DAILY";
  if (["SEMANAL", "WEEKLY"].includes(normalized)) return "WEEKLY";
  if (["QUINZENAL", "BIWEEKLY", "BI_WEEKLY", "FORTNIGHTLY"].includes(normalized)) {
    return "BIWEEKLY";
  }
  if (["MENSAL", "MONTHLY"].includes(normalized)) return "MONTHLY";
  if (["PERSONALIZADA", "CUSTOM"].includes(normalized)) return "CUSTOM";

  return null;
}

function readScheduleRecurrenceFrequency(schedule: AgendaSchedule) {
  return (
    normalizeRecurrenceFrequency(
      schedule.recurrenceFrequency || schedule.recurrenceType || schedule.recurrence,
    ) || (readScheduleWeekdayIndexes(schedule).length > 0 ? "WEEKLY" : null)
  );
}

function readScheduleIntervalValue(schedule: AgendaSchedule, frequency: AgendaRecurrenceFrequency) {
  const value =
    readPositiveInteger(schedule.recurrenceIntervalValue) ||
    readPositiveInteger((schedule as { intervalValue?: number | null }).intervalValue);

  if (frequency === "BIWEEKLY") return 2;
  return value || 1;
}

function readScheduleIntervalUnit(
  schedule: AgendaSchedule,
  frequency: AgendaRecurrenceFrequency,
): AgendaRecurrenceIntervalUnit {
  const normalized = normalizeText(
    schedule.recurrenceIntervalUnit || (schedule as { intervalUnit?: string | null }).intervalUnit,
  ).toUpperCase();

  if (["DAY", "DAYS", "DIA", "DIAS"].includes(normalized)) return "DAY";
  if (["MONTH", "MONTHS", "MES", "MESES"].includes(normalized)) return "MONTH";
  if (["WEEK", "WEEKS", "SEMANA", "SEMANAS"].includes(normalized)) return "WEEK";
  if (frequency === "DAILY") return "DAY";
  if (frequency === "MONTHLY") return "MONTH";
  return "WEEK";
}

function daysBetween(start: Date, end: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor(
    (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      msPerDay,
  );
}

function monthsBetween(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function clampDayOfMonth(year: number, month: number, day: number) {
  return Math.min(day, new Date(year, month + 1, 0).getDate());
}

function recurrenceDateMatches(
  schedule: AgendaSchedule,
  date: Date,
  startDate: Date,
  frequency: AgendaRecurrenceFrequency,
) {
  const intervalValue = readScheduleIntervalValue(schedule, frequency);
  const intervalUnit = readScheduleIntervalUnit(schedule, frequency);
  const daysDiff = daysBetween(startDate, date);
  const weekdays = readScheduleWeekdayIndexes(schedule);

  if (date < startDate) return false;

  if (frequency === "DAILY") {
    return daysDiff % intervalValue === 0;
  }

  if (frequency === "WEEKLY" || frequency === "BIWEEKLY") {
    const interval = frequency === "BIWEEKLY" ? 2 : intervalValue;
    const weekDiff = Math.floor(
      daysBetween(startOfRecurrenceWeek(startDate), startOfRecurrenceWeek(date)) / 7,
    );
    const activeWeekdays = weekdays.length > 0 ? weekdays : [startDate.getDay()];

    return weekDiff % interval === 0 && activeWeekdays.includes(date.getDay());
  }

  if (frequency === "MONTHLY") {
    const monthDiff = monthsBetween(startDate, date);
    return (
      monthDiff % intervalValue === 0 &&
      date.getDate() === clampDayOfMonth(date.getFullYear(), date.getMonth(), startDate.getDate())
    );
  }

  if (frequency === "CUSTOM") {
    if (intervalUnit === "MONTH") {
      const monthDiff = monthsBetween(startDate, date);
      return (
        monthDiff % intervalValue === 0 &&
        date.getDate() ===
          clampDayOfMonth(date.getFullYear(), date.getMonth(), startDate.getDate())
      );
    }

    if (intervalUnit === "WEEK") {
      const weekDiff = Math.floor(
        daysBetween(startOfRecurrenceWeek(startDate), startOfRecurrenceWeek(date)) / 7,
      );
      const activeWeekdays = weekdays.length > 0 ? weekdays : [startDate.getDay()];

      return weekDiff % intervalValue === 0 && activeWeekdays.includes(date.getDay());
    }

    return daysDiff % intervalValue === 0;
  }

  return false;
}

function readScheduleTitle(schedule: AgendaSchedule) {
  return (
    normalizeText(schedule.className) ||
    normalizeText(schedule.turmaName) ||
    (schedule.classId ? `Turma ${schedule.classId}` : "Agenda")
  );
}

function readScheduleSubtitle(schedule: AgendaSchedule) {
  return [
    schedule.modality ? normalizeText(schedule.modality) : null,
    schedule.unitName ? normalizeText(schedule.unitName) : null,
    schedule.professorName ? normalizeText(schedule.professorName) : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function readScheduleTimeLabel(schedule: AgendaSchedule) {
  if (schedule.startTime && schedule.endTime) {
    return `${schedule.startTime} - ${schedule.endTime}`;
  }

  return schedule.startTime || "Horario a definir";
}

function createEvent(
  schedule: AgendaSchedule,
  date: Date,
  index: number,
  isRecurringProjection: boolean,
): AgendaCalendarEvent {
  const dateKey = formatAgendaDateKey(date);
  const todayKey = formatAgendaDateKey(new Date());
  const id = [
    schedule.id || schedule.agendaItemId || schedule.enrollmentId || "schedule",
    schedule.classId || "class",
    dateKey,
    schedule.startTime || "time",
    index,
  ].join(":");

  return {
    date,
    dateKey,
    exceptionType: schedule.recurrenceExceptionType || null,
    id,
    isException: Boolean(schedule.recurrenceExceptionType),
    isPast: dateKey < todayKey,
    isRecurringProjection,
    isToday: dateKey === todayKey,
    recurrenceOccurrenceKey: schedule.recurrenceOccurrenceKey || null,
    recurrenceSeriesId: schedule.recurrenceSeriesId || null,
    schedule,
    subtitle: readScheduleSubtitle(schedule),
    timeLabel: readScheduleTimeLabel(schedule),
    title: readScheduleTitle(schedule) || buildAgendaScheduleLabel(schedule),
  };
}

export function buildAgendaCalendarEvents(
  schedules: AgendaSchedule[],
  period: AgendaCalendarPeriod,
): AgendaCalendarEvent[] {
  const periodDays = eachDay(period.startDate, period.endDate);
  const startKey = formatAgendaDateKey(period.startDate);
  const endKey = formatAgendaDateKey(period.endDate);

  return schedules
    .flatMap((schedule, scheduleIndex) => {
      const concreteDate = readConcreteScheduleDate(schedule);
      const recurrenceFrequency = readScheduleRecurrenceFrequency(schedule);

      if (concreteDate && !recurrenceFrequency) {
        const concreteKey = formatAgendaDateKey(concreteDate);

        if (concreteKey < startKey || concreteKey > endKey) {
          return [];
        }

        return [createEvent(schedule, concreteDate, scheduleIndex, false)];
      }

      if (recurrenceFrequency) {
        const recurrenceStart = readScheduleRecurrenceStartDate(
          schedule,
          concreteDate || period.startDate,
        );
        const recurrenceEnd = readScheduleRecurrenceEndDate(schedule);
        const maxOccurrences =
          readPositiveInteger(schedule.recurrenceMaxOccurrences) ||
          readPositiveInteger((schedule as { maxOccurrences?: number | null }).maxOccurrences);
        const generationEnd = recurrenceEnd && recurrenceEnd < period.endDate
          ? recurrenceEnd
          : period.endDate;
        const generationDays = eachDay(recurrenceStart, addYears(generationEnd, 0));
        const events: AgendaCalendarEvent[] = [];
        let occurrenceCount = 0;

        for (const day of generationDays) {
          if (!recurrenceDateMatches(schedule, day, recurrenceStart, recurrenceFrequency)) {
            continue;
          }

          occurrenceCount += 1;

          if (maxOccurrences && occurrenceCount > maxOccurrences) {
            break;
          }

          const dateKey = formatAgendaDateKey(day);

          if (dateKey < startKey || dateKey > endKey) {
            continue;
          }

          events.push(createEvent(schedule, day, scheduleIndex + occurrenceCount, true));
        }

        return events;
      }

      const weekdays = readScheduleWeekdayIndexes(schedule);

      if (weekdays.length === 0) {
        return period.view === "day"
          ? [createEvent(schedule, period.startDate, scheduleIndex, true)]
          : [];
      }

      return periodDays
        .filter((day) => weekdays.includes(day.getDay()))
        .map((day, dayIndex) => createEvent(schedule, day, scheduleIndex + dayIndex, true));
    })
    .sort((left, right) => {
      const dateDiff = left.dateKey.localeCompare(right.dateKey);

      if (dateDiff !== 0) return dateDiff;

      const timeDiff = left.timeLabel.localeCompare(right.timeLabel);

      if (timeDiff !== 0) return timeDiff;

      return left.title.localeCompare(right.title);
    });
}

export function groupAgendaEventsByDate(events: AgendaCalendarEvent[]) {
  return events.reduce<Record<string, AgendaCalendarEvent[]>>((groups, event) => {
    groups[event.dateKey] = [...(groups[event.dateKey] || []), event];
    return groups;
  }, {});
}

export function useAgendaCalendar({ schedules, selectedDate, view }: AgendaCalendarInput) {
  return useMemo(() => {
    const period = getAgendaCalendarPeriod(view, selectedDate);
    const days = getAgendaCalendarGridDays(period);
    const events = buildAgendaCalendarEvents(schedules, period);

    return {
      days,
      events,
      eventsByDate: groupAgendaEventsByDate(events),
      period,
      weekdayLabels: WEEKDAY_LABELS,
    };
  }, [schedules, selectedDate, view]);
}
