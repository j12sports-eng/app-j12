import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import type { CommandCenterTrend } from "@/features/command-center/types/command-center.types";
import { cn } from "@/lib/utils";

export function TrendIndicator({
  className,
  label,
  trend,
}: {
  className?: string;
  label: string;
  trend: CommandCenterTrend;
}) {
  const Icon =
    trend === "positive" ? ArrowUpRight : trend === "negative" ? ArrowDownRight : ArrowRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold",
        trend === "positive" && "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
        trend === "negative" && "border-red-400/20 bg-red-500/10 text-red-200",
        (trend === "neutral" || trend === "unavailable") &&
          "border-white/10 bg-white/5 text-slate-300",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
