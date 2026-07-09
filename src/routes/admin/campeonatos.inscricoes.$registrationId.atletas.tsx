import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ChampionshipRegistrationPlayersPage = lazy(() =>
  import("@/features/campeonatos/pages/ChampionshipRegistrationPlayersPage").then((module) => ({
    default: module.ChampionshipRegistrationPlayersPage,
  })),
);

export const Route = createFileRoute("/admin/campeonatos/inscricoes/$registrationId/atletas")({
  component: AdminCampeonatosInscricoesAtletasRoute,
});

function AdminCampeonatosInscricoesAtletasRoute() {
  const { registrationId } = Route.useParams();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm font-semibold text-slate-300">
          Carregando elenco
        </div>
      }
    >
      <ChampionshipRegistrationPlayersPage registrationId={registrationId} />
    </Suspense>
  );
}
