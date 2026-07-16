import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function DashboardFilters({
  children,
  className,
  label = "Filtros do dashboard",
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 md:flex md:flex-wrap md:items-end",
        className,
      )}
    >
      {children}
    </section>
  );
}
