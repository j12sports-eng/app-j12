import { createFileRoute, Navigate } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/perfil")({
  component: PerfilRedirect,
});

function PerfilRedirect() {
  const { role, homePath } = useAuth();

  let destination = homePath;

  if (role === "aluno") {
    destination = "/portal-aluno/perfil";
  } else if (role === "responsavel") {
    destination = "/portal-responsavel/perfil";
  }

  return (
    <ProtectedRoute>
      <Navigate to={destination} />
    </ProtectedRoute>
  );
}
