import { Badge } from "@/components/ui/badge";
import type { CrmLeadListItem } from "../types/crm-lead.types";

export function PipelineCard({ lead, onSelect }: { lead: CrmLeadListItem; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-primary/35 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Lead ID</p>
          <p className="mt-1 break-all text-sm font-semibold text-white">{lead.id}</p>
        </div>
        <Badge variant="outline">{lead.status}</Badge>
      </div>
      <dl className="mt-4 space-y-2 text-xs">
        <PipelineCardField label="Origem" value={lead.source || "Não informada"} />
        <PipelineCardField label="Responsável" value={lead.assignedTo || "Não atribuído"} />
        <PipelineCardField label="Última atualização" value={formatDateTime(lead.updatedAt)} />
      </dl>
    </button>
  );
}

function PipelineCardField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-all text-right text-slate-300">{value}</dd>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}
