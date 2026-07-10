import { cn } from "@/lib/utils";
import type { AutomationHistoryStatus } from "../types/automation-history.types";

export function AutomationHistoryStatusBadge({ status }: { status: AutomationHistoryStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
        status === "SUCCEEDED" && "bg-emerald-500/15 text-emerald-200",
        status === "STARTED" && "bg-sky-500/15 text-sky-200",
        status === "WARNING" && "bg-amber-500/15 text-amber-200",
        ["FAILED", "TIMED_OUT"].includes(status) && "bg-red-500/15 text-red-200",
        status === "CANCELLED" && "bg-slate-500/15 text-slate-200",
      )}
    >
      {status}
    </span>
  );
}
