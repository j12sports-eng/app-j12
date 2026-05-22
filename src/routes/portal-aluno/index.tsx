import { createFileRoute, Navigate } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/portal-aluno/")({
  component: PortalAlunoIndexPage,
});

function PortalAlunoIndexPage() {
  return (
    <ProtectedRoute roles={["aluno"]}>
      <Navigate to="/portal-aluno/dashboard" />
    </ProtectedRoute>
  );
}
