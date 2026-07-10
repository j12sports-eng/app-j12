import { Navigate, createFileRoute } from "@tanstack/react-router";
import { BiDelinquencyDashboard } from "@/features/bi/components/BiDelinquencyDashboard";
import { useAuth } from "@/lib/auth";
export const Route = createFileRoute("/admin/bi/inadimplencia")({ component: Page });
function Page() {
  const { hasRole } = useAuth();
  if (!hasRole("admin", "coordenador")) return <Navigate to="/dashboard" />;
  return <BiDelinquencyDashboard />;
}
