import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  RotateCcw,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { AgendaAttendanceStatus, AgendaSchedule } from "../types/agenda.types";

type AttendanceBadgeProps = {
  className?: string;
  schedule?: AgendaSchedule | null;
  status?: AgendaAttendanceStatus | string | null;
};

function normalizeAttendanceStatus(
  status?: AgendaAttendanceStatus | string | null,
  schedule?: AgendaSchedule | null,
): AgendaAttendanceStatus {
  if (schedule?.present === true) {
    return "PRESENT";
  }

  if (schedule?.present === false) {
    return "ABSENT";
  }

  const normalized = String(status || schedule?.attendanceStatus || "")
    .trim()
    .toUpperCase();

  if (["PRESENT", "PRESENTE", "PRESENCA", "PRESENCE"].includes(normalized)) {
    return "PRESENT";
  }

  if (["ABSENT", "FALTA", "AUSENTE", "MISSING"].includes(normalized)) {
    return "ABSENT";
  }

  if (["JUSTIFIED", "JUSTIFICADA", "JUSTIFICADO", "ATESTADO"].includes(normalized)) {
    return "JUSTIFIED";
  }

  if (["LATE", "ATRASO", "ATRASADO"].includes(normalized)) {
    return "LATE";
  }

  if (["REPLACEMENT", "REPOSICAO"].includes(normalized)) {
    return "REPLACEMENT";
  }

  if (["PENDING", "PENDENTE"].includes(normalized)) {
    return "PENDING";
  }

  return schedule?.attendanceRegisteredAt ? "PENDING" : "NOT_REGISTERED";
}

export function AttendanceBadge({ className, schedule, status }: AttendanceBadgeProps) {
  const normalized = normalizeAttendanceStatus(status, schedule);
  const config = {
    ABSENT: {
      Icon: XCircle,
      label: "Ausencia",
      style: "border-red-400/20 bg-red-500/10 text-red-100",
    },
    JUSTIFIED: {
      Icon: AlertTriangle,
      label: "Justificada",
      style: "border-amber-400/20 bg-amber-500/10 text-amber-100",
    },
    LATE: {
      Icon: Clock3,
      label: "Atraso",
      style: "border-amber-400/20 bg-amber-500/10 text-amber-100",
    },
    NOT_REGISTERED: {
      Icon: CircleDashed,
      label: "Sem presenca",
      style: "border-white/10 bg-white/5 text-slate-300",
    },
    PENDING: {
      Icon: CircleDashed,
      label: "Pendente",
      style: "border-sky-400/20 bg-sky-500/10 text-sky-100",
    },
    PRESENT: {
      Icon: CheckCircle2,
      label: "Presenca registrada",
      style: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    },
    REPLACEMENT: {
      Icon: RotateCcw,
      label: "Reposicao",
      style: "border-primary/25 bg-primary/10 text-primary",
    },
    UNKNOWN: {
      Icon: CircleDashed,
      label: "Indefinido",
      style: "border-white/10 bg-white/5 text-slate-300",
    },
  }[normalized];
  const Icon = config.Icon;

  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold",
        config.style,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}
