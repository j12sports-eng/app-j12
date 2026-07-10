import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AutomationHistoryDetailsDialog } from "../components/AutomationHistoryDetailsDialog";
import { AutomationHistoryFilters } from "../components/AutomationHistoryFilters";
import { AutomationHistoryTable } from "../components/AutomationHistoryTable";
import { useAutomationHistory } from "../hooks/useAutomationHistory";
import type {
  AutomationHistoryFilters as Filters,
  AutomationHistoryRecord,
} from "../types/automation-history.types";

export function FinancialAutomationHistoryPage() {
  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <HistoryContent />
    </ProtectedRoute>
  );
}

function HistoryContent() {
  const [filters, setFilters] = useState<Filters>({
    page: 1,
    limit: 50,
    sortBy: "startedAt",
    sortDirection: "desc",
  });
  const [selected, setSelected] = useState<AutomationHistoryRecord | null>(null);
  const query = useAutomationHistory(filters);
  const pagination = query.data?.pagination;
  return (
    <AppShell title="Historico de Automacoes Financeiras" contentClassName="space-y-5">
      <div>
        <p className="text-sm text-slate-400">
          Consulta administrativa somente leitura das execucoes persistidas.
        </p>
      </div>
      <AutomationHistoryFilters value={filters} onChange={setFilters} />
      {query.isLoading && (
        <div className="j12-surface p-10 text-center text-slate-400">Carregando historico...</div>
      )}
      {query.isError && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5 text-red-100">
          Nao foi possivel carregar o historico.
        </div>
      )}
      {query.data && <AutomationHistoryTable items={query.data.items} onSelect={setSelected} />}
      {pagination && (
        <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
          <span>
            Pagina {pagination.page} · {pagination.total} registro(s)
          </span>
          <div className="flex gap-2">
            <button
              className="rounded-xl border border-white/10 px-4 py-2 disabled:opacity-40"
              disabled={!pagination.hasPrevious}
              onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
            >
              Anterior
            </button>
            <button
              className="rounded-xl border border-white/10 px-4 py-2 disabled:opacity-40"
              disabled={!pagination.hasNext}
              onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
            >
              Proxima
            </button>
          </div>
        </div>
      )}
      {selected && (
        <AutomationHistoryDetailsDialog record={selected} onClose={() => setSelected(null)} />
      )}
    </AppShell>
  );
}
