import { Navigate, createFileRoute } from "@tanstack/react-router";
import { BiExportsDashboard } from "@/features/bi/components/BiExportsDashboard";
import { useAuth } from "@/lib/auth";
export const Route = createFileRoute("/admin/bi/relatorios")({ component: Page });
function Page() {
  const { hasRole } = useAuth();
  if (!hasRole("admin", "coordenador")) return <Navigate to="/dashboard" />;
  return <BiExportsDashboard />;
}
