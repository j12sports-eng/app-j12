import { AlertTriangle, CalendarClock, Loader2 } from "lucide-react";

import { SkeletonCard } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { ClassScheduleCard } from "./ClassScheduleCard";

import type { AgendaSchedule } from "../types/agenda.types";

type AgendaTimelineProps = {
  className?: string;
  emptyMessage?: string;
  errorMessage?: string | null;
  loading?: boolean;
  onPrepareAttendance?: (schedule: AgendaSchedule) => void;
  schedules: AgendaSchedule[];
};

export function AgendaTimeline({
  className,
  emptyMessage = "Nenhum horario encontrado para este filtro.",
  errorMessage,
  loading = false,
  onPrepareAttendance,
  schedules,
}: AgendaTimelineProps) {
  if (loading) {
    return (
      <section
        aria-busy="true"
        className={cn("grid gap-3", className)}
        data-agenda-timeline-rendered="true"
      >
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Carregando agenda administrativa
        </div>
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className={cn("rounded-2xl border border-red-400/25 bg-red-500/10 p-4", className)}>
        <div className="flex items-start gap-3 text-red-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-200" />
          <div>
            <p className="font-bold text-white">Erro ao carregar agenda.</p>
            <p className="mt-1 text-sm leading-6">{errorMessage}</p>
          </div>
        </div>
      </section>
    );
  }

  if (schedules.length === 0) {
    return (
      <section
        className={cn("j12-empty-state p-8 text-center", className)}
        data-agenda-timeline-rendered="true"
      >
        <CalendarClock className="mx-auto h-10 w-10 text-primary" />
        <p className="mt-4 font-bold text-white">Sem horarios.</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className={cn("grid gap-3", className)} data-agenda-timeline-rendered="true">
      {schedules.map((schedule, index) => (
        <ClassScheduleCard
          key={schedule.id || schedule.agendaItemId || `${schedule.classId || "class"}-${index}`}
          onPrepareAttendance={onPrepareAttendance}
          schedule={schedule}
        />
      ))}
    </section>
  );
}
