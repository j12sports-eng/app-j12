import { LoaderCircle, TriangleAlert } from "lucide-react";

import { useChampionshipsBI } from "../hooks/championships";
import {
  formatChampionshipsPreviewDate,
  isChampionshipsPreviewEmpty,
} from "./championships-preview-normalizer";
import { championshipsPreviewProvider } from "./championships-preview-provider";
import { PreviewField, PreviewReloadButton, PreviewShell, PreviewStatePanel } from "./components";
import { createPreviewQueryOptions } from "./query-options";

const SHELL = {
  description: "Visão global, agregada e somente leitura das competições.",
  eyebrow: "Centro de Comando",
  title: "Preview BI Campeonatos",
} as const;

const QUERY = createPreviewQueryOptions(["championships", "CURRENT_YEAR"], {
  retry: 1,
  staleTime: 5 * 60_000,
});

const KPI_LABELS = {
  activeChampionships: "Campeonatos ativos",
  averageTeams: "Média de equipes",
  completedChampionships: "Campeonatos encerrados",
  finishedMatches: "Partidas concluídas",
  participants: "Participantes inscritos",
  pendingMatches: "Partidas pendentes",
  registrationRevenue: "Receita de inscrições",
  registrations: "Inscrições confirmadas",
  teams: "Equipes inscritas",
} as const;

export function ChampionshipsCommandCenterPreview() {
  const { contract, error, fetching, lastUpdate, loading, refetch } = useChampionshipsBI(
    championshipsPreviewProvider,
    QUERY,
  );

  if (loading && !contract) {
    return (
      <PreviewShell {...SHELL}>
        <PreviewStatePanel
          icon={<LoaderCircle className="h-5 w-5 animate-spin text-primary" />}
          message="Consultando os indicadores agregados e autorizados de campeonatos."
          title="Carregando preview de campeonatos"
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
              label="Recarregar dados de campeonatos"
              onReload={refetch}
            />
          }
          icon={<TriangleAlert className="h-5 w-5 text-red-300" />}
          message="Não foi possível carregar os indicadores de campeonatos. Tente novamente."
          title="Preview indisponível"
        />
      </PreviewShell>
    );
  }

  if (!contract || isChampionshipsPreviewEmpty(contract)) {
    return (
      <PreviewShell {...SHELL}>
        <PreviewStatePanel
          action={
            <PreviewReloadButton
              fetching={fetching}
              label="Recarregar dados de campeonatos"
              onReload={refetch}
            />
          }
          message="A consulta foi concluída, mas não há indicadores agregados de campeonatos no período."
          title="Nenhum dado de campeonatos disponível"
        />
      </PreviewShell>
    );
  }

  const metrics = Object.entries(KPI_LABELS).flatMap(([id, label]) => {
    const metric = contract.kpis[id as keyof typeof KPI_LABELS];
    if (!metric.available || metric.value === null) return [];
    return [{ id, label, value: metric.value }];
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
          label="Recarregar dados de campeonatos"
          onReload={refetch}
        />
      </div>
      <section
        className="grid gap-4 sm:grid-cols-2"
        aria-label="Indicadores agregados de campeonatos"
      >
        {metrics.map((metric) => (
          <PreviewField key={metric.id} label={metric.label} value={String(metric.value)} />
        ))}
        <PreviewField
          label="generatedAt"
          value={formatChampionshipsPreviewDate(contract.generatedAt)}
        />
        <PreviewField label="lastUpdate" value={formatChampionshipsPreviewDate(lastUpdate)} />
      </section>
    </PreviewShell>
  );
}
