import { createFileRoute, Navigate } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/portal-responsavel/")({
  component: PortalResponsavelIndexPage,
});

function PortalResponsavelIndexPage() {
  return (
    <ProtectedRoute roles={["responsavel"]}>
      <Navigate to="/portal-responsavel/dashboard" />
    </ProtectedRoute>
  );
}
