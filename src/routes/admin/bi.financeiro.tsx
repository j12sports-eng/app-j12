import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BiFinancialDashboard } from "@/features/bi/components/BiFinancialDashboard";

export const Route = createFileRoute("/admin/bi/financeiro")({ component: BiFinancialRoute });
function BiFinancialRoute() {
  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <BiFinancialDashboard />
    </ProtectedRoute>
  );
}
