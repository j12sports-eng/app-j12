import { createFileRoute, Navigate } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AgendaCommandCenterPreview } from "@/features/command-center/preview/AgendaCommandCenterPreview";
import { ENABLE_COMMAND_CENTER_PREVIEW } from "@/features/command-center/preview/config";

export const Route = createFileRoute("/admin/command-center-agenda-preview")({
  component: AgendaCommandCenterPreviewRoute,
});

function AgendaCommandCenterPreviewRoute() {
  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      {ENABLE_COMMAND_CENTER_PREVIEW ? (
        <AppShell title="Preview BI Agenda">
          <AgendaCommandCenterPreview />
        </AppShell>
      ) : (
        <Navigate to="/dashboard" />
      )}
    </ProtectedRoute>
  );
}
