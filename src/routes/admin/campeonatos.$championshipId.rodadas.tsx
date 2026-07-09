import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ChampionshipRoundsPage = lazy(() =>
  import("@/features/campeonatos/pages/ChampionshipRoundsPage").then((module) => ({
    default: module.ChampionshipRoundsPage,
  })),
);

export const Route = createFileRoute("/admin/campeonatos/$championshipId/rodadas")({
  component: AdminCampeonatosRodadasRoute,
});

function AdminCampeonatosRodadasRoute() {
  const { championshipId } = Route.useParams();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm font-semibold text-slate-300">
          Carregando rodadas
        </div>
      }
    >
      <ChampionshipRoundsPage championshipId={championshipId} />
    </Suspense>
  );
}
