import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ChampionshipPublicDetailsPage = lazy(() =>
  import("@/features/campeonatos/pages/ChampionshipPublicDetailsPage").then((module) => ({
    default: module.ChampionshipPublicDetailsPage,
  })),
);

export const Route = createFileRoute("/campeonatos/$championshipId")({
  component: CampeonatosPublicDetailsRoute,
});

function CampeonatosPublicDetailsRoute() {
  const { championshipId } = Route.useParams();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#070707] text-sm font-semibold text-slate-300">
          Carregando detalhes do campeonato
        </div>
      }
    >
      <ChampionshipPublicDetailsPage championshipId={championshipId} />
    </Suspense>
  );
}
