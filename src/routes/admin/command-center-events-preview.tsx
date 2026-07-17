import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { EventsCommandCenterPreview } from "@/features/command-center/preview/EventsCommandCenterPreview";
import { ENABLE_COMMAND_CENTER_PREVIEW } from "@/features/command-center/preview/config";
export const Route = createFileRoute("/admin/command-center-events-preview")({
  component: EventsCommandCenterPreviewRoute,
});
function EventsCommandCenterPreviewRoute() {
  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      {ENABLE_COMMAND_CENTER_PREVIEW ? (
        <AppShell title="Preview BI Eventos">
          <EventsCommandCenterPreview />
        </AppShell>
      ) : (
        <Navigate to="/dashboard" />
      )}
    </ProtectedRoute>
  );
}
