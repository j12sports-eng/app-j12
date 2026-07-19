import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrmLeadSlaBadge } from "./CrmLeadSlaBadge";
import { displayElapsed, formatDuration } from "./CrmLeadStageTimingDetails";
import { recordCrmSlaAlertsEvent } from "../observability/crm-sla-alerts.observability";
import type { CrmSlaAlertItem as CrmSlaAlertItemModel } from "../types/crm-sla-alerts.types";

export function CrmSlaAlertItem({
  item,
  nowMs,
  onOpenLead,
}: {
  item: CrmSlaAlertItemModel;
  nowMs: number;
  onOpenLead: (leadId: string) => void;
}) {
  function openLead() {
    recordCrmSlaAlertsEvent("CRM_SLA_ALERT_OPENED", {
      alertStatus: item.alertStatus,
      result: "success",
      stage: item.stage,
    });
    onOpenLead(item.leadId);
  }

  return (
    <li>
      <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Lead ID</p>
            <p className="mt-1 break-all text-sm font-semibold text-white">{item.leadId}</p>
          </div>
          <CrmLeadSlaBadge timing={item} />
        </div>

        <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
          <AlertValue label="Etapa" value={stageLabel(item.stage)} />
          <AlertValue label="Tempo na etapa" value={formatDuration(displayElapsed(item, nowMs))} />
          <AlertValue label="Entrada na etapa" value={formatInstant(item.currentStageEntryAt)} />
        </dl>

        {item.alertStatus === "UNAVAILABLE" ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-slate-500/20 bg-slate-500/10 p-3 text-xs text-slate-300">
            <Clock3 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Não há histórico suficiente para calcular o prazo deste Lead.
          </p>
        ) : null}

        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full sm:w-auto"
          aria-label={`Abrir detalhe do Lead ${item.leadId}`}
          data-crm-sla-alert-detail-trigger={item.leadId}
          onClick={openLead}
        >
          Abrir detalhe
        </Button>
      </div>
    </li>
  );
}

function AlertValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/10 px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-slate-200">{value}</dd>
    </div>
  );
}

function formatInstant(value: string | null) {
  if (!value) return "Indisponível";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Indisponível" : date.toLocaleString("pt-BR");
}

function stageLabel(value: string) {
  return value.replaceAll("_", " ");
}
