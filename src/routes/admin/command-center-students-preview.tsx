import { createFileRoute, Navigate } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ENABLE_COMMAND_CENTER_PREVIEW } from "@/features/command-center/preview/config";
import { StudentsCommandCenterPreview } from "@/features/command-center/preview/StudentsCommandCenterPreview";

export const Route = createFileRoute("/admin/command-center-students-preview")({
  component: StudentsCommandCenterPreviewRoute,
});

function StudentsCommandCenterPreviewRoute() {
  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      {ENABLE_COMMAND_CENTER_PREVIEW ? (
        <AppShell title="Preview BI Alunos">
          <StudentsCommandCenterPreview />
        </AppShell>
      ) : (
        <Navigate to="/dashboard" />
      )}
    </ProtectedRoute>
  );
}
