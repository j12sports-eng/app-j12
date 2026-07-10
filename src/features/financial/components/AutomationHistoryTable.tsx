import type { AutomationHistoryRecord } from "../types/automation-history.types";
import { AutomationHistoryStatusBadge } from "./AutomationHistoryStatusBadge";

export function AutomationHistoryTable({
  items,
  onSelect,
}: {
  items: AutomationHistoryRecord[];
  onSelect: (item: AutomationHistoryRecord) => void;
}) {
  if (!items.length)
    return (
      <div className="j12-empty-state p-10 text-center text-slate-400">
        Nenhuma execucao encontrada.
      </div>
    );
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase text-slate-400">
          <tr>
            <th className="p-3">Inicio</th>
            <th className="p-3">Automacao</th>
            <th className="p-3">Workflow</th>
            <th className="p-3">Status</th>
            <th className="p-3">Duracao</th>
            <th className="p-3">Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-white/10 text-slate-200">
              <td className="whitespace-nowrap p-3">
                {new Date(item.startedAt).toLocaleString("pt-BR")}
              </td>
              <td className="p-3">{item.automationName}</td>
              <td className="p-3">{item.workflowName || "-"}</td>
              <td className="p-3">
                <AutomationHistoryStatusBadge status={item.status} />
              </td>
              <td className="p-3">{item.durationMs == null ? "-" : `${item.durationMs} ms`}</td>
              <td className="p-3">
                <button className="font-bold text-primary" onClick={() => onSelect(item)}>
                  Abrir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
