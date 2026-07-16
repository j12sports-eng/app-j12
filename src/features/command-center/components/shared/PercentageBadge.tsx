import { cn } from "@/lib/utils";

export function PercentageBadge({ className, value }: { className?: string; value: number }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-200",
        className,
      )}
    >
      {value >= 0 ? "+" : ""}
      {value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
    </span>
  );
}
