import { createFileRoute } from "@tanstack/react-router";
import { PresencePage } from "@/components/presenca/PresencePage";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/presenca")({
  component: () => (
    <RequireAuth roles={["admin", "coordenador", "professor", "aluno", "responsavel"]}>
      <PresencePage />
    </RequireAuth>
  ),
});
