import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Toaster } from "react-hot-toast";

import { GlobalSkeletonFallback } from "@/components/ui/skeleton";
import { getRoleHomePath, useAuth } from "@/lib/auth";
import { logSsr, logSsrRoute } from "@/lib/ssr-debug";

export const Route = createFileRoute("/")({
  loader: () => {
    logSsr("[SSR] iniciou loader /");
    logSsr("[SSR] terminou loader /");
    return null;
  },
  component: Index,
});

function Index() {
  logSsrRoute("/", "entrou na");

  const { user, loading } = useAuth();

  logSsr("[SSR] estado auth na rota /", {
    loading,
    hasUser: Boolean(user),
  });

  if (loading) {
    return (
      <>
        <Toaster position="top-right" />

        <GlobalSkeletonFallback />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Toaster position="top-right" />
        <Navigate to="/login" />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <Navigate to={getRoleHomePath(user)} />
    </>
  );
}
