import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  className?: string;
  label?: string;
};

export function WidgetStaleBadge({ className, label = "Dados em cache" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function WidgetPartialBadge({ className, label = "Dados parciais" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-200",
        className,
      )}
    >
      {label}
    </span>
  );
}
