import { type ReactNode } from "react";

import { Navigate } from "@tanstack/react-router";

import { useAuth, type Role } from "@/lib/auth";
import { logSsr } from "@/lib/ssr-debug";

type Props = {
  children: ReactNode;
  roles?: Role[];
};

export function ProtectedRoute({ children, roles }: Props) {
  const { loading, isAuthenticated, user, hasRole, homePath } = useAuth();

  logSsr("[SSR] entrou no ProtectedRoute", {
    loading,
    isAuthenticated,
    hasUser: Boolean(user),
    roles: roles ?? [],
  });

  if (loading) {
    logSsr("[SSR] ProtectedRoute renderizou loading");

    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        Carregando...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    logSsr("[SSR] ProtectedRoute redirecionou para /login");

    return <Navigate to="/login" />;
  }

  if (roles?.length && !hasRole(...roles)) {
    logSsr("[SSR] ProtectedRoute redirecionou para homePath", { homePath });

    return <Navigate to={homePath} />;
  }

  logSsr("[SSR] ProtectedRoute liberou children");

  return <>{children}</>;
}
