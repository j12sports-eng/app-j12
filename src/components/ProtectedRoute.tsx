import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, type Role } from "@/lib/auth";

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { loading, isAuthenticated, hasRole } = useAuth();
  const navigate = useNavigate();
  const hasAllowedRole = !roles?.length || hasRole(...roles);

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      navigate({ to: "/login" });
      return;
    }

    if (!hasAllowedRole) {
      navigate({ to: "/dashboard" });
    }
  }, [hasAllowedRole, isAuthenticated, loading, navigate]);

  if (loading || !isAuthenticated || !hasAllowedRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-sm font-medium text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return <>{children}</>;
}
