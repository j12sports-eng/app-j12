import { Navigate, createFileRoute } from "@tanstack/react-router";
import { BiStudentsDashboard } from "@/features/bi/components/BiStudentsDashboard";
import { useAuth } from "@/lib/auth";
export const Route = createFileRoute("/admin/bi/alunos")({ component: BiStudentsRoute });
function BiStudentsRoute() {
  const { hasRole } = useAuth();
  if (!hasRole("admin", "coordenador")) return <Navigate to="/dashboard" />;
  return <BiStudentsDashboard />;
}
