import { createFileRoute, Navigate } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  CommandCenterPreview,
  ENABLE_COMMAND_CENTER_PREVIEW,
} from "@/features/command-center/preview";

export const Route = createFileRoute("/admin/command-center-preview")({
  component: CommandCenterPreviewRoute,
});

function CommandCenterPreviewRoute() {
  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      {ENABLE_COMMAND_CENTER_PREVIEW ? (
        <AppShell title="Centro de Comando — Preview">
          <CommandCenterPreview />
        </AppShell>
      ) : (
        <Navigate to="/dashboard" />
      )}
    </ProtectedRoute>
  );
}
