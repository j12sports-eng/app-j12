import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ChampionshipStandingsPage = lazy(() =>
  import("@/features/campeonatos/pages/ChampionshipStandingsPage").then((module) => ({
    default: module.ChampionshipStandingsPage,
  })),
);

export const Route = createFileRoute("/admin/campeonatos/$championshipId/classificacao")({
  component: AdminCampeonatosClassificacaoRoute,
});

function AdminCampeonatosClassificacaoRoute() {
  const { championshipId } = Route.useParams();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm font-semibold text-slate-300">
          Carregando classificacao
        </div>
      }
    >
      <ChampionshipStandingsPage championshipId={championshipId} />
    </Suspense>
  );
}
