import { Navigate, createFileRoute } from "@tanstack/react-router";
import { BiFinancialDashboard } from "@/features/bi/components/BiFinancialDashboard";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/bi/financeiro")({ component: BiFinancialRoute });
function BiFinancialRoute() {
  const { hasRole } = useAuth();
  if (!hasRole("admin", "coordenador")) return <Navigate to="/dashboard" />;
  return <BiFinancialDashboard />;
}
