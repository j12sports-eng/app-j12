import { createFileRoute, Navigate } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/agenda")({
  component: AgendaRedirect,
});

function AgendaRedirect() {
  const { role, homePath } = useAuth();

  let destination = homePath;

  if (role === "aluno") {
    destination = "/portal-aluno/agenda";
  } else if (role === "responsavel") {
    destination = "/portal-responsavel/agenda";
  }

  return (
    <ProtectedRoute>
      <Navigate to={destination} />
    </ProtectedRoute>
  );
}
