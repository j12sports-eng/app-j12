import { Navigate, createFileRoute } from "@tanstack/react-router";
import { BiClassesDashboard } from "@/features/bi/components/BiClassesDashboard";
import { useAuth } from "@/lib/auth";
export const Route = createFileRoute("/admin/bi/turmas")({ component: BiClassesRoute });
function BiClassesRoute() {
  const { hasRole } = useAuth();
  if (!hasRole("admin", "coordenador")) return <Navigate to="/dashboard" />;
  return <BiClassesDashboard />;
}
