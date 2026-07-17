import { useFinancialBI } from "../hooks/financial";
import { financialPreviewProvider } from "./financial-preview-provider";

export function FinancialCommandCenterPreview() {
  const { contract, error, lastUpdate, loading, refetch } = useFinancialBI(
    financialPreviewProvider,
    {
      queryKey: ["command-center-preview", "financial", "CURRENT_MONTH"],
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2 * 60_000,
    },
  );

  const kpiCount = contract ? Object.keys(contract.kpis).length : 0;
  const recordCount = contract
  ? (contract.data?.evolution?.length ?? 0) +
      Object.values(contract.data?.breakdowns ?? {}).reduce(
        (total, records) => total + records.length,
        0,
      )
  : 0;

  return (
    <main className="mx-auto max-w-4xl space-y-5">
      <header className="rounded-3xl border border-primary/20 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
          Integração vertical
        </p>
        <h1 className="mt-2 text-2xl font-black text-white">Preview BI Financeiro</h1>
        <p className="mt-2 text-sm text-slate-400">
          Validação técnica de Provider, Adapter, Contract e Hook usando a fonte BI financeira já
          existente.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <PreviewField label="Status do contrato" value={contract ? "Disponível" : "Pendente"} />
        <PreviewField label="Loading" value={loading ? "Sim" : "Não"} />
        <PreviewField label="generatedAt" value={contract?.generatedAt ?? "—"} />
        <PreviewField label="lastUpdate" value={lastUpdate ?? "—"} />
        <PreviewField label="Source" value={contract?.source.name ?? "—"} />
        <PreviewField label="Capabilities" value={contract?.capabilities.join(", ") || "—"} />
        <PreviewField label="Quantidade de KPIs" value={String(kpiCount)} />
        <PreviewField label="Quantidade de registros" value={String(recordCount)} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-white">Estado de erro</h2>
            <p className={error ? "mt-2 text-sm text-red-300" : "mt-2 text-sm text-slate-400"}>
              {error?.message ?? "Nenhum erro registrado."}
            </p>
          </div>
          <button
            className="rounded-xl border border-primary/30 px-4 py-2 text-sm font-bold text-primary"
            onClick={() => void refetch()}
            type="button"
          >
            Recarregar
          </button>
        </div>
      </section>
    </main>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
