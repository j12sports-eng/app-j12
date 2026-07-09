import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ChampionshipMatchReportPage = lazy(() =>
  import("@/features/campeonatos/pages/ChampionshipMatchReportPage").then((module) => ({
    default: module.ChampionshipMatchReportPage,
  })),
);

export const Route = createFileRoute("/admin/campeonatos/$championshipId/jogos/$matchId/sumula")({
  component: AdminCampeonatosSumulaRoute,
});

function AdminCampeonatosSumulaRoute() {
  const { championshipId, matchId } = Route.useParams();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm font-semibold text-slate-300">
          Carregando sumula
        </div>
      }
    >
      <ChampionshipMatchReportPage championshipId={championshipId} matchId={matchId} />
    </Suspense>
  );
}
