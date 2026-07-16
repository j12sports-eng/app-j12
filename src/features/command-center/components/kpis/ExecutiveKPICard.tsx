import { ArrowUpRight } from "lucide-react";

import {
  WidgetError,
  WidgetSkeleton,
  WidgetUnavailable,
} from "@/features/command-center/components/states/WidgetStates";
import { WidgetStaleBadge } from "@/features/command-center/components/states/WidgetStatusBadges";
import type {
  CommandCenterKpiPresentation,
  CommandCenterMetric,
  CommandCenterTone,
} from "@/features/command-center/types/command-center.types";
import { cn } from "@/lib/utils";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

export function ExecutiveKPICard({
  description,
  icon: Icon,
  metric,
  state,
  tone = "primary",
}: CommandCenterKpiPresentation) {
  if (state?.status === "loading") {
    return <WidgetSkeleton className="min-h-[168px]" />;
  }

  if (state?.status === "error") {
    return (
      <WidgetError
        className="min-h-[168px]"
        description={state.errorMessage || undefined}
        onRetry={state.retry}
      />
    );
  }

  if (!metric.available || state?.status === "unavailable") {
    return (
      <WidgetUnavailable
        className="min-h-[168px]"
        description={metric.reason || undefined}
        title={metric.label}
      />
    );
  }

  return (
    <article className="j12-kpi-card min-h-[168px] p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            {metric.label}
          </p>
          <p className="mt-3 truncate text-2xl font-black text-white md:text-3xl">
            {formatMetric(metric)}
          </p>
          {description ? (
            <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-400">{description}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
            toneBox(tone),
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {metric.comparison?.available ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold",
              comparisonTone(metric.comparison.trend),
            )}
          >
            <ArrowUpRight
              className={cn("h-3.5 w-3.5", metric.comparison.trend === "negative" && "rotate-90")}
              aria-hidden="true"
            />
            {formatComparison(metric.comparison.percent)}
          </span>
        ) : null}
        {state?.isStale ? <WidgetStaleBadge /> : null}
      </div>
    </article>
  );
}

function formatMetric(metric: CommandCenterMetric) {
  const value = metric.value ?? 0;

  if (metric.unit === "currency") return currencyFormatter.format(value);
  if (metric.unit === "percentage") return `${numberFormatter.format(value)}%`;
  if (metric.unit === "hours") return `${numberFormatter.format(value)} h`;
  if (metric.unit === "days") return `${numberFormatter.format(value)} dias`;

  return numberFormatter.format(value);
}

function formatComparison(percent: number | null) {
  if (percent === null) return "Comparação indisponível";
  return `${percent >= 0 ? "+" : ""}${numberFormatter.format(percent)}%`;
}

function comparisonTone(trend: NonNullable<CommandCenterMetric["comparison"]>["trend"]) {
  if (trend === "negative") return "border-red-400/20 bg-red-500/10 text-red-200";
  if (trend === "positive") {
    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  }
  return "border-white/10 bg-white/5 text-slate-300";
}

function toneBox(tone: CommandCenterTone) {
  return {
    danger: "border-red-400/20 bg-red-500/10 text-red-200",
    info: "border-sky-400/20 bg-sky-500/10 text-sky-200",
    primary: "border-primary/25 bg-primary/10 text-primary",
    success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-400/20 bg-amber-500/10 text-amber-200",
  }[tone];
}
