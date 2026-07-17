import { createFileRoute, Navigate } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ENABLE_COMMAND_CENTER_PREVIEW } from "@/features/command-center/preview/config";
import { EnrollmentCommandCenterPreview } from "@/features/command-center/preview/EnrollmentCommandCenterPreview";

export const Route = createFileRoute("/admin/command-center-enrollment-preview")({
  component: EnrollmentCommandCenterPreviewRoute,
});

function EnrollmentCommandCenterPreviewRoute() {
  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      {ENABLE_COMMAND_CENTER_PREVIEW ? (
        <AppShell title="Preview BI Matrículas">
          <EnrollmentCommandCenterPreview />
        </AppShell>
      ) : (
        <Navigate to="/dashboard" />
      )}
    </ProtectedRoute>
  );
}
