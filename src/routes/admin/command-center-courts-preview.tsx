import { createFileRoute, Navigate } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CourtsCommandCenterPreview } from "@/features/command-center/preview/CourtsCommandCenterPreview";
import { ENABLE_COMMAND_CENTER_PREVIEW } from "@/features/command-center/preview/config";

export const Route = createFileRoute("/admin/command-center-courts-preview")({
  component: CourtsCommandCenterPreviewRoute,
});

function CourtsCommandCenterPreviewRoute() {
  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      {ENABLE_COMMAND_CENTER_PREVIEW ? (
        <AppShell title="Preview BI Quadras">
          <CourtsCommandCenterPreview />
        </AppShell>
      ) : (
        <Navigate to="/dashboard" />
      )}
    </ProtectedRoute>
  );
}
