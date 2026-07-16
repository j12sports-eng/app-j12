import type { LucideIcon } from "lucide-react";

import { MetricLabel, MetricValue, TrendIndicator } from "../shared";
import type {
  CommandCenterTone,
  CommandCenterTrend,
} from "@/features/command-center/types/command-center.types";
import { cn } from "@/lib/utils";

export function KPITrendCard({
  description,
  icon: Icon,
  label,
  tone = "primary",
  trend,
  trendLabel,
  value,
}: {
  description?: string;
  icon: LucideIcon;
  label: string;
  tone?: CommandCenterTone;
  trend: CommandCenterTrend;
  trendLabel: string;
  value: string;
}) {
  return (
    <article className="j12-kpi-card min-h-[168px] p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <MetricLabel>{label}</MetricLabel>
          <div className="mt-3">
            <MetricValue>{value}</MetricValue>
          </div>
          {description ? <p className="mt-2 text-sm text-slate-400">{description}</p> : null}
        </div>
        <div
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-2xl border",
            toneClass(tone),
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-4">
        <TrendIndicator label={trendLabel} trend={trend} />
      </div>
    </article>
  );
}

function toneClass(tone: CommandCenterTone) {
  return {
    danger: "border-red-400/20 bg-red-500/10 text-red-200",
    info: "border-sky-400/20 bg-sky-500/10 text-sky-200",
    primary: "border-primary/25 bg-primary/10 text-primary",
    success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-400/20 bg-amber-500/10 text-amber-200",
  }[tone];
}
