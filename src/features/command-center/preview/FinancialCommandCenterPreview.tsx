import { LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";

import { useFinancialBI } from "../hooks/financial";
import { financialPreviewProvider } from "./financial-preview-provider";
import { formatPreviewDate, isFinancialPreviewEmpty } from "./financial-preview-normalizer";

export function FinancialCommandCenterPreview() {
  const { contract, error, fetching, lastUpdate, loading, refetch } = useFinancialBI(
    financialPreviewProvider,
    {
      queryKey: ["command-center-preview", "financial", "CURRENT_MONTH"],
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2 * 60_000,
    },
  );

  if (loading && !contract) {
    return (
      <PreviewShell>
        <StatePanel
          icon={<LoaderCircle className="h-5 w-5 animate-spin text-primary" />}
          message="Consultando os dados financeiros autorizados."
          title="Carregando preview financeiro"
        />
      </PreviewShell>
    );
  }

  if (error && !contract) {
    return (
      <PreviewShell>
        <StatePanel
          action={<ReloadButton fetching={fetching} onReload={refetch} />}
          icon={<TriangleAlert className="h-5 w-5 text-red-300" />}
          message="Não foi possível carregar os dados financeiros. Tente novamente."
          title="Preview indisponível"
        />
      </PreviewShell>
    );
  }

  if (!contract || isFinancialPreviewEmpty(contract)) {
    return (
      <PreviewShell>
        <StatePanel
          action={<ReloadButton fetching={fetching} onReload={refetch} />}
          message="A consulta foi concluída, mas não há métricas ou registros disponíveis."
          title="Nenhum dado financeiro no período"
        />
      </PreviewShell>
    );
  }

  const kpiCount = Object.values(contract.kpis).filter((metric) => metric.available).length;
  const recordCount =
    (contract.data?.evolution.length ?? 0) +
    Object.values(contract.data?.breakdowns ?? {}).reduce(
      (total, records) => total + records.length,
      0,
    );

  return (
    <PreviewShell>
      {error ? (
        <div
          role="status"
          className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100"
        >
          Os dados anteriores foram preservados, mas a atualização mais recente falhou.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-400">
          {fetching ? "Atualizando dados…" : "Dados atualizados"}
        </span>
        <ReloadButton fetching={fetching} onReload={refetch} />
      </div>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Resumo do contrato financeiro">
        <PreviewField label="Status do contrato" value="Disponível" />
        <PreviewField label="Atualização" value={fetching ? "Em andamento" : "Concluída"} />
        <PreviewField label="generatedAt" value={formatPreviewDate(contract.generatedAt)} />
        <PreviewField label="lastUpdate" value={formatPreviewDate(lastUpdate)} />
        <PreviewField label="Source" value={contract.source.name || "—"} />
        <PreviewField label="Capabilities" value={contract.capabilities.join(", ") || "—"} />
        <PreviewField label="KPIs disponíveis" value={String(kpiCount)} />
        <PreviewField label="Quantidade de registros" value={String(recordCount)} />
      </section>
    </PreviewShell>
  );
}

function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-4xl space-y-5">
      <header className="rounded-3xl border border-primary/20 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
          Integração vertical
        </p>
        <h1 className="mt-2 text-2xl font-black text-white">Preview BI Financeiro</h1>
        <p className="mt-2 text-sm text-slate-400">
          Validação técnica de Provider, Adapter, Contract e Hook usando a fonte BI financeira
          existente.
        </p>
      </header>
      {children}
    </main>
  );
}

function StatePanel({
  action,
  icon,
  message,
  title,
}: {
  action?: React.ReactNode;
  icon?: React.ReactNode;
  message: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-6" aria-live="polite">
      <div className="flex items-center gap-3">
        {icon}
        <h2 className="font-black text-white">{title}</h2>
      </div>
      <p className="mt-3 text-sm text-slate-400">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

function ReloadButton({
  fetching,
  onReload,
}: {
  fetching: boolean;
  onReload: () => Promise<unknown>;
}) {
  return (
    <button
      aria-label="Recarregar dados financeiros"
      className="inline-flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-bold text-primary disabled:cursor-wait disabled:opacity-60"
      disabled={fetching}
      onClick={() => void onReload()}
      type="button"
    >
      <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
      {fetching ? "Atualizando" : "Recarregar"}
    </button>
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
