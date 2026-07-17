import { LoaderCircle, TriangleAlert } from "lucide-react";

import { useFinancialBI } from "../hooks/financial";
import { PreviewField, PreviewReloadButton, PreviewShell, PreviewStatePanel } from "./components";
import { financialPreviewProvider } from "./financial-preview-provider";
import { formatPreviewDate, isFinancialPreviewEmpty } from "./financial-preview-normalizer";
import { createPreviewQueryOptions } from "./query-options";

const FINANCIAL_PREVIEW_SHELL = {
  description:
    "Validação técnica de Provider, Adapter, Contract e Hook usando a fonte BI financeira existente.",
  eyebrow: "Integração vertical",
  title: "Preview BI Financeiro",
} as const;

const FINANCIAL_PREVIEW_QUERY = createPreviewQueryOptions(["financial", "CURRENT_MONTH"], {
  retry: 1,
  staleTime: 2 * 60_000,
});

export function FinancialCommandCenterPreview() {
  const { contract, error, fetching, lastUpdate, loading, refetch } = useFinancialBI(
    financialPreviewProvider,
    FINANCIAL_PREVIEW_QUERY,
  );

  if (loading && !contract) {
    return (
      <PreviewShell {...FINANCIAL_PREVIEW_SHELL}>
        <PreviewStatePanel
          icon={<LoaderCircle className="h-5 w-5 animate-spin text-primary" />}
          message="Consultando os dados financeiros autorizados."
          title="Carregando preview financeiro"
        />
      </PreviewShell>
    );
  }

  if (error && !contract) {
    return (
      <PreviewShell {...FINANCIAL_PREVIEW_SHELL}>
        <PreviewStatePanel
          action={
            <PreviewReloadButton
              fetching={fetching}
              label="Recarregar dados financeiros"
              onReload={refetch}
            />
          }
          icon={<TriangleAlert className="h-5 w-5 text-red-300" />}
          message="Não foi possível carregar os dados financeiros. Tente novamente."
          title="Preview indisponível"
        />
      </PreviewShell>
    );
  }

  if (!contract || isFinancialPreviewEmpty(contract)) {
    return (
      <PreviewShell {...FINANCIAL_PREVIEW_SHELL}>
        <PreviewStatePanel
          action={
            <PreviewReloadButton
              fetching={fetching}
              label="Recarregar dados financeiros"
              onReload={refetch}
            />
          }
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
    <PreviewShell {...FINANCIAL_PREVIEW_SHELL}>
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
        <PreviewReloadButton
          fetching={fetching}
          label="Recarregar dados financeiros"
          onReload={refetch}
        />
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
