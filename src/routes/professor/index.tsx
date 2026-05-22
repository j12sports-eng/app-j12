import { createFileRoute, Navigate } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/professor/")({
  component: ProfessorIndexPage,
});

function ProfessorIndexPage() {
  return (
    <ProtectedRoute roles={["admin", "coordenador", "professor"]}>
      <Navigate to="/professor/presencas" />
    </ProtectedRoute>
  );
}
