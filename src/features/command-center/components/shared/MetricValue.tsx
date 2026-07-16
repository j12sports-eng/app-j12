import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function MetricValue({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <strong className={cn("text-2xl font-black tabular-nums text-white md:text-3xl", className)}>
      {children}
    </strong>
  );
}
