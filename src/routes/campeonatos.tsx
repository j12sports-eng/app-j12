import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ChampionshipPublicHomePage = lazy(() =>
  import("@/features/campeonatos/pages/ChampionshipPublicHomePage").then((module) => ({
    default: module.ChampionshipPublicHomePage,
  })),
);

export const Route = createFileRoute("/campeonatos")({
  component: CampeonatosPublicRoute,
});

function CampeonatosPublicRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#070707] text-sm font-semibold text-slate-300">
          Carregando campeonatos publicos
        </div>
      }
    >
      <ChampionshipPublicHomePage />
    </Suspense>
  );
}
