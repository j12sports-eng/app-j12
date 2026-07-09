import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ChampionshipGroupsPage = lazy(() =>
  import("@/features/campeonatos/pages/ChampionshipGroupsPage").then((module) => ({
    default: module.ChampionshipGroupsPage,
  })),
);

export const Route = createFileRoute("/admin/campeonatos/$championshipId/grupos")({
  component: AdminCampeonatosGruposRoute,
});

function AdminCampeonatosGruposRoute() {
  const { championshipId } = Route.useParams();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm font-semibold text-slate-300">
          Carregando grupos
        </div>
      }
    >
      <ChampionshipGroupsPage championshipId={championshipId} />
    </Suspense>
  );
}
