import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const CourtRentalAdminPage = lazy(() =>
  import("@/features/quadras/pages/CourtRentalAdminPage").then((module) => ({
    default: module.CourtRentalAdminPage,
  })),
);

export const Route = createFileRoute("/admin/quadras")({
  component: AdminQuadrasRoute,
});

function AdminQuadrasRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm font-semibold text-slate-300">
          Carregando locacao de quadras
        </div>
      }
    >
      <CourtRentalAdminPage />
    </Suspense>
  );
}
