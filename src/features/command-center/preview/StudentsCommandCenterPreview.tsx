import { LoaderCircle, TriangleAlert } from "lucide-react";

import { useStudentsBI } from "../hooks/students";
import { PreviewField, PreviewReloadButton, PreviewShell, PreviewStatePanel } from "./components";
import { createPreviewQueryOptions } from "./query-options";
import { formatStudentsPreviewDate, isStudentsPreviewEmpty } from "./students-preview-normalizer";
import { studentsPreviewProvider } from "./students-preview-provider";

const STUDENTS_PREVIEW_SHELL = {
  description: "Visão agregada e somente leitura dos indicadores de alunos já disponíveis no BI.",
  eyebrow: "Centro de Comando",
  title: "Preview BI Alunos",
} as const;

const STUDENTS_PREVIEW_QUERY = createPreviewQueryOptions(["students", "CURRENT_MONTH"], {
  retry: 1,
  staleTime: 2 * 60_000,
});

const STUDENT_KPI_LABELS = {
  activeEnrollments: "Matrículas ativas",
  activeStudents: "Alunos ativos",
  newEnrollments: "Novas matrículas",
  newStudents: "Novos alunos",
} as const;

export function StudentsCommandCenterPreview() {
  const { contract, error, fetching, lastUpdate, loading, refetch } = useStudentsBI(
    studentsPreviewProvider,
    STUDENTS_PREVIEW_QUERY,
  );

  if (loading && !contract) {
    return (
      <PreviewShell {...STUDENTS_PREVIEW_SHELL}>
        <PreviewStatePanel
          icon={<LoaderCircle className="h-5 w-5 animate-spin text-primary" />}
          message="Consultando os indicadores agregados de alunos autorizados."
          title="Carregando preview de alunos"
        />
      </PreviewShell>
    );
  }

  if (error && !contract) {
    return (
      <PreviewShell {...STUDENTS_PREVIEW_SHELL}>
        <PreviewStatePanel
          action={
            <PreviewReloadButton
              fetching={fetching}
              label="Recarregar dados de alunos"
              onReload={refetch}
            />
          }
          icon={<TriangleAlert className="h-5 w-5 text-red-300" />}
          message="Não foi possível carregar os indicadores de alunos. Tente novamente."
          title="Preview indisponível"
        />
      </PreviewShell>
    );
  }

  if (!contract || isStudentsPreviewEmpty(contract)) {
    return (
      <PreviewShell {...STUDENTS_PREVIEW_SHELL}>
        <PreviewStatePanel
          action={
            <PreviewReloadButton
              fetching={fetching}
              label="Recarregar dados de alunos"
              onReload={refetch}
            />
          }
          message="A consulta foi concluída, mas não há indicadores agregados disponíveis."
          title="Nenhum dado de alunos no período"
        />
      </PreviewShell>
    );
  }

  const availableKpis = Object.entries(STUDENT_KPI_LABELS).flatMap(([id, label]) => {
    const metric = contract.kpis[id as keyof typeof STUDENT_KPI_LABELS];
    return metric.available && metric.value !== null ? [{ id, label, value: metric.value }] : [];
  });

  return (
    <PreviewShell {...STUDENTS_PREVIEW_SHELL}>
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
          label="Recarregar dados de alunos"
          onReload={refetch}
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Indicadores agregados de alunos">
        {availableKpis.map((metric) => (
          <PreviewField key={metric.id} label={metric.label} value={String(metric.value)} />
        ))}
        <PreviewField label="generatedAt" value={formatStudentsPreviewDate(contract.generatedAt)} />
        <PreviewField label="lastUpdate" value={formatStudentsPreviewDate(lastUpdate)} />
      </section>
    </PreviewShell>
  );
}
