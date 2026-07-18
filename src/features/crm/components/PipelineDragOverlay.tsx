import { GripVertical } from "lucide-react";
import type { CrmLeadListItem } from "../types/crm-lead.types";
export function PipelineDragOverlay({ lead }: { lead: CrmLeadListItem }) {
  return (
    <div className="w-[272px] rotate-2 rounded-2xl border border-primary/60 bg-slate-950 p-4 shadow-2xl shadow-primary/20">
      <div className="flex items-center gap-2 text-primary">
        <GripVertical className="h-4 w-4" />
        <span className="text-xs font-bold uppercase">Movendo lead</span>
      </div>
      <p className="mt-2 break-all text-sm font-semibold text-white">{lead.id}</p>
      <p className="mt-1 text-xs text-slate-400">Origem: {lead.stage}</p>
    </div>
  );
}
