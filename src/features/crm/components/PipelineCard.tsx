import { Badge } from "@/components/ui/badge";
import type { CrmLeadListItem } from "../types/crm-lead.types";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Loader2 } from "lucide-react";

export function PipelineCard({
  lead,
  onSelect,
  onChangeStage,
  submitting = false,
}: {
  lead: CrmLeadListItem;
  onSelect: () => void;
  onChangeStage?: () => void;
  submitting?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    disabled: submitting,
  });
  return (
    <article
      ref={setNodeRef}
      aria-busy={submitting}
      className={`w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition duration-200 hover:border-primary/35 hover:bg-white/[0.06] ${isDragging ? "opacity-25" : "opacity-100"} ${submitting ? "animate-pulse" : ""}`}
    >
      <button
        type="button"
        aria-label={`Arrastar lead ${lead.id}`}
        disabled={submitting}
        {...listeners}
        {...attributes}
        className="mb-2 inline-flex cursor-grab items-center gap-1 rounded-md px-1 py-1 text-[11px] text-slate-500 hover:text-primary active:cursor-grabbing disabled:cursor-wait"
      >
        {submitting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <GripVertical className="h-3.5 w-3.5" />
        )}
        {submitting ? "Atualizando" : "Arrastar"}
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
      {onChangeStage ? (
        <button
          type="button"
          onClick={onChangeStage}
          className="mt-3 w-full rounded-lg border border-primary/30 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
        >
          Alterar estágio
        </button>
      ) : null}
    </article>
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
