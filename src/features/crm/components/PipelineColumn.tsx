import type { CrmLeadListItem } from "../types/crm-lead.types";
import type { CrmPipelineStage } from "../types/crm-pipeline.types";
import { PipelineCard } from "./PipelineCard";
import { PipelineEmptyState } from "./PipelineEmptyState";

export function PipelineColumn({
  leads,
  onSelect,
  stage,
}: {
  leads: CrmLeadListItem[];
  onSelect: (leadId: string) => void;
  stage: CrmPipelineStage;
}) {
  return (
    <section
      aria-labelledby={`pipeline-stage-${stage.id}`}
      className="min-w-[280px] rounded-3xl border border-white/10 bg-black/20 p-3"
    >
      <header className="mb-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
            <h3 id={`pipeline-stage-${stage.id}`} className="font-semibold text-white">
              {stage.label}
            </h3>
          </div>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
            {leads.length}
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">{stage.description}</p>
      </header>
      <div className="space-y-3">
        {leads.length ? (
          leads.map((lead) => (
            <PipelineCard key={lead.id} lead={lead} onSelect={() => onSelect(lead.id)} />
          ))
        ) : (
          <PipelineEmptyState />
        )}
      </div>
    </section>
  );
}
