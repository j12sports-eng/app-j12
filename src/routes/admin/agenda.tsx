import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const AgendaAdminPage = lazy(() =>
  import("@/features/agenda/pages/AgendaAdminPage").then((module) => ({
    default: module.AgendaAdminPage,
  })),
);

export const Route = createFileRoute("/admin/agenda")({
  component: AdminAgendaRoute,
});

function AdminAgendaRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm font-semibold text-slate-300">
          Carregando agenda administrativa
        </div>
      }
    >
      <AgendaAdminPage />
    </Suspense>
  );
}
