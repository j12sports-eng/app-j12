import { Badge } from "@/components/ui/badge";
import type { TrialClassStatus } from "@/lib/trial-classes-store";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<TrialClassStatus, string> = {
  Agendada: "border-slate-500/30 bg-slate-500/15 text-slate-200",
  Confirmada: "border-sky-400/30 bg-sky-500/15 text-sky-300",
  Compareceu: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
  "N\u00E3o compareceu": "border-red-400/30 bg-red-500/15 text-red-300",
  Reagendada: "border-amber-400/30 bg-amber-500/15 text-amber-300",
  Convertida: "border-primary/40 bg-primary/15 text-primary",
  Cancelada: "border-zinc-500/30 bg-zinc-500/15 text-zinc-300",
};

export function TrialClassStatusBadge({
  status,
  className,
}: {
  status: TrialClassStatus;
  className?: string;
}) {
  return <Badge className={cn(STATUS_STYLES[status], className)}>{status}</Badge>;
}
