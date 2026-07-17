import { createFileRoute, Navigate } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ChampionshipsCommandCenterPreview } from "@/features/command-center/preview/ChampionshipsCommandCenterPreview";
import { ENABLE_COMMAND_CENTER_PREVIEW } from "@/features/command-center/preview/config";

export const Route = createFileRoute("/admin/command-center-championships-preview")({
  component: ChampionshipsCommandCenterPreviewRoute,
});

function ChampionshipsCommandCenterPreviewRoute() {
  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      {ENABLE_COMMAND_CENTER_PREVIEW ? (
        <AppShell title="Preview BI Campeonatos">
          <ChampionshipsCommandCenterPreview />
        </AppShell>
      ) : (
        <Navigate to="/dashboard" />
      )}
    </ProtectedRoute>
  );
}
