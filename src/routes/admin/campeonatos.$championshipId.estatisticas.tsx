import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ChampionshipStatisticsPage = lazy(() =>
  import("@/features/campeonatos/pages/ChampionshipStatisticsPage").then((module) => ({
    default: module.ChampionshipStatisticsPage,
  })),
);

export const Route = createFileRoute("/admin/campeonatos/$championshipId/estatisticas")({
  component: AdminCampeonatosEstatisticasRoute,
});

function AdminCampeonatosEstatisticasRoute() {
  const { championshipId } = Route.useParams();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm font-semibold text-slate-300">
          Carregando estatisticas
        </div>
      }
    >
      <ChampionshipStatisticsPage championshipId={championshipId} />
    </Suspense>
  );
}
