import { X } from "lucide-react";
import { useAutomationHistoryDetails, useExecutionHistory } from "../hooks/useAutomationHistory";
import type { AutomationHistoryRecord } from "../types/automation-history.types";
import { AutomationHistoryTimeline } from "./AutomationHistoryTimeline";

export function AutomationHistoryDetailsDialog({
  record,
  onClose,
}: {
  record: AutomationHistoryRecord;
  onClose: () => void;
}) {
  const timeline = useExecutionHistory(record.executionId);
  const details = useAutomationHistoryDetails(record.id);
  const selectedRecord = details.data || record;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes da execucao"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Timeline append-only
            </p>
            <h2 className="mt-1 break-all text-xl font-black text-white">{record.executionId}</h2>
          </div>
          <button aria-label="Fechar" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <dl className="my-5 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-400">History ID</dt>
            <dd className="break-all text-white">{selectedRecord.id}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Correlation ID</dt>
            <dd className="break-all text-white">{selectedRecord.correlationId || "-"}</dd>
          </div>
        </dl>
        {details.isError && (
          <p className="mb-4 text-sm text-amber-200">
            Detalhes atualizados indisponiveis; exibindo os dados da listagem.
          </p>
        )}
        {timeline.isLoading && <p className="text-slate-400">Carregando timeline...</p>}
        {timeline.isError && <p className="text-red-200">Nao foi possivel carregar a timeline.</p>}
        {timeline.data && <AutomationHistoryTimeline items={timeline.data.items} />}
      </div>
    </div>
  );
}
