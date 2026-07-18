import { Columns3 } from "lucide-react";

export function PipelineHeader({
  leadCount,
  stageCount,
}: {
  leadCount: number;
  stageCount: number;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Columns3 className="h-4 w-4" />
          Pipeline comercial
        </div>
        <h2 className="mt-1 text-xl font-bold text-white">Funil de Leads</h2>
      </div>
      <p className="text-sm text-slate-400">
        {leadCount} Leads carregados · {stageCount} estágios
      </p>
    </header>
  );
}
