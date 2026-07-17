import { LoaderCircle, TriangleAlert } from "lucide-react";

import { useStudentsBI } from "../hooks/students";
import { PreviewField, PreviewReloadButton, PreviewShell, PreviewStatePanel } from "./components";
import { createPreviewQueryOptions } from "./query-options";
import { formatStudentsPreviewDate } from "./students-preview-normalizer";
import { studentsPreviewProvider } from "./students-preview-provider";

const ENROLLMENT_PREVIEW_SHELL = {
  description: "Visão agregada e somente leitura das matrículas suportadas pelo BI existente.",
  eyebrow: "Centro de Comando",
  title: "Preview BI Matrículas",
} as const;

const ENROLLMENT_PREVIEW_QUERY = createPreviewQueryOptions(["enrollments", "CURRENT_MONTH"], {
  retry: 1,
  staleTime: 2 * 60_000,
});

export function EnrollmentCommandCenterPreview() {
  const { contract, error, fetching, lastUpdate, loading, refetch } = useStudentsBI(
    studentsPreviewProvider,
    ENROLLMENT_PREVIEW_QUERY,
  );

  if (loading && !contract) {
    return (
      <PreviewShell {...ENROLLMENT_PREVIEW_SHELL}>
        <PreviewStatePanel
          icon={<LoaderCircle className="h-5 w-5 animate-spin text-primary" />}
          message="Consultando os indicadores agregados de matrículas autorizados."
          title="Carregando preview de matrículas"
        />
      </PreviewShell>
    );
  }

  if (error && !contract) {
    return (
      <PreviewShell {...ENROLLMENT_PREVIEW_SHELL}>
        <PreviewStatePanel
          action={
            <PreviewReloadButton
              fetching={fetching}
              label="Recarregar dados de matrículas"
              onReload={refetch}
            />
          }
          icon={<TriangleAlert className="h-5 w-5 text-red-300" />}
          message="Não foi possível carregar os indicadores de matrículas. Tente novamente."
          title="Preview indisponível"
        />
      </PreviewShell>
    );
  }

  const activeEnrollments = contract?.kpis.activeEnrollments;
  const newEnrollments = contract?.kpis.newEnrollments;
  const hasEvolution = (contract?.data?.evolution.length ?? 0) > 0;
  const hasMetric = [activeEnrollments, newEnrollments].some(
    (metric) => metric?.available && metric.value !== null && metric.value > 0,
  );

  if (!contract || (!hasMetric && !hasEvolution)) {
    return (
      <PreviewShell {...ENROLLMENT_PREVIEW_SHELL}>
        <PreviewStatePanel
          action={
            <PreviewReloadButton
              fetching={fetching}
              label="Recarregar dados de matrículas"
              onReload={refetch}
            />
          }
          message="A consulta foi concluída, mas não há indicadores agregados de matrículas disponíveis."
          title="Nenhuma matrícula no período"
        />
      </PreviewShell>
    );
  }

  const activeEnrollmentMetric = contract.kpis.activeEnrollments;
  const newEnrollmentMetric = contract.kpis.newEnrollments;

  return (
    <PreviewShell {...ENROLLMENT_PREVIEW_SHELL}>
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
          label="Recarregar dados de matrículas"
          onReload={refetch}
        />
      </div>

      <section
        className="grid gap-4 sm:grid-cols-2"
        aria-label="Indicadores agregados de matrículas"
      >
        {activeEnrollmentMetric.available && activeEnrollmentMetric.value !== null ? (
          <PreviewField label="Matrículas ativas" value={String(activeEnrollmentMetric.value)} />
        ) : null}
        {newEnrollmentMetric.available && newEnrollmentMetric.value !== null ? (
          <PreviewField label="Novas matrículas" value={String(newEnrollmentMetric.value)} />
        ) : null}
        <PreviewField label="generatedAt" value={formatStudentsPreviewDate(contract.generatedAt)} />
        <PreviewField label="lastUpdate" value={formatStudentsPreviewDate(lastUpdate)} />
      </section>
    </PreviewShell>
  );
}
