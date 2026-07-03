import { useState, type DragEvent } from "react";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GripVertical,
  Loader2,
  Pencil,
  RefreshCcw,
  Rows3,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  formatAgendaDateKey,
  navigateAgendaCalendarDate,
  parseAgendaDate,
  useAgendaCalendar,
} from "../hooks/useAgendaCalendar";
import { AttendanceBadge } from "./AttendanceBadge";
import { ClassScheduleCard } from "./ClassScheduleCard";

import type {
  AgendaCalendarEvent,
  AgendaCalendarView,
  AgendaSchedule,
} from "../types/agenda.types";

type AgendaCalendarProps = {
  conflictEventIds?: string[];
  dragDropEnabled?: boolean;
  errorMessage?: string | null;
  loading?: boolean;
  onDateChange: (date: Date) => void;
  onEventDrop?: (event: AgendaCalendarEvent, target: AgendaCalendarDropTarget) => void;
  onEventRescheduleRequest?: (event: AgendaCalendarEvent) => void;
  onPrepareAttendance?: (schedule: AgendaSchedule) => void;
  onViewChange: (view: AgendaCalendarView) => void;
  reschedulingEventId?: string | null;
  schedules: AgendaSchedule[];
  selectedDate: Date;
  view: AgendaCalendarView;
};

export type AgendaCalendarDropTarget = {
  date: Date;
  startTime?: string | null;
};

type AgendaCalendarInteractions = {
  conflictEventIds: Set<string>;
  dragDropEnabled: boolean;
  draggingEventId: string | null;
  dropTargetDateKey: string | null;
  onEventDragEnd: () => void;
  onEventDragLeaveDate: (date: Date) => void;
  onEventDragOverDate: (nativeEvent: DragEvent<HTMLElement>, date: Date) => void;
  onEventDragStart: (nativeEvent: DragEvent<HTMLElement>, event: AgendaCalendarEvent) => void;
  onEventDropToDate: (nativeEvent: DragEvent<HTMLElement>, date: Date) => void;
  onEventRescheduleRequest?: (event: AgendaCalendarEvent) => void;
  reschedulingEventId?: string | null;
};

const VIEW_OPTIONS: Array<{
  icon: LucideIcon;
  label: string;
  view: AgendaCalendarView;
}> = [
  { icon: CalendarDays, label: "Dia", view: "day" },
  { icon: Rows3, label: "Semana", view: "week" },
  { icon: CalendarClock, label: "Mes", view: "month" },
];

const DAY_NUMBER_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
});
const MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function sameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function readDayEvents(eventsByDate: Record<string, AgendaCalendarEvent[]>, date: Date) {
  return eventsByDate[formatAgendaDateKey(date)] || [];
}

function readEventTone(event: AgendaCalendarEvent) {
  if (event.isException) {
    return "border-amber-400/35 bg-amber-500/12 text-amber-100";
  }

  const status = normalizeText(
    event.schedule.classStatus || event.schedule.scheduleStatus || event.schedule.status,
  ).toUpperCase();

  if (["INACTIVE", "INATIVA", "INATIVO", "CANCELLED", "CANCELADA", "CANCELADO"].includes(status)) {
    return "border-slate-500/25 bg-slate-500/10 text-slate-200";
  }

  if (event.isToday) {
    return "border-primary/50 bg-primary/15 text-white shadow-[0_0_0_1px_rgba(255,69,0,0.2)]";
  }

  if (
    event.schedule.present === false ||
    normalizeText(event.schedule.attendanceStatus).toUpperCase() === "ABSENT"
  ) {
    return "border-red-400/25 bg-red-500/10 text-red-100";
  }

  if (event.schedule.present === true || event.schedule.attendanceRegisteredAt) {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
  }

  return "border-white/10 bg-white/[0.06] text-slate-200";
}

function isDropTarget(interactions: AgendaCalendarInteractions, date: Date) {
  return (
    interactions.dragDropEnabled &&
    interactions.draggingEventId &&
    interactions.dropTargetDateKey === formatAgendaDateKey(date)
  );
}

function readDropTargetTone(interactions: AgendaCalendarInteractions, date: Date) {
  if (!interactions.dragDropEnabled || !interactions.draggingEventId) {
    return "";
  }

  return isDropTarget(interactions, date)
    ? "border-primary/55 bg-primary/15 shadow-[0_0_0_1px_rgba(255,69,0,0.24)]"
    : "border-dashed border-white/15";
}

function isConflictEvent(event: AgendaCalendarEvent, interactions: AgendaCalendarInteractions) {
  return [event.id, event.schedule.id, event.schedule.agendaItemId]
    .filter(Boolean)
    .some((id) => interactions.conflictEventIds.has(String(id)));
}

export function AgendaCalendar({
  conflictEventIds = [],
  dragDropEnabled = false,
  errorMessage,
  loading = false,
  onDateChange,
  onEventDrop,
  onEventRescheduleRequest,
  onPrepareAttendance,
  onViewChange,
  reschedulingEventId,
  schedules,
  selectedDate,
  view,
}: AgendaCalendarProps) {
  const [draggingEvent, setDraggingEvent] = useState<AgendaCalendarEvent | null>(null);
  const [dropTargetDateKey, setDropTargetDateKey] = useState<string | null>(null);
  const calendar = useAgendaCalendar({ schedules, selectedDate, view });
  const selectedDateKey = formatAgendaDateKey(selectedDate);
  const selectedDayEvents = calendar.eventsByDate[selectedDateKey] || [];
  const calendarDragEnabled = Boolean(dragDropEnabled && onEventDrop);

  function handleDateInputChange(value: string) {
    const parsed = parseAgendaDate(value);

    if (parsed) {
      onDateChange(parsed);
    }
  }

  function resetDragState() {
    setDraggingEvent(null);
    setDropTargetDateKey(null);
  }

  function handleEventDragStart(nativeEvent: DragEvent<HTMLElement>, event: AgendaCalendarEvent) {
    if (!calendarDragEnabled) {
      nativeEvent.preventDefault();
      return;
    }

    setDraggingEvent(event);
    setDropTargetDateKey(null);
    nativeEvent.dataTransfer.effectAllowed = "move";
    nativeEvent.dataTransfer.setData("text/plain", event.id);
  }

  function handleEventDragOverDate(nativeEvent: DragEvent<HTMLElement>, date: Date) {
    if (!calendarDragEnabled || !draggingEvent) {
      return;
    }

    nativeEvent.preventDefault();
    nativeEvent.dataTransfer.dropEffect = "move";
    setDropTargetDateKey(formatAgendaDateKey(date));
  }

  function handleEventDragLeaveDate(date: Date) {
    const dateKey = formatAgendaDateKey(date);
    setDropTargetDateKey((current) => (current === dateKey ? null : current));
  }

  function handleEventDropToDate(nativeEvent: DragEvent<HTMLElement>, date: Date) {
    if (!calendarDragEnabled || !draggingEvent || !onEventDrop) {
      return;
    }

    nativeEvent.preventDefault();
    onEventDrop(draggingEvent, {
      date,
      startTime: draggingEvent.schedule.startTime || null,
    });
    resetDragState();
  }

  const interactions: AgendaCalendarInteractions = {
    conflictEventIds: new Set(conflictEventIds.map(String)),
    dragDropEnabled: calendarDragEnabled,
    draggingEventId: draggingEvent?.id || null,
    dropTargetDateKey,
    onEventDragEnd: resetDragState,
    onEventDragLeaveDate: handleEventDragLeaveDate,
    onEventDragOverDate: handleEventDragOverDate,
    onEventDragStart: handleEventDragStart,
    onEventDropToDate: handleEventDropToDate,
    onEventRescheduleRequest,
    reschedulingEventId,
  };

  return (
    <section
      className="j12-surface overflow-hidden p-4 md:p-5"
      data-agenda-calendar-rendered="true"
      data-agenda-drag-drop-enabled={calendarDragEnabled ? "true" : "false"}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            <CalendarClock className="h-3.5 w-3.5" />
            Calendario da Agenda
          </div>
          <h2 className="mt-3 text-2xl font-black text-white">{calendar.period.label}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            {calendar.events.length} evento(s) no periodo selecionado.
          </p>
          {calendarDragEnabled && (
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Reagendamento ativo para eventos sem presenca registrada.
            </p>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-[auto_auto] xl:min-w-[560px]">
          <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-black/25 p-1">
            {VIEW_OPTIONS.map((option) => {
              const active = view === option.view;
              const Icon = option.icon;

              return (
                <button
                  key={option.view}
                  type="button"
                  onClick={() => onViewChange(option.view)}
                  className={cn(
                    "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-slate-300 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-[auto_1fr_auto] gap-2">
            <button
              type="button"
              onClick={() => onDateChange(navigateAgendaCalendarDate(selectedDate, view, -1))}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
              aria-label="Periodo anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={selectedDateKey}
              onChange={(event) => handleDateInputChange(event.target.value)}
              className="j12-field h-11 min-w-0 px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => onDateChange(navigateAgendaCalendarDate(selectedDate, view, 1))}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
              aria-label="Proximo periodo"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onDateChange(new Date())}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10 sm:col-span-2 xl:col-span-1"
          >
            <RefreshCcw className="h-4 w-4" />
            Hoje
          </button>
        </div>
      </div>

      {loading && (
        <div className="mt-5 flex min-h-32 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-slate-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
          Carregando calendario
        </div>
      )}

      {!loading && errorMessage && (
        <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {errorMessage}
        </div>
      )}

      {!loading && !errorMessage && view === "day" && (
        <DayCalendar
          events={selectedDayEvents}
          interactions={interactions}
          onPrepareAttendance={onPrepareAttendance}
          selectedDate={selectedDate}
        />
      )}

      {!loading && !errorMessage && view === "week" && (
        <WeekCalendar
          days={calendar.days}
          eventsByDate={calendar.eventsByDate}
          interactions={interactions}
          onPrepareAttendance={onPrepareAttendance}
        />
      )}

      {!loading && !errorMessage && view === "month" && (
        <MonthCalendar
          days={calendar.days}
          eventsByDate={calendar.eventsByDate}
          interactions={interactions}
          onDateChange={onDateChange}
          referenceDate={selectedDate}
          weekdayLabels={calendar.weekdayLabels}
        />
      )}
    </section>
  );
}

function DayCalendar({
  events,
  interactions,
  onPrepareAttendance,
  selectedDate,
}: {
  events: AgendaCalendarEvent[];
  interactions: AgendaCalendarInteractions;
  onPrepareAttendance?: (schedule: AgendaSchedule) => void;
  selectedDate: Date;
}) {
  return (
    <div
      className={cn(
        "mt-5 rounded-2xl border border-transparent p-1 transition",
        readDropTargetTone(interactions, selectedDate),
      )}
      onDragLeave={() => interactions.onEventDragLeaveDate(selectedDate)}
      onDragOver={(event) => interactions.onEventDragOverDate(event, selectedDate)}
      onDrop={(event) => interactions.onEventDropToDate(event, selectedDate)}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-white">{MONTH_DAY_FORMATTER.format(selectedDate)}</p>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">
          {events.length} evento(s)
        </span>
      </div>

      {events.length === 0 ? (
        <EmptyCalendarMessage message="Nenhum evento da Agenda para este dia." />
      ) : (
        <div className="grid gap-3">
          {events.map((event) => (
            <DraggableEventShell key={event.id} event={event} interactions={interactions}>
              <ClassScheduleCard
                onPrepareAttendance={onPrepareAttendance}
                schedule={event.schedule}
              />
            </DraggableEventShell>
          ))}
        </div>
      )}
    </div>
  );
}

function WeekCalendar({
  days,
  eventsByDate,
  interactions,
  onPrepareAttendance,
}: {
  days: Date[];
  eventsByDate: Record<string, AgendaCalendarEvent[]>;
  interactions: AgendaCalendarInteractions;
  onPrepareAttendance?: (schedule: AgendaSchedule) => void;
}) {
  return (
    <div className="mt-5 grid gap-3 lg:grid-cols-7">
      {days.map((day) => {
        const events = readDayEvents(eventsByDate, day);
        const today = formatAgendaDateKey(day) === formatAgendaDateKey(new Date());

        return (
          <div
            key={formatAgendaDateKey(day)}
            className={cn(
              "min-h-48 rounded-2xl border p-3",
              today ? "border-primary/40 bg-primary/10" : "border-white/10 bg-black/20",
              readDropTargetTone(interactions, day),
            )}
            onDragLeave={() => interactions.onEventDragLeaveDate(day)}
            onDragOver={(event) => interactions.onEventDragOverDate(event, day)}
            onDrop={(event) => interactions.onEventDropToDate(event, day)}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  {day.toLocaleDateString("pt-BR", { weekday: "short" })}
                </p>
                <p className="mt-1 text-lg font-black text-white">
                  {DAY_NUMBER_FORMATTER.format(day)}
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-slate-300">
                {events.length}
              </span>
            </div>

            <div className="grid gap-2">
              {events.length === 0 ? (
                <p className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-500">
                  Sem eventos
                </p>
              ) : (
                events.map((event) => (
                  <CompactCalendarEvent
                    key={event.id}
                    event={event}
                    interactions={interactions}
                    onPrepareAttendance={onPrepareAttendance}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthCalendar({
  days,
  eventsByDate,
  interactions,
  onDateChange,
  referenceDate,
  weekdayLabels,
}: {
  days: Date[];
  eventsByDate: Record<string, AgendaCalendarEvent[]>;
  interactions: AgendaCalendarInteractions;
  onDateChange: (date: Date) => void;
  referenceDate: Date;
  weekdayLabels: readonly string[];
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 hidden grid-cols-7 gap-2 lg:grid">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-500"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day) => {
          const dateKey = formatAgendaDateKey(day);
          const events = eventsByDate[dateKey] || [];
          const today = dateKey === formatAgendaDateKey(new Date());
          const inCurrentMonth = sameMonth(day, referenceDate);

          return (
            <div
              key={dateKey}
              className={cn(
                "min-h-32 rounded-2xl border p-3 text-left transition hover:border-primary/40 hover:bg-primary/10",
                today ? "border-primary/45 bg-primary/10" : "border-white/10 bg-black/20",
                !inCurrentMonth && "opacity-45",
                readDropTargetTone(interactions, day),
              )}
              onDragLeave={() => interactions.onEventDragLeaveDate(day)}
              onDragOver={(event) => interactions.onEventDragOverDate(event, day)}
              onDrop={(event) => interactions.onEventDropToDate(event, day)}
            >
              <button
                type="button"
                onClick={() => onDateChange(day)}
                className="mb-3 flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="text-sm font-black text-white">
                  {DAY_NUMBER_FORMATTER.format(day)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                  {events.length}
                </span>
              </button>

              <div className="grid gap-1.5">
                {events.slice(0, 3).map((event) => (
                  <MonthCalendarEventChip
                    key={event.id}
                    event={event}
                    interactions={interactions}
                  />
                ))}
                {events.length > 3 && (
                  <span className="text-xs font-bold text-primary">
                    +{events.length - 3} evento(s)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompactCalendarEvent({
  event,
  interactions,
  onPrepareAttendance,
}: {
  event: AgendaCalendarEvent;
  interactions: AgendaCalendarInteractions;
  onPrepareAttendance?: (schedule: AgendaSchedule) => void;
}) {
  return (
    <div
      aria-grabbed={interactions.draggingEventId === event.id}
      className={cn(
        "rounded-2xl border p-3 transition",
        interactions.dragDropEnabled && "cursor-grab active:cursor-grabbing",
        interactions.draggingEventId === event.id && "opacity-60",
        interactions.reschedulingEventId === event.id && "pointer-events-none opacity-70",
        readEventTone(event),
        isConflictEvent(event, interactions) &&
          "border-red-400/60 bg-red-500/15 shadow-[0_0_0_1px_rgba(248,113,113,0.35)]",
      )}
      draggable={interactions.dragDropEnabled && interactions.reschedulingEventId !== event.id}
      onDragEnd={interactions.onEventDragEnd}
      onDragStart={(nativeEvent) => interactions.onEventDragStart(nativeEvent, event)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{event.title}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-300">
            <Clock3 className="h-3.5 w-3.5 text-primary" />
            {event.timeLabel}
          </p>
        </div>
        <AttendanceBadge schedule={event.schedule} />
      </div>

      {event.subtitle && <p className="mt-2 truncate text-xs text-slate-400">{event.subtitle}</p>}

      {event.isRecurringProjection && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
            Recorrente
          </span>
          {event.isException && (
            <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-amber-100">
              Excecao
            </span>
          )}
        </div>
      )}

      {onPrepareAttendance && (
        <button
          type="button"
          onClick={() => onPrepareAttendance(event.schedule)}
          className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
        >
          Preparar chamada
        </button>
      )}

      <EventActionBar event={event} interactions={interactions} />
    </div>
  );
}

function MonthCalendarEventChip({
  event,
  interactions,
}: {
  event: AgendaCalendarEvent;
  interactions: AgendaCalendarInteractions;
}) {
  const canRequestReschedule = Boolean(interactions.onEventRescheduleRequest);

  return (
    <button
      type="button"
      aria-grabbed={interactions.draggingEventId === event.id}
      className={cn(
        "truncate rounded-lg border px-2 py-1 text-left text-[11px] font-bold transition",
        interactions.dragDropEnabled && "cursor-grab active:cursor-grabbing",
        interactions.draggingEventId === event.id && "opacity-60",
        interactions.reschedulingEventId === event.id && "pointer-events-none opacity-70",
        readEventTone(event),
        isConflictEvent(event, interactions) &&
          "border-red-400/60 bg-red-500/15 shadow-[0_0_0_1px_rgba(248,113,113,0.35)]",
      )}
      disabled={!canRequestReschedule || interactions.reschedulingEventId === event.id}
      draggable={interactions.dragDropEnabled && interactions.reschedulingEventId !== event.id}
      onClick={(nativeEvent) => {
        nativeEvent.stopPropagation();
        interactions.onEventRescheduleRequest?.(event);
      }}
      onDragEnd={interactions.onEventDragEnd}
      onDragStart={(nativeEvent) => interactions.onEventDragStart(nativeEvent, event)}
      title="Reagendar evento"
    >
      {event.isException ? "Excecao - " : ""}
      {event.timeLabel} {event.title}
    </button>
  );
}

function DraggableEventShell({
  children,
  event,
  interactions,
}: {
  children: React.ReactNode;
  event: AgendaCalendarEvent;
  interactions: AgendaCalendarInteractions;
}) {
  return (
    <div
      aria-grabbed={interactions.draggingEventId === event.id}
      className={cn(
        "rounded-2xl transition",
        interactions.dragDropEnabled && "cursor-grab active:cursor-grabbing",
        interactions.draggingEventId === event.id && "opacity-60",
        interactions.reschedulingEventId === event.id && "pointer-events-none opacity-70",
        isConflictEvent(event, interactions) &&
          "ring-2 ring-red-400/50 ring-offset-2 ring-offset-black",
      )}
      draggable={interactions.dragDropEnabled && interactions.reschedulingEventId !== event.id}
      onDragEnd={interactions.onEventDragEnd}
      onDragStart={(nativeEvent) => interactions.onEventDragStart(nativeEvent, event)}
    >
      {children}
      <EventActionBar event={event} interactions={interactions} />
    </div>
  );
}

function EventActionBar({
  event,
  interactions,
}: {
  event: AgendaCalendarEvent;
  interactions: AgendaCalendarInteractions;
}) {
  if (!interactions.dragDropEnabled && !interactions.onEventRescheduleRequest) {
    return null;
  }

  const saving = interactions.reschedulingEventId === event.id;

  return (
    <div className="mt-2 flex items-center justify-end gap-2">
      {interactions.dragDropEnabled && (
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-slate-300"
          title="Arrastar evento"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}

      {interactions.onEventRescheduleRequest && (
        <button
          type="button"
          onClick={() => interactions.onEventRescheduleRequest?.(event)}
          disabled={saving}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
          Reagendar
        </button>
      )}
    </div>
  );
}

function EmptyCalendarMessage({ message }: { message: string }) {
  return (
    <div className="j12-empty-state p-8 text-center">
      <CalendarClock className="mx-auto h-10 w-10 text-primary" />
      <p className="mt-4 font-bold text-white">Sem eventos.</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{message}</p>
    </div>
  );
}
