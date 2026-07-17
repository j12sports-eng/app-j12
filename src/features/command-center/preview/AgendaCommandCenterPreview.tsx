import { LoaderCircle, TriangleAlert } from "lucide-react";

import { useAgendaBI } from "../hooks/agenda";
import { formatAgendaPreviewDate, isAgendaPreviewEmpty } from "./agenda-preview-normalizer";
import { agendaPreviewProvider } from "./agenda-preview-provider";
import { PreviewField, PreviewReloadButton, PreviewShell, PreviewStatePanel } from "./components";
import { createPreviewQueryOptions } from "./query-options";

const AGENDA_PREVIEW_SHELL = {
  description: "Visão agregada e somente leitura das séries e exceções da Agenda.",
  eyebrow: "Centro de Comando",
  title: "Preview BI Agenda",
} as const;

const AGENDA_PREVIEW_QUERY = createPreviewQueryOptions(["agenda", "CURRENT_MONTH"], {
  retry: 1,
  staleTime: 2 * 60_000,
});

const KPI_LABELS = {
  activeRecurrenceSeries: "Séries recorrentes ativas",
  cancelledOccurrences: "Ocorrências canceladas",
  cancelledRecurrenceSeries: "Séries canceladas",
  cancellationRate: "Taxa de cancelamento",
  modifiedOccurrences: "Ocorrências modificadas",
  recurrenceSeries: "Séries recorrentes no período",
} as const;

export function AgendaCommandCenterPreview() {
  const { contract, error, fetching, lastUpdate, loading, refetch } = useAgendaBI(
    agendaPreviewProvider,
    AGENDA_PREVIEW_QUERY,
  );

  if (loading && !contract) {
    return (
      <PreviewShell {...AGENDA_PREVIEW_SHELL}>
        <PreviewStatePanel
          icon={<LoaderCircle className="h-5 w-5 animate-spin text-primary" />}
          message="Consultando os indicadores agregados e autorizados da Agenda."
          title="Carregando preview de Agenda"
        />
      </PreviewShell>
    );
  }

  if (error && !contract) {
    return (
      <PreviewShell {...AGENDA_PREVIEW_SHELL}>
        <PreviewStatePanel
          action={
            <PreviewReloadButton
              fetching={fetching}
              label="Recarregar dados da Agenda"
              onReload={refetch}
            />
          }
          icon={<TriangleAlert className="h-5 w-5 text-red-300" />}
          message="Não foi possível carregar os indicadores da Agenda. Tente novamente."
          title="Preview indisponível"
        />
      </PreviewShell>
    );
  }

  if (!contract || isAgendaPreviewEmpty(contract)) {
    return (
      <PreviewShell {...AGENDA_PREVIEW_SHELL}>
        <PreviewStatePanel
          action={
            <PreviewReloadButton
              fetching={fetching}
              label="Recarregar dados da Agenda"
              onReload={refetch}
            />
          }
          message="A consulta foi concluída, mas não há indicadores agregados de Agenda no período."
          title="Nenhum dado de Agenda disponível"
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
    <PreviewShell {...AGENDA_PREVIEW_SHELL}>
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
          label="Recarregar dados da Agenda"
          onReload={refetch}
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Indicadores agregados da Agenda">
        {metrics.map((metric) => (
          <PreviewField
            key={metric.id}
            label={metric.label}
            value={metric.unit === "percentage" ? `${metric.value}%` : String(metric.value)}
          />
        ))}
        <PreviewField label="generatedAt" value={formatAgendaPreviewDate(contract.generatedAt)} />
        <PreviewField label="lastUpdate" value={formatAgendaPreviewDate(lastUpdate)} />
      </section>
    </PreviewShell>
  );
}
