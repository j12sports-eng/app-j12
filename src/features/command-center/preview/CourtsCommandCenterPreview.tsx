import { LoaderCircle, TriangleAlert } from "lucide-react";

import { useCourtsBI } from "../hooks/arena";
import { PreviewField, PreviewReloadButton, PreviewShell, PreviewStatePanel } from "./components";
import { formatCourtsPreviewDate, isCourtsPreviewEmpty } from "./courts-preview-normalizer";
import { courtsPreviewProvider } from "./courts-preview-provider";
import { createPreviewQueryOptions } from "./query-options";

const SHELL = {
  description: "Visão agregada e somente leitura da ocupação das quadras.",
  eyebrow: "Centro de Comando",
  title: "Preview BI Quadras",
} as const;

const QUERY = createPreviewQueryOptions(["courts", "CURRENT_MONTH"], {
  retry: 1,
  staleTime: 5 * 60_000,
});

const KPI_LABELS = {
  availableHours: "Horas disponíveis",
  cancellations: "Cancelamentos",
  occupancyRate: "Taxa de ocupação",
  rentalRevenue: "Receita de locações",
  reservedHours: "Horas reservadas",
  ticketAverage: "Ticket médio",
} as const;

export function CourtsCommandCenterPreview() {
  const { contract, error, fetching, lastUpdate, loading, refetch } = useCourtsBI(
    courtsPreviewProvider,
    QUERY,
  );

  if (loading && !contract) {
    return (
      <PreviewShell {...SHELL}>
        <PreviewStatePanel
          icon={<LoaderCircle className="h-5 w-5 animate-spin text-primary" />}
          message="Consultando os indicadores agregados e autorizados de quadras."
          title="Carregando preview de quadras"
        />
      </PreviewShell>
    );
  }

  if (error && !contract) {
    return (
      <PreviewShell {...SHELL}>
        <PreviewStatePanel
          action={
            <PreviewReloadButton
              fetching={fetching}
              label="Recarregar dados de quadras"
              onReload={refetch}
            />
          }
          icon={<TriangleAlert className="h-5 w-5 text-red-300" />}
          message="Não foi possível carregar os indicadores de quadras. Tente novamente."
          title="Preview indisponível"
        />
      </PreviewShell>
    );
  }

  if (!contract || isCourtsPreviewEmpty(contract)) {
    return (
      <PreviewShell {...SHELL}>
        <PreviewStatePanel
          action={
            <PreviewReloadButton
              fetching={fetching}
              label="Recarregar dados de quadras"
              onReload={refetch}
            />
          }
          message="A consulta foi concluída, mas não há indicadores agregados de quadras no período."
          title="Nenhum dado de quadras disponível"
        />
      </PreviewShell>
    );
  }

  const metrics = Object.entries(KPI_LABELS).flatMap(([id, label]) => {
    const metric = contract.kpis[id as keyof typeof KPI_LABELS];
    if (!metric.available || metric.value === null) return [];
    return [{ id, label, unit: metric.unit, value: metric.value }];
  });

  return (
    <PreviewShell {...SHELL}>
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
          label="Recarregar dados de quadras"
          onReload={refetch}
        />
      </div>
      <section className="grid gap-4 sm:grid-cols-2" aria-label="Indicadores agregados de quadras">
        {metrics.map((metric) => (
          <PreviewField
            key={metric.id}
            label={metric.label}
            value={metric.unit === "percentage" ? `${metric.value}%` : String(metric.value)}
          />
        ))}
        <PreviewField label="generatedAt" value={formatCourtsPreviewDate(contract.generatedAt)} />
        <PreviewField label="lastUpdate" value={formatCourtsPreviewDate(lastUpdate)} />
      </section>
    </PreviewShell>
  );
}
