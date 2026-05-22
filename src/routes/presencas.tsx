import { createFileRoute } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import PresencePage from "@/components/presenca/PresencePage";

export const Route = createFileRoute("/presencas")({
  component: PresencasPage,
});

function PresencasPage() {
  return (
    <ProtectedRoute roles={["admin", "coordenador", "professor"]}>
      <PresencePage />
    </ProtectedRoute>
  );
}
