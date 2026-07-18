import { Inbox } from "lucide-react";

export function PipelineEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
      <Inbox className="mx-auto h-6 w-6 text-slate-600" />
      <p className="mt-2 text-xs text-slate-500">Nenhum Lead neste estágio</p>
    </div>
  );
}
