import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { SettingsPage } from "@/components/settings/SettingsPage";

export const Route = createFileRoute("/configuracoes")({
  component: () => (
    <RequireAuth roles={["admin"]}>
      <SettingsPage />
    </RequireAuth>
  ),
});
