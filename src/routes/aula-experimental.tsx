import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { TrialClassPage } from "@/components/aula-experimental/TrialClassPage";

export const Route = createFileRoute("/aula-experimental")({
  component: () => (
    <RequireAuth roles={["admin", "coordenador"]}>
      <TrialClassPage />
    </RequireAuth>
  ),
});
