import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ChampionshipRegistrationsPage = lazy(() =>
  import("@/features/campeonatos/pages/ChampionshipRegistrationsPage").then((module) => ({
    default: module.ChampionshipRegistrationsPage,
  })),
);

export const Route = createFileRoute("/admin/campeonatos/inscricoes")({
  component: AdminCampeonatosInscricoesRoute,
});

function AdminCampeonatosInscricoesRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm font-semibold text-slate-300">
          Carregando inscricoes
        </div>
      }
    >
      <ChampionshipRegistrationsPage />
    </Suspense>
  );
}
