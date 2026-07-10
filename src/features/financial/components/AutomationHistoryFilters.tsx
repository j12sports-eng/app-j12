import type { AutomationHistoryFilters as Filters } from "../types/automation-history.types";

export function AutomationHistoryFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (value: Filters) => void;
}) {
  const field = "j12-field h-11 px-3 text-sm";
  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-3 xl:grid-cols-4">
      <input
        aria-label="Automacao"
        className={field}
        placeholder="Automacao"
        value={value.automationName || ""}
        onChange={(e) => onChange({ ...value, page: 1, automationName: e.target.value })}
      />
      <input
        aria-label="Workflow"
        className={field}
        placeholder="Workflow"
        value={value.workflowName || ""}
        onChange={(e) => onChange({ ...value, page: 1, workflowName: e.target.value })}
      />
      <input
        aria-label="Execution ID"
        className={field}
        placeholder="Execution ID"
        value={value.executionId || ""}
        onChange={(e) => onChange({ ...value, page: 1, executionId: e.target.value })}
      />
      <input
        aria-label="Correlation ID"
        className={field}
        placeholder="Correlation ID"
        value={value.correlationId || ""}
        onChange={(e) => onChange({ ...value, page: 1, correlationId: e.target.value })}
      />
      <input
        aria-label="Tipo de disparo"
        className={field}
        placeholder="Tipo de disparo"
        value={value.triggerType || ""}
        onChange={(e) => onChange({ ...value, page: 1, triggerType: e.target.value })}
      />
      <select
        aria-label="Status"
        className={field}
        value={value.status || ""}
        onChange={(e) => onChange({ ...value, page: 1, status: e.target.value })}
      >
        <option value="">Todos os status</option>
        {["STARTED", "SUCCEEDED", "FAILED", "WARNING", "TIMED_OUT", "CANCELLED"].map((status) => (
          <option key={status}>{status}</option>
        ))}
      </select>
      <input
        aria-label="Periodo inicial"
        className={field}
        type="datetime-local"
        value={value.startedFrom || ""}
        onChange={(e) => onChange({ ...value, page: 1, startedFrom: e.target.value })}
      />
      <input
        aria-label="Periodo final"
        className={field}
        type="datetime-local"
        value={value.startedTo || ""}
        onChange={(e) => onChange({ ...value, page: 1, startedTo: e.target.value })}
      />
      <select
        aria-label="Ordenar por"
        className={field}
        value={value.sortBy || "startedAt"}
        onChange={(e) =>
          onChange({ ...value, page: 1, sortBy: e.target.value as Filters["sortBy"] })
        }
      >
        <option value="startedAt">Inicio</option>
        <option value="finishedAt">Conclusao</option>
        <option value="durationMs">Duracao</option>
      </select>
      <select
        aria-label="Direcao"
        className={field}
        value={value.sortDirection || "desc"}
        onChange={(e) =>
          onChange({
            ...value,
            page: 1,
            sortDirection: e.target.value as Filters["sortDirection"],
          })
        }
      >
        <option value="desc">Mais recentes/maiores</option>
        <option value="asc">Mais antigos/menores</option>
      </select>
    </div>
  );
}
