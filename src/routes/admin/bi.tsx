import { Navigate, createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { BiExecutiveDashboard } from "@/features/bi/components/BiExecutiveDashboard";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/bi")({ component: BiRoute });

function BiRoute() {
  const { hasRole } = useAuth();
  const location = useLocation();
  if (location.pathname !== "/admin/bi") {
    return <Outlet />;
  }

  if (!hasRole("admin", "coordenador")) return <Navigate to="/dashboard" />;
  return <BiExecutiveDashboard />;
}
