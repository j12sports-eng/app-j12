import { LoaderCircle, TriangleAlert } from "lucide-react";

import { useClassesBI } from "../hooks/classes";
import { formatClassesPreviewDate, isClassesPreviewEmpty } from "./classes-preview-normalizer";
import { classesPreviewProvider } from "./classes-preview-provider";
import { PreviewField, PreviewReloadButton, PreviewShell, PreviewStatePanel } from "./components";
import { createPreviewQueryOptions } from "./query-options";

const CLASSES_PREVIEW_SHELL = {
  description: "Visão agregada e somente leitura da capacidade e ocupação das turmas.",
  eyebrow: "Centro de Comando",
  title: "Preview BI Turmas",
} as const;

const CLASSES_PREVIEW_QUERY = createPreviewQueryOptions(["classes", "CURRENT_MONTH"], {
  retry: 1,
  staleTime: 2 * 60_000,
});

const KPI_LABELS = {
  activeClasses: "Turmas ativas",
  availableSpots: "Vagas disponíveis",
  fullClasses: "Turmas lotadas",
  occupancyRate: "Taxa de ocupação",
  underutilizedClasses: "Turmas subutilizadas",
} as const;

export function ClassesCommandCenterPreview() {
  const { contract, error, fetching, lastUpdate, loading, refetch } = useClassesBI(
    classesPreviewProvider,
    CLASSES_PREVIEW_QUERY,
  );

  if (loading && !contract) {
    return (
      <PreviewShell {...CLASSES_PREVIEW_SHELL}>
        <PreviewStatePanel
          icon={<LoaderCircle className="h-5 w-5 animate-spin text-primary" />}
          message="Consultando os indicadores agregados de turmas autorizados."
          title="Carregando preview de turmas"
        />
      </PreviewShell>
    );
  }

  if (error && !contract) {
    return (
      <PreviewShell {...CLASSES_PREVIEW_SHELL}>
        <PreviewStatePanel
          action={
            <PreviewReloadButton
              fetching={fetching}
              label="Recarregar dados de turmas"
              onReload={refetch}
            />
          }
          icon={<TriangleAlert className="h-5 w-5 text-red-300" />}
          message="Não foi possível carregar os indicadores de turmas. Tente novamente."
          title="Preview indisponível"
        />
      </PreviewShell>
    );
  }

  if (!contract || isClassesPreviewEmpty(contract)) {
    return (
      <PreviewShell {...CLASSES_PREVIEW_SHELL}>
        <PreviewStatePanel
          action={
            <PreviewReloadButton
              fetching={fetching}
              label="Recarregar dados de turmas"
              onReload={refetch}
            />
          }
          message="A consulta foi concluída, mas não há indicadores agregados de turmas disponíveis."
          title="Nenhuma turma disponível"
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
    <PreviewShell {...CLASSES_PREVIEW_SHELL}>
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
          label="Recarregar dados de turmas"
          onReload={refetch}
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Indicadores agregados de turmas">
        {metrics.map((metric) => (
          <PreviewField
            key={metric.id}
            label={metric.label}
            value={metric.unit === "percentage" ? `${metric.value}%` : String(metric.value)}
          />
        ))}
        <PreviewField label="generatedAt" value={formatClassesPreviewDate(contract.generatedAt)} />
        <PreviewField label="lastUpdate" value={formatClassesPreviewDate(lastUpdate)} />
      </section>
    </PreviewShell>
  );
}
