import { createFileRoute } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import ProfessorPresencasPage from "@/components/professor/ProfessorPresencasPage";

export const Route = createFileRoute("/professor/presencas")({
  component: ProfessorPresencasPageWrapper,
});

function ProfessorPresencasPageWrapper() {
  return (
    <ProtectedRoute roles={["admin", "coordenador", "professor"]}>
      <ProfessorPresencasPage />
    </ProtectedRoute>
  );
}
