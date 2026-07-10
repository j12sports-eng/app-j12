import type { AutomationHistoryRecord } from "../types/automation-history.types";
import { AutomationHistoryStatusBadge } from "./AutomationHistoryStatusBadge";

export function AutomationHistoryTimeline({ items }: { items: AutomationHistoryRecord[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <AutomationHistoryStatusBadge status={item.status} />
            <time className="text-xs text-slate-400">
              {new Date(item.startedAt).toLocaleString("pt-BR")}
            </time>
          </div>
          {item.error && (
            <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-red-200">
              {JSON.stringify(item.error, null, 2)}
            </pre>
          )}
        </li>
      ))}
    </ol>
  );
}
