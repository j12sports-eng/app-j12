import { createFileRoute, Navigate } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";

import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/financeiro")({
  component: FinanceiroRedirect,
});

function FinanceiroRedirect() {
  const { role } = useAuth();

  let destination = "/portal-aluno/financeiro";

  if (role === "admin" || role === "coordenador") {
    destination = "/admin/financeiro";
  } else if (role === "professor") {
    destination = "/admin/presenca";
  } else if (role === "responsavel") {
    destination = "/portal-responsavel/financeiro";
  }

  return (
    <ProtectedRoute>
      <Navigate to={destination} />
    </ProtectedRoute>
  );
}
