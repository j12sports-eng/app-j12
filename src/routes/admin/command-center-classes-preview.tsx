import { createFileRoute, Navigate } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ClassesCommandCenterPreview } from "@/features/command-center/preview/ClassesCommandCenterPreview";
import { ENABLE_COMMAND_CENTER_PREVIEW } from "@/features/command-center/preview/config";

export const Route = createFileRoute("/admin/command-center-classes-preview")({
  component: ClassesCommandCenterPreviewRoute,
});

function ClassesCommandCenterPreviewRoute() {
  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      {ENABLE_COMMAND_CENTER_PREVIEW ? (
        <AppShell title="Preview BI Turmas">
          <ClassesCommandCenterPreview />
        </AppShell>
      ) : (
        <Navigate to="/dashboard" />
      )}
    </ProtectedRoute>
  );
}
