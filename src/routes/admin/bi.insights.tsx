import { Navigate, createFileRoute } from "@tanstack/react-router";
import { BiInsightsDashboard } from "@/features/bi/components/BiInsightsDashboard";
import { useAuth } from "@/lib/auth";
export const Route = createFileRoute("/admin/bi/insights")({ component: Page });
function Page() {
  const { hasRole } = useAuth();
  return hasRole("admin", "coordenador") ? <BiInsightsDashboard /> : <Navigate to="/dashboard" />;
}
