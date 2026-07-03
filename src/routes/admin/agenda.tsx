import { createFileRoute } from "@tanstack/react-router";

import { AgendaAdminPage } from "@/features/agenda/pages/AgendaAdminPage";

export const Route = createFileRoute("/admin/agenda")({
  component: AgendaAdminPage,
});
