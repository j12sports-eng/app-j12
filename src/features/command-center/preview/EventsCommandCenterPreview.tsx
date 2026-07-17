import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useEventsBI } from "../hooks/events";
import { formatEventsPreviewDate, isEventsPreviewEmpty } from "./events-preview-normalizer";
import { eventsPreviewProvider } from "./events-preview-provider";
import { PreviewField, PreviewReloadButton, PreviewShell, PreviewStatePanel } from "./components";
import { createPreviewQueryOptions } from "./query-options";
const SHELL = {
  description: "Indicadores agregados e somente leitura de eventos esportivos.",
  eyebrow: "Centro de Comando",
  title: "Preview BI Eventos",
} as const;
const QUERY = createPreviewQueryOptions(["events", "CURRENT_YEAR"], {
  retry: 1,
  staleTime: 5 * 60_000,
});
const LABELS = {
  totalEvents: "Total de eventos",
  publishedEvents: "Eventos publicados",
  completedEvents: "Eventos concluídos",
  upcomingEvents: "Próximos eventos",
} as const;
export function EventsCommandCenterPreview() {
  const { contract, error, fetching, lastUpdate, loading, refetch } = useEventsBI(
    eventsPreviewProvider,
    QUERY,
  );
  if (loading && !contract)
    return (
      <PreviewShell {...SHELL}>
        <PreviewStatePanel
          icon={<LoaderCircle className="h-5 w-5 animate-spin text-primary" />}
          message="Consultando indicadores agregados de eventos."
          title="Carregando preview de eventos"
        />
      </PreviewShell>
    );
  if (error && !contract)
    return (
      <PreviewShell {...SHELL}>
        <PreviewStatePanel
          action={
            <PreviewReloadButton
              fetching={fetching}
              label="Recarregar dados de eventos"
              onReload={refetch}
            />
          }
          icon={<TriangleAlert className="h-5 w-5 text-red-300" />}
          message="Não foi possível carregar os indicadores de eventos. Tente novamente."
          title="Preview indisponível"
        />
      </PreviewShell>
    );
  if (!contract || isEventsPreviewEmpty(contract))
    return (
      <PreviewShell {...SHELL}>
        <PreviewStatePanel
          action={
            <PreviewReloadButton
              fetching={fetching}
              label="Recarregar dados de eventos"
              onReload={refetch}
            />
          }
          message="A consulta foi concluída, mas não há indicadores agregados de eventos no período."
          title="Nenhum dado de eventos disponível"
        />
      </PreviewShell>
    );
  const metrics = Object.entries(LABELS).flatMap(([id, label]) => {
    const metric = contract.kpis[id as keyof typeof LABELS];
    return metric.available && metric.value !== null ? [{ id, label, value: metric.value }] : [];
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
          label="Recarregar dados de eventos"
          onReload={refetch}
        />
      </div>
      <section className="grid gap-4 sm:grid-cols-2" aria-label="Indicadores agregados de eventos">
        {metrics.map((item) => (
          <PreviewField key={item.id} label={item.label} value={String(item.value)} />
        ))}
        <PreviewField label="generatedAt" value={formatEventsPreviewDate(contract.generatedAt)} />
        <PreviewField label="lastUpdate" value={formatEventsPreviewDate(lastUpdate)} />
      </section>
    </PreviewShell>
  );
}
