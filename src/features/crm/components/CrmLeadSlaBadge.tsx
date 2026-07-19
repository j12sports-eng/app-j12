import { AlertTriangle, CheckCircle2, Clock3, HelpCircle } from "lucide-react";
import type { CrmLeadStageTimingSummary } from "../types/crm-lead-stage-timing.types";

const LABELS = {
  COMPLETED: "Concluído",
  DUE_SOON: "Próximo do prazo",
  NOT_CONFIGURED: "SLA não configurado",
  ON_TRACK: "No prazo",
  OVERDUE: "Atrasado",
  UNAVAILABLE: "SLA indisponível",
} as const;

const STYLES = {
  COMPLETED: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  DUE_SOON: "border-amber-400/30 bg-amber-500/10 text-amber-100",
  NOT_CONFIGURED: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  ON_TRACK: "border-sky-400/30 bg-sky-500/10 text-sky-200",
  OVERDUE: "border-red-400/30 bg-red-500/10 text-red-100",
  UNAVAILABLE: "border-slate-500/30 bg-slate-500/10 text-slate-300",
} as const;

export function CrmLeadSlaBadge({ timing }: { timing?: CrmLeadStageTimingSummary | null }) {
  const status = timing?.sla.status || "UNAVAILABLE";
  const Icon =
    status === "OVERDUE" || status === "DUE_SOON"
      ? AlertTriangle
      : status === "ON_TRACK" || status === "COMPLETED"
        ? CheckCircle2
        : status === "NOT_CONFIGURED"
          ? Clock3
          : HelpCircle;
  return (
    <span
      aria-label={`Situação do SLA: ${LABELS[status]}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${STYLES[status]}`}
    >
      <Icon aria-hidden="true" className="h-3 w-3" />
      {LABELS[status]}
    </span>
  );
}
