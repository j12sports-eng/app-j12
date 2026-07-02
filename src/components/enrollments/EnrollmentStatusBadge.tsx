import { AlertTriangle, CheckCircle2, Clock3, CircleMinus } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EnrollmentSummaryStatus } from "@/lib/enrollments-api";

const STATUS_META: Record<
  EnrollmentSummaryStatus,
  {
    icon: typeof CircleMinus;
    label: string;
    className: string;
  }
> = {
  ACTIVE: {
    icon: CheckCircle2,
    label: "Ativa",
    className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
  },
  CONFLICT: {
    icon: AlertTriangle,
    label: "Conflito",
    className: "border-red-400/25 bg-red-500/10 text-red-200",
  },
  DRAFT: {
    icon: Clock3,
    label: "Rascunho",
    className: "border-amber-400/25 bg-amber-500/10 text-amber-200",
  },
  NONE: {
    icon: CircleMinus,
    label: "Sem matricula",
    className: "border-slate-400/20 bg-slate-500/10 text-slate-300",
  },
};

type EnrollmentStatusBadgeProps = {
  className?: string;
  status: EnrollmentSummaryStatus;
};

export function EnrollmentStatusBadge({ className, status }: EnrollmentStatusBadgeProps) {
  const meta = STATUS_META[status] ?? STATUS_META.NONE;
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold",
        meta.className,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}
