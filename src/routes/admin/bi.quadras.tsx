import { Navigate, createFileRoute } from "@tanstack/react-router";
import { BiCourtsDashboard } from "@/features/bi/components/BiCourtsDashboard";
import { useAuth } from "@/lib/auth";
export const Route = createFileRoute("/admin/bi/quadras")({ component: Page });
function Page() {
  const { hasRole } = useAuth();
  if (!hasRole("admin", "coordenador")) return <Navigate to="/dashboard" />;
  return <BiCourtsDashboard />;
}
