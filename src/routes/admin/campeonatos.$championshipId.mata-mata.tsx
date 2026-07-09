import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ChampionshipBracketPage = lazy(() =>
  import("@/features/campeonatos/pages/ChampionshipBracketPage").then((module) => ({
    default: module.ChampionshipBracketPage,
  })),
);

export const Route = createFileRoute("/admin/campeonatos/$championshipId/mata-mata")({
  component: AdminCampeonatosMataMataRoute,
});

function AdminCampeonatosMataMataRoute() {
  const { championshipId } = Route.useParams();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm font-semibold text-slate-300">
          Carregando mata-mata
        </div>
      }
    >
      <ChampionshipBracketPage championshipId={championshipId} />
    </Suspense>
  );
}
