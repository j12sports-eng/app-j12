import {
  CalendarDays,
  Clock3,
  ClipboardCheck,
  GraduationCap,
  MapPin,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { memo } from "react";

import { cn } from "@/lib/utils";

import { buildAgendaScheduleLabel } from "../hooks/useAttendance";
import { AttendanceBadge } from "./AttendanceBadge";

import type { AgendaSchedule } from "../types/agenda.types";

type ClassScheduleCardProps = {
  disabled?: boolean;
  onPrepareAttendance?: (schedule: AgendaSchedule) => void;
  schedule: AgendaSchedule;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeUpper(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function formatDays(schedule: AgendaSchedule) {
  const days = Array.isArray(schedule.daysOfWeek)
    ? schedule.daysOfWeek
    : schedule.dayOfWeek
      ? [schedule.dayOfWeek]
      : [];

  if (!days.length) {
    return "Dias nao informados";
  }

  return days
    .map((day) => normalizeText(day))
    .filter(Boolean)
    .join(", ");
}

function readClassName(schedule: AgendaSchedule) {
  return (
    normalizeText(schedule.className) ||
    normalizeText(schedule.turmaName) ||
    (schedule.classId ? `Turma ${schedule.classId}` : "Turma sem nome")
  );
}

function readScheduleStatus(schedule: AgendaSchedule) {
  return normalizeUpper(schedule.scheduleStatus || schedule.status || "ACTIVE");
}

function isInactiveClass(schedule: AgendaSchedule) {
  const status = normalizeUpper(schedule.classStatus || schedule.status || schedule.scheduleStatus);

  return ["INACTIVE", "INATIVA", "INATIVO", "CANCELLED", "CANCELADA", "CANCELADO"].includes(status);
}

function hasAttendance(schedule: AgendaSchedule) {
  const status = normalizeUpper(schedule.attendanceStatus);

  return Boolean(
    schedule.present === true ||
    schedule.present === false ||
    schedule.attendanceRegisteredAt ||
    ["PRESENT", "PRESENTE", "ABSENT", "FALTA", "JUSTIFIED", "JUSTIFICADA"].includes(status),
  );
}

function statusStyle(schedule: AgendaSchedule) {
  if (isInactiveClass(schedule)) {
    return "border-slate-500/20 bg-slate-500/10 text-slate-200";
  }

  const status = readScheduleStatus(schedule);

  if (["CANCELLED", "CANCELADA", "CANCELADO"].includes(status)) {
    return "border-red-400/20 bg-red-500/10 text-red-100";
  }

  if (["COMPLETED", "CONCLUIDA", "CONCLUIDO"].includes(status)) {
    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
  }

  return "border-primary/25 bg-primary/10 text-primary";
}

export const ClassScheduleCard = memo(function ClassScheduleCard({
  disabled = false,
  onPrepareAttendance,
  schedule,
}: ClassScheduleCardProps) {
  const inactive = isInactiveClass(schedule);
  const attendanceRegistered = hasAttendance(schedule);
  const canPrepareAttendance = Boolean(onPrepareAttendance && !disabled && !inactive);
  const className = readClassName(schedule);
  const actionDisabled = !canPrepareAttendance || attendanceRegistered;

  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-bold",
                statusStyle(schedule),
              )}
            >
              {inactive ? "Turma inativa" : readScheduleStatus(schedule)}
            </span>
            <AttendanceBadge schedule={schedule} />
          </div>

          <h3 className="mt-3 text-lg font-black text-white">{className}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            {buildAgendaScheduleLabel(schedule)}
          </p>
        </div>

        <button
          type="button"
          disabled={actionDisabled}
          onClick={() => onPrepareAttendance?.(schedule)}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition",
            actionDisabled
              ? "border border-white/10 bg-white/5 text-slate-500"
              : "bg-primary text-primary-foreground hover:brightness-110",
            "disabled:cursor-not-allowed disabled:opacity-70",
          )}
        >
          <ClipboardCheck className="h-4 w-4" />
          Preparar chamada
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoPill icon={CalendarDays} label="Dias" value={formatDays(schedule)} />
        <InfoPill
          icon={Clock3}
          label="Horario"
          value={
            schedule.startTime
              ? `${schedule.startTime}${schedule.endTime ? ` - ${schedule.endTime}` : ""}`
              : "Horario nao informado"
          }
        />
        <InfoPill
          icon={GraduationCap}
          label="Modalidade"
          value={schedule.modality || "Modalidade nao informada"}
        />
        <InfoPill
          icon={MapPin}
          label="Unidade"
          value={schedule.unitName || "Unidade nao informada"}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <InfoPill
          icon={UserRound}
          label="Professor"
          value={schedule.professorName || "Professor nao informado"}
        />
        <InfoPill
          icon={ShieldAlert}
          label="Origem"
          value={schedule.agendaSource || schedule.source || "API administrativa da Agenda"}
        />
      </div>
    </article>
  );
});

ClassScheduleCard.displayName = "ClassScheduleCard";

function InfoPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex min-h-16 items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-200">
          {normalizeText(value) || "-"}
        </p>
      </div>
    </div>
  );
}
