import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ChampionshipsAdminPage = lazy(() =>
  import("@/features/campeonatos/pages/ChampionshipsAdminPage").then((module) => ({
    default: module.ChampionshipsAdminPage,
  })),
);

export const Route = createFileRoute("/admin/campeonatos")({
  component: AdminCampeonatosRoute,
});

function AdminCampeonatosRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm font-semibold text-slate-300">
          Carregando campeonatos
        </div>
      }
    >
      <ChampionshipsAdminPage />
    </Suspense>
  );
}
