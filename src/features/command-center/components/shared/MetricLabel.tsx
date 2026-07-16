import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function MetricLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn("text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400", className)}
    >
      {children}
    </span>
  );
}
