import { createFileRoute, Navigate } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";

import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/presenca")({
  component: PresencaRedirect,
});

function PresencaRedirect() {
  const { role } = useAuth();

  let destination = "/portal-aluno/presencas";

  if (role === "admin" || role === "coordenador" || role === "professor") {
    destination = "/presencas";
  } else if (role === "responsavel") {
    destination = "/portal-responsavel/presencas";
  }

  return (
    <ProtectedRoute>
      <Navigate to={destination} />
    </ProtectedRoute>
  );
}
