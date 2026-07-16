import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function DashboardToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      {children}
    </div>
  );
}
