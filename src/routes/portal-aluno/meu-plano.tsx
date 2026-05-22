import { createFileRoute, Navigate } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/portal-aluno/meu-plano")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute roles={["aluno"]}>
      <Navigate to="/meu-plano" />
    </ProtectedRoute>
  );
}
