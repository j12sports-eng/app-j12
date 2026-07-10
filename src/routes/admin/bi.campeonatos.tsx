import { Navigate, createFileRoute } from "@tanstack/react-router";
import { BiChampionshipsDashboard } from "@/features/bi/components/BiChampionshipsDashboard";
import { useAuth } from "@/lib/auth";
export const Route = createFileRoute("/admin/bi/campeonatos")({ component: Page });
function Page() {
  const { hasRole } = useAuth();
  if (!hasRole("admin", "coordenador")) return <Navigate to="/dashboard" />;
  return <BiChampionshipsDashboard />;
}
