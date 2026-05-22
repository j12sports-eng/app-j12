import { type ReactNode } from "react";

import { Navigate } from "@tanstack/react-router";

import { useAuth, type Role } from "@/lib/auth";

type Props = {
  children: ReactNode;
  roles?: Role[];
};

export function ProtectedRoute({ children, roles }: Props) {
  const { loading, isAuthenticated, user, hasRole, homePath } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        Carregando...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" />;
  }

  if (roles?.length && !hasRole(...roles)) {
    return <Navigate to={homePath} />;
  }

  return <>{children}</>;
}
